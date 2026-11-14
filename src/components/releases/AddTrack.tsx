import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { Check, ListPlus, Plus } from 'lucide-react'
import { useState } from 'react'

import { addTrack, type ReleaseRow } from '#/server/releases'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { Input, Led } from '../primitives'
import { Composer } from '../shared/Composer'
import { sectionOf, trackLink } from './sections'

type Search = { add?: true }

/** `?add` opens Add a track over an EP or album's Tracks, so Back closes it. */
export function useAddTrackParam() {
  const navigate = useNavigate()
  return {
    open: useSearch({ strict: false }).add === true,
    show: () => navigate({ to: '.', search: (prev: Search) => ({ ...prev, add: true as const }), resetScroll: false }),
    close: () => navigate({ to: '.', search: ({ add: _, ...rest }: Search) => rest, resetScroll: false }),
  }
}

/** The empty channel after an EP or album's last track: the next number waiting, and the way to fill it. */
export function AddTrackSlot({ number }: { number: number }) {
  const { show } = useAddTrackParam()
  return (
    <button
      type="button"
      onClick={() => void show()}
      className="press group flex min-h-18 w-full items-center gap-3 rounded-3xl border border-dashed border-line-strong px-6 text-left transition-[border-color,background-color] duration-(--duration-normal) hover:border-accent/60 hover:bg-accent-dim focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <span className="readout w-6 shrink-0 text-ink-muted group-hover:text-accent">{String(number).padStart(2, '0')}</span>
      <span className="min-w-0 flex-1 truncate font-display text-xl font-semibold tracking-tight text-ink-muted group-hover:text-ink">Add a track</span>
      <Plus size={18} aria-hidden="true" className="shrink-0 text-accent" />
    </button>
  )
}

/**
 * Names the next track and adds it to the end of the release. The track opens at once, in Upcoming with its Upload
 * over it so the bounces go straight in; in Releases on its empty Final slot, whose final ships it.
 */
export function AddTrackDialog({ release, number }: { release: ReleaseRow; number: number }) {
  const router = useRouter()
  const navigate = useNavigate()
  const { isTouch } = useShellMode()
  const { close } = useAddTrackParam()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const section = sectionOf(release)

  const save = () => {
    if (!title.trim()) return setProblem('Give the track a title.')
    setBusy(true)
    setProblem(null)
    addTrack({ data: { releaseId: release.id, title } })
      .then(async ({ id }) => {
        await router.invalidate()
        const link = trackLink(section, release.id, id)
        void navigate({ ...link, search: section === 'upcoming' ? { upload: true } : {}, replace: true })
      })
      .catch((error) => (setBusy(false), setProblem((error instanceof Error && error.message) || 'Couldn’t add the track. Nothing changed; try again.')))
  }

  return (
    <Composer
      onClose={() => void close()}
      title="Add a track"
      icon={ListPlus}
      eyebrow={
        <>
          <Led breathe={busy} />
          Trk {String(number).padStart(2, '0')} · {release.title}
        </>
      }
      submit={{ label: section === 'upcoming' ? 'Add and upload' : 'Add', icon: Check, onSubmit: save, disabled: !title.trim(), busy, busyLabel: 'Adding…' }}
      className="gap-5 sm:max-w-md"
    >
      <form className="flex flex-col gap-2" onSubmit={(e) => (e.preventDefault(), save())}>
        <label className="flex flex-col gap-2">
          <span className="readout text-ink-muted">Title</span>
          <Input value={title} maxLength={200} autoFocus={!isTouch} disabled={busy} placeholder="Name the track" onChange={(e) => setTitle(e.target.value)} className="font-display text-base font-semibold" />
        </label>
        <p className="text-sm text-ink-muted">{section === 'upcoming' ? 'It goes after the last track; its bounces go in next.' : 'It goes after the last track, waiting on its final.'}</p>
      </form>
      {problem && <p role="alert" className="text-sm text-feedback-error">{problem}</p>}
    </Composer>
  )
}
