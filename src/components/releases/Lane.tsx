import { useRouter } from '@tanstack/react-router'
import { ChevronDown, Plus } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

import { AUDIO_ACCEPT, FINAL_ACCEPT, isFinal } from '#/server/files'
import { laneOf, lanesOf, moveProblem, type Lane as LaneName } from '#/server/lanes'
import { fileVersion, type TrackRow, type VersionRow as Version } from '#/server/releases'
import { useDropTarget } from '../../hooks/ui/use-drop-target'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { deviceZone, formatMoment, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button, Tip, useHoverSlide } from '../primitives'
import * as DropdownMenu from '../primitives/DropdownMenu'
import { UploadRow } from '../uploads/UploadRow'
import { sortDrop, useLaneUpload, type Target } from '../uploads/use-lane-upload'
import { TARGET_ICON } from './LaneMenu'
import type { ReleaseData } from './loaders'
import { sectionOf } from './sections'
import { VersionRow } from './VersionRow'

const errorOf = (error: unknown, fallback: string) => (error instanceof Error && error.message) || fallback

/** What's said after a move, for a screen reader: nothing leaves the screen, so there's no toast. */
function announce(version: Version, to: LaneName, oldFinal: Version | null) {
  if (to === 'final') return `v${version.number} is the final.${oldFinal && oldFinal.id !== version.id ? ` v${oldFinal.number} is back in Masters.` : ''}`
  return `v${version.number} is in ${to === 'master' ? 'Masters' : 'Mixes'}.${version.is_final ? ' The track has no final now.' : ''}`
}

/**
 * One track's lanes and everything that acts on them, shared by its lanes, rows and the Move dialog: the uploads
 * queue, the version being dragged, the one message the track is showing (a refusal, what a drop left out), the
 * picker, and `move`, which files a version through `fileVersion` after the same check the server makes.
 */
export function useTrack(data: ReleaseData, track: TrackRow) {
  const router = useRouter()
  const section = sectionOf(data.release)
  const lanes = lanesOf(track.id, data.versions)
  const uploads = useLaneUpload(track.id)
  const [dragged, setDragged] = useState<Version | null>(null)
  const [said, setSaid] = useState('')
  const [message, setMessage] = useState<{ target: Target; text: string; wavOf?: Version } | null>(null)
  const [moving, setMoving] = useState(false)
  // The version focus follows into its new lane; its row takes focus once it lands there.
  const [follow, setFollow] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const picking = useRef<{ target: Target; onFiles?: (files: File[]) => void }>({ target: 'mix' })

  /** Files dropped or picked for a target: sorted (`sortDrop`), queued, and whatever was left out said in its lane. */
  const send = (files: File[], target: Target) => {
    const { send, note } = sortDrop(files, target)
    const wavOf = message?.wavOf && target === 'final' ? message.wavOf : undefined
    setMessage(note ? { target, text: note } : null)
    if (send.length) uploads.add(send, { note: wavOf ? `Final of v${wavOf.number}` : undefined })
  }

  const move = async (version: Version, to: LaneName) => {
    if (version.track_id !== track.id) return setMessage({ target: to, text: 'A version stays with its song.' })
    const problem = moveProblem(version, to, section)
    if (problem) return setMessage({ target: to, text: problem, wavOf: to === 'final' && !isFinal(version.content_type) ? version : undefined })
    if (laneOf(version) === to) return
    setMessage(null)
    setMoving(true)
    try {
      await fileVersion({ data: { versionId: version.id, to } })
      await router.invalidate()
      setSaid(announce(version, to, lanes.final))
      setFollow(version.id)
    } catch (error) {
      setMessage({ target: to, text: errorOf(error, 'Couldn’t move it. Nothing changed; try again.') })
    } finally {
      setMoving(false)
    }
  }

  return {
    data,
    release: data.release,
    track,
    section,
    lanes,
    uploads,
    dragged,
    setDragged,
    said,
    message,
    setMessage,
    moving,
    follow,
    send,
    move,
    /** Opens the picker for a target; `onFiles` takes the files instead of sending them (Replace asks first). */
    pick: (target: Target, onFiles?: (files: File[]) => void) => {
      picking.current = { target, onFiles }
      input.current!.accept = target === 'final' ? FINAL_ACCEPT : AUDIO_ACCEPT
      input.current!.multiple = !onFiles
      input.current!.click()
    },
    picker: (
      <input
        ref={input}
        type="file"
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = '' // the same file can be picked again
          const { target, onFiles } = picking.current
          if (files.length) (onFiles ? onFiles(files) : send(files, target))
        }}
      />
    ),
  }
}
export type TrackState = ReturnType<typeof useTrack>

