import { Link, type LinkOptions } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, ListMusic, Plus } from 'lucide-react'
import { useState } from 'react'

import { LANES } from '#/server/lanes'
import { moveBackWindow } from '#/server/shipping'
import type { TrackRow } from '#/server/releases'
import { useFileDrop } from '../../hooks/ui/use-file-drop'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { dayOf, deviceZone, formatDay, todayIn } from '../../lib/time'
import { Button, Led, Tip, useHoverSlide } from '../primitives'
import { EmptyState } from '../shared/EmptyState'
import { UploadDialog, useUploadParam } from '../uploads/UploadDialog'
import { UploadRow } from '../uploads/UploadRow'
import { formatLength } from './browse'
import { Lane, useTrack, type TrackState } from './Lane'
import { LaneMenu } from './LaneMenu'
import type { ReleaseData } from './loaders'
import { releaseLink, sectionOf, trackLink } from './sections'
import { VersionRow } from './VersionRow'

/** The Tracks part: every track's lanes. A single is its one track, so its lanes are the whole part and the header
 *  above already names it. Once it's out, each track holds only what shipped; what was set aside is said once. */
export function ReleaseTracks(data: ReleaseData) {
  const { release, tracks, pruned, keepDays } = data
  const section = sectionOf(release)
  // Files dragged over the page light the lanes; one dropped anywhere else is left alone, never opened by the browser.
  const filesOver = useFileDrop(() => {})
  if (tracks.length === 0) {
    return (
      <EmptyState title="No tracks yet" readout="Trk 00" flat>
        Its tracks line up here in order, each with its mixes, masters and final.
      </EmptyState>
    )
  }
  const back = pruned > 0 && release.released_at ? moveBackWindow(release.released_at, keepDays) : null
  const zone = deviceZone()
  return (
    <div className="flex flex-col gap-4">
      {back && (
        <p className="flex items-center gap-2 px-2 text-sm text-ink-muted">
          <Led tone="tube" />
          <span data-numeric>
            {pruned} {pruned === 1 ? 'version' : 'versions'} set aside
            {back.until ? ` · erased ${formatDay(dayOf(back.until, zone), todayIn(zone))}` : ''}
          </span>
        </p>
      )}
      {tracks.map((track, i) => (
        <TrackLanes
          key={track.id}
          data={data}
          track={track}
          number={release.format === 'single' ? null : i + 1}
          link={release.format === 'single' ? undefined : trackLink(section, release.id, track.id)}
          filesOver={filesOver}
          uploads={release.format === 'single'}
        />
      ))}
    </div>
  )
}

/** One track of an EP or album: back to its release's Tracks, then its lanes. */
export function TrackPage(data: ReleaseData & { track: TrackRow }) {
  const section = sectionOf(data.release)
  const filesOver = useFileDrop(() => {})
  return (
    <div className="flex flex-col gap-4">
      <Link {...releaseLink(section, data.release.id, 'tracks')} className="flex w-fit items-center gap-1 rounded text-[13px] font-medium text-accent hover:underline hover:underline-offset-4">
        <ChevronLeft size={14} aria-hidden="true" />
        All tracks
      </Link>
      <TrackLanes data={data} track={data.track} number={data.tracks.indexOf(data.track) + 1} filesOver={filesOver} uploads />
    </div>
  )
}

/**
 * A track: its number, title and length (not for a single: the page header is its track), then, in Upcoming, its
 * lanes top to bottom (Final, Masters, Mixes: up is closer to release) and its alternates. In Releases it holds what
 * shipped and nothing else: the final and its alternates, one row each, or the empty Final slot. `uploads`: it's the
 * page's one track, so the header's Upload (`?upload`) opens over it.
 */
