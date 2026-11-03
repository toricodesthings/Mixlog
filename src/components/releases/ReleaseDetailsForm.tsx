import { useNavigate, useRouter } from '@tanstack/react-router'
import { Album, Check, Disc3, Music, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { isrcOf, needsLicense, upcOf } from '#/server/details'
import { updateRelease, type ReleaseFormat, type TrackOrigin } from '#/server/releases'
import { deviceZone, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button, Input, Led, Tuning } from '../primitives'
import { SegmentedControl } from '../primitives/SegmentedControl'
import { LicenseControl, LicenseDialog } from './LicenseControl'
import type { ReleaseData } from './loaders'
import { LyricsPanel } from './LyricsPanel'
import { FORMAT_LABEL, SECTIONS, sectionOf } from './sections'
import { licensesOf } from './stacks'

/** The form's id, so Save and exit (in the release's panel) can submit it from outside. */
export const DETAILS_FORM = 'release-details'

const FORMATS: { value: ReleaseFormat; icon: LucideIcon; size: string }[] = [
  { value: 'single', icon: Music, size: 'One track' },
  { value: 'ep', icon: Disc3, size: 'A few tracks' },
  { value: 'album', icon: Album, size: 'A full record' },
]
const ORIGINS = [
  { value: 'original', label: 'Original' },
  { value: 'cover', label: 'Cover' },
  { value: 'remix', label: 'Remix' },
] as const

/**
 * Details: the bookkeeping, laid out like a distributor's form so it reads straight down. Upcoming asks only what
 * a release in progress has (title, format, the day it's planned for); Releases adds the release day, UPC and ISRCs.
 * Every field is optional but the title (and a release's day); nothing waits on them. Saved together, on Save; lyrics save themselves as they're written.
 */
export function ReleaseDetailsForm({ release, tracks, versions }: ReleaseData) {
  const router = useRouter()
  const navigate = useNavigate()
  const released = sectionOf(release) === 'released'
  const today = todayIn(deviceZone())
  const initial = {
    title: release.title,
    format: release.format,
    releaseDate: release.release_date ?? '',
    upc: release.upc ?? '',
    tracks: tracks.map((t) => ({ id: t.id, title: t.title, isrc: t.isrc ?? '', origin: t.origin })),
  }
  const [form, setForm] = useState(initial)
  const [state, setState] = useState<{ status: 'idle' | 'saving' | 'saved' } | { status: 'failed'; message: string }>({ status: 'idle' })
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const change = (next: Partial<typeof form>) => (setForm((f) => ({ ...f, ...next })), setState({ status: 'idle' }))
  const changeTrack = (id: string, next: Partial<(typeof form.tracks)[number]>) =>
    change({ tracks: form.tracks.map((t) => (t.id === id ? { ...t, ...next } : t)) })
  const single = form.format === 'single'
  // One track: whose song it is goes for the whole release, so it's asked once, up here
  const sole = form.tracks.length === 1 ? form.tracks[0] : null

  /** Saves (when there's a change), then leaves for the release's list if `exit`. A failure stays, and says why. */
  const save = async (exit = false) => {
    if (dirty) {
      setState({ status: 'saving' })
      try {
        await updateRelease({ data: { id: release.id, ...form, released, zone: deviceZone() } })
        await router.invalidate()
        setState({ status: 'saved' })
      } catch (error) {
        return setState({ status: 'failed', message: (error instanceof Error && error.message) || 'Couldn’t save. Nothing changed; try again.' })
      }
    }
    if (exit) void navigate(SECTIONS[sectionOf(release)].index)
  }

  return (
    <>
    <form
      id={DETAILS_FORM}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save((e.nativeEvent as SubmitEvent).submitter?.hasAttribute('data-exit'))
      }}
    >
      <Sheet title="Release" readout={released ? 'Out · as shipped' : 'In progress'}>
        <Field label="Title" className="md:col-span-full">
          <Input value={form.title} maxLength={200} required onChange={(e) => change({ title: e.target.value })} className="font-display text-base font-semibold" />
        </Field>
        <FormatPicker value={form.format} onChange={(format) => change({ format })} tracks={tracks.length} />
        <Field label={released ? 'Release day' : 'Planned release day'} hint={released ? undefined : 'Optional. Nothing is late without one.'}>
          <Input type="date" value={form.releaseDate} max={released ? today : undefined} required={released} onChange={(e) => change({ releaseDate: e.target.value })} />
        </Field>
        {released && (
          <Field label="UPC" hint="12 digits, or 13 for an EAN. From your distributor." problem={form.upc && !upcOf(form.upc) ? 'That isn’t a UPC yet.' : null}>
            <Input value={form.upc} inputMode="numeric" autoComplete="off" placeholder="000000000000" onChange={(e) => change({ upc: e.target.value })} className="font-mono tracking-wider" />
          </Field>
        )}
        {sole && (
          <Field label="Origin" as="div" hint={needsLicense(sole.origin) ? undefined : 'Your own song. A cover or a remix carries its license.'}>
            <OriginControl origin={sole.origin} onChange={(origin) => changeTrack(sole.id, { origin })} label="Origin" licenses={licensesOf(sole.id, versions)} trackId={sole.id} />
          </Field>
        )}
      </Sheet>

      {form.tracks.length > 0 && (
        <Sheet title="Tracks" readout={released ? 'Titles · ISRCs · Lyrics' : 'Titles · Lyrics'}>
          <ol className="flex flex-col gap-2 md:col-span-full">
            {form.tracks.map((track, i) => (
              <li key={track.id} className="surface-item flex flex-col gap-3 rounded-2xl p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="readout w-6 shrink-0 text-accent">{String(i + 1).padStart(2, '0')}</span>
                  {single ? (
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{form.title}</span>
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
                  {!sole && <OriginControl origin={track.origin} onChange={(origin) => changeTrack(track.id, { origin })} label={`Track ${i + 1} origin`} licenses={licensesOf(track.id, versions)} trackId={track.id} />}
                </div>
                <LyricsPanel trackId={track.id} title={single ? form.title : track.title} initial={tracks[i].lyrics ?? ''} />
              </li>
            ))}
          </ol>
        </Sheet>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 px-1">
        {state.status === 'failed' && <p role="alert" className="mr-auto text-sm text-feedback-error">{state.message}</p>}
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
          {state.status === 'saving' && <Tuning className="text-current" />}
          {state.status === 'saving' ? 'Saving' : 'Save'}
        </Button>
      </div>
    </form>
    <LicenseDialog tracks={tracks} versions={versions} />
    </>
  )
}

/** One part of the form, like a page of a distributor's: a title, its channel-strip readout, its fields (side by side
 *  where there's room, so a wide screen reads across instead of leaving half the sheet empty). */
function Sheet({ title, readout, children }: { title: string; readout: string; children: ReactNode }) {
  return (
    <section className="surface-card flex flex-col gap-5 rounded-3xl p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
        <p className="readout text-ink-muted">{readout}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

/** A labelled field. `as="div"` for a group of controls, which names itself (a label can hold only one). */
function Field({ label, hint, problem, className, as: Tag = 'label', children }: { label: string; hint?: string; problem?: string | null; className?: string; as?: 'label' | 'div'; children: ReactNode }) {
  return (
    <Tag className={cn('flex flex-col gap-2', className)}>
      <span className="readout text-ink-muted">{label}</span>
      {children}
      {problem ? <span className="text-sm text-feedback-error">{problem}</span> : hint && <span className="text-sm text-ink-muted">{hint}</span>}
    </Tag>
  )
}

/** The format as three panels, each its own icon: radios underneath, so arrows and a screen reader work as ever.
 *  A single holds one track, so it can't be picked while the release has more. */
function FormatPicker({ value, onChange, tracks }: { value: ReleaseFormat; onChange: (format: ReleaseFormat) => void; tracks: number }) {
  return (
    <fieldset className="flex flex-col gap-2 md:col-span-full">
      <legend className="readout mb-2 text-ink-muted">Format</legend>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {FORMATS.map(({ value: format, icon: Icon, size }) => {
          const locked = format === 'single' && tracks > 1
          return (
            <label
              key={format}
              className={cn(
                'surface-item group relative flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border border-line/40 px-2 py-4 text-center transition-[border-color,background-color,box-shadow] duration-200 hover:border-line sm:py-5',
                'has-checked:border-accent/60 has-checked:bg-accent/[0.07] has-checked:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]',
                'has-focus-visible:ring-2 has-focus-visible:ring-accent/50',
                locked && 'cursor-not-allowed opacity-45 hover:border-line/40',
              )}
            >
              <input type="radio" name="format" value={format} checked={value === format} disabled={locked} onChange={() => onChange(format)} className="peer sr-only" />
              <span className="flex size-11 items-center justify-center rounded-xl bg-white/[0.05] text-ink-muted transition-colors duration-200 group-has-checked:bg-accent group-has-checked:text-room-void">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="font-display text-[15px] font-semibold text-ink-soft group-has-checked:text-ink">{FORMAT_LABEL[format]}</span>
              <span className="text-xs text-ink-muted">{locked ? `This one has ${tracks}` : size}</span>
              <Check size={14} strokeWidth={3} aria-hidden="true" className="absolute top-2.5 right-2.5 hidden rounded-full bg-accent p-0.5 text-room-void group-has-checked:block size-[18px]" />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Original, cover or remix; a cover or a remix gets its License beside it. One already there stays in reach
 *  whatever the origin says: a license is never hidden by a change of mind. */
function OriginControl({ origin, onChange, label, trackId, licenses }: { origin: TrackOrigin; onChange: (origin: TrackOrigin) => void; label: string; trackId: string; licenses: ReturnType<typeof licensesOf> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl ariaLabel={label} value={origin} onChange={onChange} options={ORIGINS} size="sm" />
      {(needsLicense(origin) || licenses.length > 0) && <LicenseControl trackId={trackId} licenses={licenses} />}
    </div>
  )
}
