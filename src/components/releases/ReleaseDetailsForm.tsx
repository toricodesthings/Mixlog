import { useRouter } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'

import { isrcOf, upcOf } from '#/server/details'
import { updateRelease, type ReleaseFormat } from '#/server/releases'
import { deviceZone, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button, Input, Led } from '../primitives'
import { SegmentedControl } from '../primitives/SegmentedControl'
import type { ReleaseData } from './loaders'
import { FORMAT_LABEL, sectionOf } from './sections'

const FORMATS = (['single', 'ep', 'album'] as const).map((value) => ({ value, label: FORMAT_LABEL[value] }))

/**
 * Details: the bookkeeping, laid out like a distributor's form so it reads straight down. Upcoming asks only what
 * a release in progress has (title, format, the day it's planned for); Releases adds the release day, UPC and ISRCs.
 * Every field is optional but the title (and a release's day); nothing waits on them. Saved together, on Save.
 */
export function ReleaseDetailsForm({ release, tracks }: ReleaseData) {
  const router = useRouter()
  const released = sectionOf(release) === 'released'
  const today = todayIn(deviceZone())
  const initial = {
    title: release.title,
    format: release.format,
    releaseDate: release.release_date ?? '',
    upc: release.upc ?? '',
    tracks: tracks.map((t) => ({ id: t.id, title: t.title, isrc: t.isrc ?? '' })),
  }
  const [form, setForm] = useState(initial)
  const [state, setState] = useState<{ status: 'idle' | 'saving' | 'saved' } | { status: 'failed'; message: string }>({ status: 'idle' })
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const change = (next: Partial<typeof form>) => (setForm((f) => ({ ...f, ...next })), setState({ status: 'idle' }))
  const changeTrack = (id: string, next: { title?: string; isrc?: string }) =>
    change({ tracks: form.tracks.map((t) => (t.id === id ? { ...t, ...next } : t)) })
  const single = form.format === 'single'

  const save = async () => {
    setState({ status: 'saving' })
    try {
      await updateRelease({ data: { id: release.id, ...form, released, zone: deviceZone() } })
      await router.invalidate()
      setState({ status: 'saved' })
    } catch (error) {
      setState({ status: 'failed', message: (error instanceof Error && error.message) || 'Couldn’t save. Nothing changed; try again.' })
    }
  }

  return (
    <form
      className="mx-auto flex max-w-3xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Sheet title="Release" readout={released ? 'Out · as shipped' : 'In progress'}>
        <Field label="Title">
          <Input value={form.title} maxLength={200} required onChange={(e) => change({ title: e.target.value })} className="font-display text-base font-semibold" />
        </Field>
        <Field label="Format">
          <div>
            <SegmentedControl ariaLabel="Format" value={form.format} onChange={(format: ReleaseFormat) => change({ format })} options={FORMATS} size="sm" />
          </div>
          {single && tracks.length > 1 && <p className="text-[13px] text-ink-muted">A single has one track: this one has {tracks.length}, so keep it an EP or album.</p>}
        </Field>
        <Field label={released ? 'Release day' : 'Planned release day'} hint={released ? undefined : 'Optional. Nothing is late without one.'}>
          <Input type="date" value={form.releaseDate} max={released ? today : undefined} required={released} onChange={(e) => change({ releaseDate: e.target.value })} className="w-auto" />
        </Field>
        {released && (
          <Field label="UPC" hint="12 digits, or 13 for an EAN. From your distributor." problem={form.upc && !upcOf(form.upc) ? 'That isn’t a UPC yet.' : null}>
            <Input value={form.upc} inputMode="numeric" autoComplete="off" placeholder="000000000000" onChange={(e) => change({ upc: e.target.value })} className="w-auto font-mono tracking-wider" />
          </Field>
        )}
      </Sheet>

      {(released || !single) && form.tracks.length > 0 && (
        <Sheet title="Tracks" readout={released ? 'Titles · ISRCs' : 'Titles'}>
          <ol className="flex flex-col gap-2">
            {form.tracks.map((track, i) => (
              <li key={track.id} className="surface-item flex flex-wrap items-center gap-3 rounded-2xl p-3">
                <span className="readout w-6 shrink-0 text-accent">{String(i + 1).padStart(2, '0')}</span>
                {single ? (
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{form.title}</span>
                ) : (
                  <Input aria-label={`Track ${i + 1} title`} value={track.title} maxLength={200} required onChange={(e) => changeTrack(track.id, { title: e.target.value })} className="h-10 min-w-40 flex-1" />
                )}
                {released && (
                  <Input
                    aria-label={`Track ${i + 1} ISRC`}
                    aria-invalid={Boolean(track.isrc && !isrcOf(track.isrc))}
                    value={track.isrc}
                    autoComplete="off"
                    placeholder="ISRC  CC-XXX-YY-NNNNN"
                    onChange={(e) => changeTrack(track.id, { isrc: e.target.value })}
                    className={cn('h-10 w-56 font-mono text-[13px] tracking-wider uppercase', track.isrc && !isrcOf(track.isrc) && 'border-feedback-error/60')}
                  />
                )}
              </li>
            ))}
          </ol>
        </Sheet>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 px-1">
        {state.status === 'failed' && <p role="alert" className="mr-auto text-[13px] text-feedback-error">{state.message}</p>}
        {state.status === 'saved' && !dirty && (
          <p className="readout mr-auto flex items-center gap-2 text-ink-muted" aria-live="polite">
            <Led />
            Saved
          </p>
        )}
        {dirty && (
          <Button type="button" variant="ghost" onClick={() => (setForm(initial), setState({ status: 'idle' }))}>
            Undo changes
          </Button>
        )}
        <Button type="submit" disabled={!dirty || state.status === 'saving'} aria-busy={state.status === 'saving'}>
          {state.status === 'saving' ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}

/** One part of the form, like a page of a distributor's: a title, its channel-strip readout, its fields. */
function Sheet({ title, readout, children }: { title: string; readout: string; children: ReactNode }) {
  return (
    <section className="surface-card flex flex-col gap-5 rounded-3xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        <p className="readout text-ink-muted">{readout}</p>
      </div>
      {children}
    </section>
  )
}

function Field({ label, hint, problem, children }: { label: string; hint?: string; problem?: string | null; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="readout text-ink-muted">{label}</span>
      {children}
      {problem ? <span className="text-[13px] text-feedback-error">{problem}</span> : hint && <span className="text-[13px] text-ink-muted">{hint}</span>}
    </label>
  )
}