function TrackLanes({ data, track, number, link, filesOver, uploads }: { data: ReleaseData; track: TrackRow; number: number | null; link?: LinkOptions; filesOver: boolean; uploads?: boolean }) {
  const t = useTrack(data, track)
  const upload = useUploadParam()
  const slide = useHoverSlide()
  const { lanes } = t
  // The trace is lit from the bottom lane up to the highest one holding something.
  const highest = LANES.findIndex((lane) => (lane === 'final' ? lanes.final : lanes[lane].length > 0))
  const heading = number !== null && (
    <>
      <span className="readout w-6 shrink-0 text-accent">{String(number).padStart(2, '0')}</span>
      <h2 className="min-w-0 flex-1 truncate font-display text-xl font-semibold tracking-tight">{track.title}</h2>
      {track.duration_ms ? (
        <span data-numeric className="shrink-0 text-sm text-ink-soft">
          {formatLength(track.duration_ms)}
        </span>
      ) : null}
    </>
  )
  return (
    <section aria-label={track.title} className="surface-card rounded-3xl p-2 sm:p-3">
      {heading &&
        (link ? (
          <Link {...link} className="group press flex min-h-12 items-center gap-3 rounded-2xl px-3 transition-colors hover:bg-accent-dim">
            {heading}
            <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-ink-muted transition-[translate,color] group-hover:translate-x-0.5 group-hover:text-accent" />
          </Link>
        ) : (
          <div className="flex min-h-12 items-center gap-3 px-3">{heading}</div>
        ))}
      {t.section === 'upcoming' ? (
        <div className="flex flex-col gap-2 py-1">
          {LANES.map((lane, i) => (
            <Lane key={lane} t={t} lane={lane} lit={highest !== -1 && i >= highest} filesOver={filesOver} />
          ))}
          <Alternates t={t} />
        </div>
      ) : lanes.final ? (
        <ol className="relative flex flex-col gap-0.5 py-1" {...slide.group}>
          {slide.light}
          <VersionRow t={t} version={lanes.final} slide={slide.row} />
          {lanes.alternates.map((a) => (
            <VersionRow key={a.kind} t={t} version={a.top} slide={slide.row} />
          ))}
        </ol>
      ) : (
        <div className="py-1">
          <Lane t={t} lane="final" lit={false} filesOver={filesOver} />
        </div>
      )}
      {t.picker}
      {uploads && upload.open && t.section === 'upcoming' && <UploadDialog t={t} />}
      <p aria-live="polite" className="sr-only">{t.said}</p>
    </section>
  )
}

const ALTERNATE_CHOICES = ['instrumental', 'acapella'] as const

/** A track's alternates under its lanes, one row per kind (its newest), the rare earlier ones folded under it. They come
 *  after the final, so before there's a final or an alternate it's one quiet Add button. They don't move. */
function Alternates({ t }: { t: TrackState }) {
  const { isCompact } = useShellMode()
  const slide = useHoverSlide()
  const [unfolded, setUnfolded] = useState<string | null>(null)
  const { alternates, final } = t.lanes
  const pending = t.uploads.pending.filter((p) => (ALTERNATE_CHOICES as readonly string[]).includes(p.target) && !p.replaces)
  // Labelled unless it shares a lane header on a phone; alone on its row there's room to say it.
  const add = (labelled: boolean) => (
    <LaneMenu title="Add an alternate" value={null} options={ALTERNATE_CHOICES} onChange={(target) => t.pick(target)}>
      <Button variant="ghost" size="sm" aria-label={labelled ? undefined : 'Add an alternate'} className="shrink-0 gap-1.5">
        <Plus size={15} aria-hidden="true" />
        {labelled && 'Add an alternate'}
      </Button>
    </LaneMenu>
  )
  if (!alternates.length && !pending.length && !final) return <div className="flex justify-end">{add(true)}</div>
  return (
    <section aria-label="Alternates" className="relative flex flex-col gap-0.5 pl-4">
      <span aria-hidden="true" className="absolute top-2 bottom-2 left-1.5 w-px rounded-full bg-line-strong" />
      <header className="flex min-h-11 items-center gap-2 pl-1">
        <h3 className="readout flex flex-1 items-center gap-2 text-ink-muted">
          <ListMusic size={14} aria-hidden="true" className="text-accent-tertiary" />
          Alternates
        </h3>
        {isCompact ? <Tip label="Add an alternate">{add(false)}</Tip> : add(true)}
      </header>
      <ol className="relative flex flex-col gap-0.5" {...slide.group}>
        {slide.light}
        {pending.map((p) => (
          <UploadRow key={p.key} pending={p} onRetry={() => t.uploads.retry(p.key)} onDismiss={() => t.uploads.dismiss(p.key)} />
        ))}
        {alternates.flatMap(({ kind, top, earlier }) => [
          <VersionRow key={top.id} t={t} version={top} slide={slide.row} />,
          ...(earlier.length
            ? [
                <li key={`${kind}-earlier`}>
                  <button type="button" onClick={() => setUnfolded(unfolded === kind ? null : kind)} aria-expanded={unfolded === kind} className="press readout min-h-11 rounded-lg px-14 text-ink-muted hover:text-accent">
                    {unfolded === kind ? 'Fold' : `${earlier.length} earlier`}
                  </button>
                </li>,
              ]
            : []),
          ...(unfolded === kind ? earlier.map((v) => <VersionRow key={v.id} t={t} version={v} slide={slide.row} />) : []),
        ])}
      </ol>
      {t.message && (ALTERNATE_CHOICES as readonly string[]).includes(t.message.target) && <p role="status" className="px-3 pb-2 text-[13px] text-ink-soft">{t.message.text}</p>}
    </section>
  )
}
