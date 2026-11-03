import { Link, type LinkOptions } from '@tanstack/react-router'
import { AudioWaveform, ChevronLeft, ChevronRight, Disc3, Download, File, FlaskConical, Play } from 'lucide-react'

import { isFinal } from '#/server/files'
import { moveBackWindow } from '#/server/shipping'
import type { ReleaseRow, TrackRow, VersionRow } from '#/server/releases'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { downloadUrl } from '../../lib/files'
import { dayOf, deviceZone, formatDay, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { usePlayer } from '../player/Player'
import { Led, Meter, Tip, useHoverSlide } from '../primitives'
import { EmptyState } from '../shared/EmptyState'
import { formatLength } from './browse'
import type { ReleaseData } from './loaders'
import { releaseLink, sectionOf, trackLink } from './sections'
import { KIND_ICON, KIND_LABEL, formatOf, playableOf, sizeOf, stacksOf } from './stacks'

/** The Tracks part: every track's log of bounces. A single is its one track, so its log is the whole part and the
 *  header above already names it. Once it's out, each track holds what shipped; what was set aside is said once. */
export function ReleaseTracks({ release, tracks, versions, pruned, keepDays }: ReleaseData) {
  const section = sectionOf(release)
  if (tracks.length === 0) {
    return (
      <EmptyState title="No tracks yet" readout="Trk 00" flat>
        Its tracks line up here in order, each with every bounce it’s had.
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
            {pruned} older {pruned === 1 ? 'version' : 'versions'} set aside
            {back.until ? ` · erased ${formatDay(dayOf(back.until, zone), todayIn(zone))}` : ''}
          </span>
        </p>
      )}
      {tracks.map((track, i) => (
        <TrackLog
          key={track.id}
          release={release}
          track={track}
          versions={versions}
          number={release.format === 'single' ? null : i + 1}
          link={release.format === 'single' ? undefined : trackLink(section, release.id, track.id)}
        />
      ))}
    </div>
  )
}

/** One track of an EP or album: back to its release's Tracks, then its log. */
export function TrackPage({ release, track, versions, tracks }: ReleaseData & { track: TrackRow }) {
  const section = sectionOf(release)
  return (
    <div className="flex flex-col gap-4">
      <Link {...releaseLink(section, release.id, 'tracks')} className="flex w-fit items-center gap-1 rounded text-[13px] font-medium text-accent hover:underline hover:underline-offset-4">
        <ChevronLeft size={14} aria-hidden="true" />
        All tracks
      </Link>
      <TrackLog release={release} track={track} versions={versions} number={tracks.indexOf(track) + 1} />
    </div>
  )
}

/** A track's log: its number, title and length (not for a single: the page header is its track), then each stack
 *  (Master, Mix…) newest first. */
function TrackLog({ release, track, versions, number, link }: { release: ReleaseRow; track: TrackRow; versions: VersionRow[]; number: number | null; link?: LinkOptions }) {
  const stacks = stacksOf(track, versions)
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
      {stacks.length === 0 ? (
        <p className="px-3 py-3 text-[15px] text-ink-muted">No versions yet. Each bounce stacks on top as it lands.</p>
      ) : (
        <div className="flex flex-col gap-4 py-1">
          {stacks.map(({ kind, versions: stack }) => (
            <Stack key={kind} kind={kind} release={release} track={track} stack={stack} />
          ))}
        </div>
      )}
    </section>
  )
}

function Stack({ kind, release, track, stack }: { kind: string; release: ReleaseRow; track: TrackRow; stack: VersionRow[] }) {
  const slide = useHoverSlide()
  const Icon = KIND_ICON[kind] ?? File
  return (
    <div className="flex flex-col gap-1">
      <h3 className="readout flex items-center gap-2 px-3 text-ink-muted">
        <Icon size={14} aria-hidden="true" className="text-accent-tertiary" />
        {KIND_LABEL[kind] ?? kind}
      </h3>
      <ol className="relative flex flex-col gap-0.5" {...slide.group}>
        {slide.light}
        {stack.map((version) => (
          // Current only means something when there's a choice
          <VersionRow key={version.id} release={release} track={track} version={version} lit={stack.length > 1 && Boolean(version.is_current)} slide={slide.row} />
        ))}
      </ol>
    </div>
  )
}

/**
 * One version, read left to right in the order you'd ask: play it, which one, what changed, then quiet columns
 * (final or test, the day it landed, the original). The filename and size wait in Download's tip; a released stamp
 * shows only in Upcoming, since in Releases everything left is what shipped.
 */
function VersionRow({ release, track, version, lit, slide }: { release: ReleaseRow; track: TrackRow; version: VersionRow; lit: boolean; slide: ReturnType<typeof useHoverSlide>['row'] }) {
  const player = usePlayer()
  const { isCompact } = useShellMode()
  const zone = deviceZone()
  const audio = version.content_type.startsWith('audio/')
  const live = player.item?.versionId === version.id
  const final = isFinal(version.content_type)
  const format = formatOf(version.filename)
  const name = version.note || version.filename.replace(/\.[^.]+$/, '')
  const label = `${KIND_LABEL[version.kind] ?? version.kind} v${version.number}`
  const Icon = KIND_ICON[version.kind] ?? File

  const facts = (
    <span className="flex shrink-0 items-center gap-3">
      <span className={cn('readout flex items-center gap-1.5', audio && final ? 'text-accent' : 'text-ink-muted')}>
        {audio && (final ? <AudioWaveform size={13} aria-hidden="true" /> : <FlaskConical size={13} aria-hidden="true" />)}
        {format}
        {audio && <span className="sr-only">{final ? ', final' : ', test bounce'}</span>}
      </span>
      {version.released_at && sectionOf(release) === 'upcoming' && <Disc3 size={14} role="img" aria-label="Released" className="text-accent-secondary" />}
      <span className={cn('readout text-ink-muted', !isCompact && 'w-14 text-right')}>{formatDay(dayOf(version.created_at, zone), todayIn(zone))}</span>
    </span>
  )

  return (
    <li {...slide} className={cn('group playhead-sweep relative flex min-h-14 items-center gap-2 rounded-2xl pr-1', lit && 'surface-item ring-1 ring-accent/30')}>
      {audio ? (
        <button
          type="button"
          onClick={() => player.play(playableOf(release, track, version, zone))}
          aria-label={live && player.playing ? `Pause ${track.title}, ${label}` : `Play ${track.title}, ${label}`}
          className="press flex size-11 shrink-0 items-center justify-center rounded-full text-accent"
        >
          {live && player.playing ? <Meter live bars={3} /> : <Play size={18} aria-hidden="true" className="translate-x-px fill-current" />}
        </button>
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center text-ink-muted">
          <Icon size={18} aria-hidden="true" />
        </span>
      )}
      <span className={cn('readout flex w-10 shrink-0 items-center gap-1.5', lit || live ? 'text-accent' : 'text-ink-muted')}>
        {lit && <Led />}v{version.number}
        {lit && <span className="sr-only">, current</span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 py-2">
        <span className={cn('truncate text-[15px] font-medium', live ? 'text-accent' : 'text-ink')}>{name}</span>
        {isCompact && facts}
      </span>
      {!isCompact && facts}
      <Tip label={`${version.filename} · ${sizeOf(version.size)}`} side="left">
        <a
          href={downloadUrl(version.id)}
          download={version.filename}
          aria-label={`Download ${version.filename}`}
          className="press flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-accent"
        >
          <Download size={16} aria-hidden="true" />
        </a>
      </Tip>
    </li>
  )
}