const LANE: Record<LaneName, { title: string; add: string; empty: string; over: string }> = {
  final: { title: 'Final', add: 'Add the final', empty: 'No final yet. Drop its WAV here, or drag a master in.', over: 'Drop to make it the final' },
  master: { title: 'Masters', add: 'Add a master', empty: 'Drop a master here', over: 'Drop to make it a master' },
  mix: { title: 'Mixes', add: 'Add a mix', empty: 'Drop a mix here', over: 'Drop to make it a mix' },
}
const RELEASED_EMPTY = 'No final yet. Drop its WAV, AIFF or FLAC here, or click to choose.'
const KEEP = { 7: 'a week', 14: 'two weeks', 30: 'a month' } as const
const FOLD = 3

/**
 * One lane of a track: its header (the lane's icon, name and count, what a drop would do, and Add), the files on
 * their way into it, then its versions newest first, folded to the newest three. A drop target for files from the
 * desktop and for versions dragged from the track's other lanes; a lane that won't take what's dragged dims and says
 * why. The Final lane holds one row; empty, it's a slot you drop on or click, with Pick when there's a lossless bounce.
 * `released`: only the empty final slot, whose final ships the track. `compact`: the Move dialog's, under `heading`.
 */
export function Lane({ t, lane, lit, filesOver, size = 'page', heading }: { t: TrackState; lane: LaneName; lit?: boolean; filesOver?: boolean; size?: 'page' | 'compact'; heading?: ReactNode }) {
  const { isCompact } = useShellMode()
  const slide = useHoverSlide()
  const zone = deviceZone()
  const [unfolded, setUnfolded] = useState(false)
  const { lanes, dragged, section } = t
  const rows = lane === 'final' ? (lanes.final ? [lanes.final] : []) : lanes[lane]
  const pending = t.uploads.pending.filter((p) => p.target === lane && !p.replaces)
  const shown = unfolded ? rows : rows.slice(0, FOLD)
  const message = t.message?.target === lane ? t.message : null
  // What a drag means here: the version being dragged (from this track), and whether this lane takes it.
  const moving = dragged && laneOf(dragged) !== lane ? dragged : null
  const refusal = moving && moveProblem(moving, lane, section)
  const drop = useDropTarget({
    onFiles: (files) => t.send(files, lane),
    onVersion: refusal || section === 'released' ? undefined : (id) => void t.move(t.data.versions.find((v) => v.id === id) ?? ({ id } as Version), lane),
    enabled: !t.moving,
  })
  const over = drop.over ?? (moving && !refusal ? 'version' : filesOver ? 'files' : null)
  const hint = refusal ? refusal : over === 'version' ? LANE[lane].over : over === 'files' ? (lane === 'final' ? 'Drop its WAV to make it the final' : `Drop to add ${lane === 'mix' ? 'a mix' : 'a master'}`) : null
  const Icon = TARGET_ICON(lane)
  const empty = rows.length === 0 && pending.length === 0
  // Pick: the track's lossless bounces, newest first, any of which can be its final.
  const pickable = lane === 'final' ? [...lanes.master, ...lanes.mix].filter((v) => isFinal(v.content_type)).sort((a, b) => b.number - a.number) : []
  const others = lanes.master.length + lanes.mix.length
  const keep = t.data.keepDays

  return (
    <section
      aria-label={heading ? undefined : LANE[lane].title}
      {...drop.props}
      className={cn(
        'relative flex flex-col gap-0.5 rounded-2xl pl-4 transition-[background-color,box-shadow,opacity] duration-(--duration-normal)',
        drop.over && 'bg-accent-dim ring-1 ring-accent/50 glow-accent',
        !drop.over && over && 'ring-1 ring-accent/25',
        refusal && 'opacity-55',
      )}
    >
      {/* The signal trace: lit from the bottom lane up to the highest that holds something. */}
      <span aria-hidden="true" className={cn('absolute top-2 bottom-2 left-1.5 w-px rounded-full transition-colors', lit ? 'bg-accent/70 shadow-[0_0_6px_var(--accent)]' : 'bg-line-strong')} />
      <header className="flex min-h-11 items-center gap-2 pl-1">
        {heading ?? (
          <h3 className="readout flex shrink-0 items-center gap-2 text-ink-muted">
            <Icon size={14} aria-hidden="true" className={lane === 'final' ? 'text-accent' : 'text-accent-tertiary'} />
            {LANE[lane].title}
            {lane !== 'final' && rows.length > 0 && <span data-numeric>· {rows.length}</span>}
          </h3>
        )}
        <span aria-live="polite" className={cn('min-w-0 flex-1 truncate text-[13px]', refusal ? 'text-ink-soft' : 'text-accent')}>
          {hint}
        </span>
        {empty && pickable.length > 0 && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="sm" className="gap-1" disabled={t.moving}>
                Pick
                <ChevronDown size={13} aria-hidden="true" className="opacity-70" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className="min-w-[15rem]">
              <p className="readout px-3 pt-2 pb-1 text-ink-muted">Lossless · newest first</p>
              {pickable.map((v) => (
                <DropdownMenu.Item key={v.id} onSelect={() => void t.move(v, 'final')} className="gap-2">
                  <span className="readout w-8 text-accent">v{v.number}</span>
                  <span className="min-w-0 flex-1 truncate">{v.note || v.filename}</span>
                  <span className="text-xs whitespace-nowrap text-ink-muted">{formatMoment(v.created_at, zone, todayIn(zone))}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
        {section === 'upcoming' && (lane !== 'final' || empty) && (
          <Tip label={LANE[lane].add} disabled={!isCompact}>
            <Button variant="ghost" size="sm" onClick={() => t.pick(lane)} aria-label={isCompact ? LANE[lane].add : undefined} className="shrink-0 gap-1.5">
              <Plus size={15} aria-hidden="true" />
              {!isCompact && LANE[lane].add}
            </Button>
          </Tip>
        )}
      </header>

      {(pending.length > 0 || shown.length > 0) && (
        <ol className="relative flex flex-col gap-0.5" {...slide.group}>
          {slide.light}
          {pending.map((p) => (
            <UploadRow key={p.key} pending={p} onRetry={() => t.uploads.retry(p.key)} onDismiss={() => t.uploads.dismiss(p.key)} />
          ))}
          {shown.map((version) => (
            <VersionRow key={version.id} t={t} version={version} slide={slide.row} compact={size === 'compact'} />
          ))}
        </ol>
      )}
      {rows.length > FOLD && (
        <button type="button" onClick={() => setUnfolded(!unfolded)} aria-expanded={unfolded} className="press readout min-h-11 w-fit rounded-lg px-3 text-ink-muted hover:text-accent">
          {unfolded ? 'Fold' : `${rows.length - FOLD} earlier`}
        </button>
      )}
      {empty &&
        (lane === 'final' ? (
          <button
            type="button"
            onClick={() => t.pick('final')}
            className={cn('press surface-row flex min-h-14 flex-col justify-center gap-0.5 rounded-2xl px-4 text-left text-[15px] text-ink-soft ring-1 ring-line transition-colors hover:text-ink hover:ring-accent/40', size === 'compact' && 'min-h-12 text-sm')}
          >
            {section === 'released' ? RELEASED_EMPTY : LANE.final.empty}
            {section === 'released' && others > 0 && (
              <span className="text-[13px] text-ink-muted">
                Its {others} other {others === 1 ? 'version is' : 'versions are'} set aside{keep ? ` and erased after ${KEEP[keep]}` : ''}.
              </span>
            )}
          </button>
        ) : (
          <p className="px-3 pb-2 text-sm text-ink-muted">{LANE[lane].empty}</p>
        ))}
      {message && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-1 pb-2 text-[13px] text-ink-soft">
          {message.wavOf ? `v${message.wavOf.number} is a test, so its WAV is the final.` : message.text}
          {message.wavOf && (
            <Button variant="secondary" size="sm" onClick={() => t.pick('final')}>
              Send its WAV
            </Button>
          )}
        </p>
      )}
    </section>
  )
}
