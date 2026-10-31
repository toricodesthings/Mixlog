import { Link, type LinkOptions } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { isFinal } from '#/server/files'
import type { TrackRow, VersionRow } from '#/server/releases'
import { dayOf, deviceZone, formatDay, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Led } from '../primitives'
import { EmptyState } from '../shared/EmptyState'
import { MetaLine } from '../shared/MetaLine'
import { formatLength } from './browse'
import type { ReleaseData } from './loaders'
import { releaseLink, sectionOf, trackLink } from './sections'
import { KIND_LABEL, formatOf, stacksOf } from './stacks'

const sizeOf = (bytes: number) => (bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`)

/** The Tracks part: every track's log of bounces. A single is its one track, so its log is the whole part. */
export function ReleaseTracks({ release, tracks, versions }: ReleaseData) {
  const section = sectionOf(release)
  if (tracks.length === 0) {
    return (
      <EmptyState title="No tracks yet" readout="Trk 00" flat>
        Its tracks line up here in order, each with every bounce it’s had.
      </EmptyState>
    )
  }
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      {tracks.map((track, i) => (
        <TrackLog
          key={track.id}
          track={track}
          versions={versions}
          number={i + 1}
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
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link {...releaseLink(section, release.id, 'tracks')} className="flex w-fit items-center gap-1 rounded text-[13px] font-medium text-accent hover:underline hover:underline-offset-4">
        <ChevronLeft size={14} aria-hidden="true" />
        All tracks
      </Link>
      <TrackLog track={track} versions={versions} number={tracks.indexOf(track) + 1} />
    </div>
  )
}

/** A track's log: each stack (Master, Mix…) newest first, its current version lit, what shipped stamped. */
function TrackLog({ track, versions, number, link }: { track: TrackRow; versions: VersionRow[]; number: number; link?: LinkOptions }) {
  const stacks = stacksOf(track, versions)
  const heading = (
    <>
      <span className="readout w-6 shrink-0 text-accent">{String(number).padStart(2, '0')}</span>
      <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold tracking-tight">{track.title}</h2>
      {track.duration_ms ? (
        <span data-numeric className="shrink-0 text-[13px] text-ink-soft">
          {formatLength(track.duration_ms)}
        </span>
      ) : null}
    </>
  )
  return (
    <section className="surface-card rounded-3xl p-2 sm:p-3">
      {link ? (
        <Link {...link} className="group press flex min-h-12 items-center gap-3 rounded-2xl px-3 transition-colors hover:bg-accent-dim">
          {heading}
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-ink-muted transition-[translate,color] group-hover:translate-x-0.5 group-hover:text-accent" />
        </Link>
      ) : (
        <div className="flex min-h-12 items-center gap-3 px-3">{heading}</div>
      )}
      {stacks.length === 0 ? (
        <p className="px-3 pt-1 pb-3 pl-12 text-sm text-ink-muted">No versions yet. Each bounce stacks on top as it lands.</p>
      ) : (
        <div className="mt-1 flex flex-col gap-3 px-1 pb-1">
          {stacks.map(({ kind, versions: stack }) => (
            <div key={kind} className="flex flex-col gap-1">
              <h3 className="readout flex items-center gap-2 px-3 pt-1 text-ink-muted">
                {KIND_LABEL[kind] ?? kind}
                <span className="text-ink-muted/70">· {stack.length}</span>
              </h3>
              <ol className="flex flex-col gap-1">
                {stack.map((version) => (
                  <VersionLine key={version.id} version={version} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function VersionLine({ version }: { version: VersionRow }) {
  const zone = deviceZone()
  const current = Boolean(version.is_current)
  const audio = version.content_type.startsWith('audio/')
  return (
    <li className={cn('surface-item flex items-center gap-3 rounded-2xl py-2.5 pr-3 pl-3', current && 'ring-1 ring-accent/30')}>
      <span className={cn('readout w-9 shrink-0 text-[12px]', current ? 'text-accent' : 'text-ink-muted')}>v{version.number}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-ink">{version.filename}</span>
        <MetaLine
          facts={[
            audio ? `${formatOf(version.filename)} · ${isFinal(version.content_type) ? 'final' : 'test'}` : formatOf(version.filename),
            sizeOf(version.size),
            version.duration_ms ? formatLength(version.duration_ms) : null,
            formatDay(dayOf(version.created_at, zone), todayIn(zone)),
          ]}
        />
        {version.note && <span className="text-[13px] text-ink-soft">{version.note}</span>}
      </span>
      {version.released_at && <span className="readout shrink-0 rounded-full border border-accent-secondary/40 px-2 py-1 text-accent-secondary">Released</span>}
      {current && (
        <span className="readout flex shrink-0 items-center gap-1.5 text-accent">
          <Led />
          Current
        </span>
      )}
    </li>
  )
}
