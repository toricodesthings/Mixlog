import { Link } from '@tanstack/react-router'
import { AudioLines, Disc3, FileAudio, Image, ScrollText, type LucideIcon } from 'lucide-react'
import { Fragment, type CSSProperties } from 'react'

import { isFinal } from '#/server/files'
import { deviceZone, formatDay, todayIn } from '../../lib/time'
import { fileUrl } from '../../lib/files'
import { cn } from '../../lib/utils'
import { Led } from '../primitives'
import { dateLabel, formatLength } from './browse'
import type { ReleaseData } from './loaders'
import { titleHue } from './ReleaseArt'
import { FORMAT_LABEL, SECTIONS, releaseLink, sectionOf, trackLink, type Part } from './sections'
import { stacksOf } from './stacks'

/** A rolling horizon, drawn once across the bottom of the sky (pathLength 1, so the scope classes animate it). */
const HORIZON = 'M0 92 C 90 70, 160 70, 240 86 S 400 112, 480 90 S 640 58, 720 78 S 880 110, 960 88 S 1120 64, 1200 80'

/**
 * A release at a glance, as its own place rather than a dashboard: a sky in its own colour with its facts as
 * instruments, the tracklist like the back of a record, and the signal path of what it has and what it's still waiting on.
 */
export function ReleaseSummary({ release, tracks, versions }: ReleaseData) {
  const section = sectionOf(release)
  const zone = deviceZone()
  const today = todayIn(zone)
  const rows = tracks.map((track) => {
    const stacks = stacksOf(track, versions)
    return { track, stacks, master: stacks.find((s) => s.kind === 'master')?.current }
  })
  const bounces = versions.filter((v) => v.track_id).length
  const mastered = rows.filter((r) => r.master).length
  const finals = rows.filter((r) => r.master && isFinal(r.master.content_type)).length
  const n = tracks.length
  const all = (count: number) => n > 0 && count === n
  const detailsDone = section === 'released' ? Boolean(release.upc) && tracks.every((t) => t.isrc) : Boolean(release.release_date)

  const instruments = [
    release.format !== 'single' && { label: 'Tracks', value: String(n).padStart(2, '0') },
    release.duration_ms && { label: 'Runtime', value: formatLength(release.duration_ms) },
    n > 0 && { label: 'Masters', value: `${mastered}/${n}` },
  ].filter((x): x is { label: string; value: string } => Boolean(x))

  const stations: { part: Part; icon: LucideIcon; label: string; fact: string; lit: boolean }[] = [
    { part: 'tracks', icon: AudioLines, label: 'Bounces', fact: bounces ? `${bounces} in the stacks` : 'Waiting for the first', lit: bounces > 0 },
    { part: 'tracks', icon: Disc3, label: 'Masters', fact: n ? `${mastered} of ${n} ${n === 1 ? 'track' : 'tracks'}` : 'No tracks yet', lit: all(mastered) },
    { part: 'tracks', icon: FileAudio, label: 'Finals', fact: mastered ? `${finals} of ${n} as WAV` : 'After the masters', lit: all(finals) },
    { part: 'artwork', icon: Image, label: 'Artwork', fact: release.artwork_id ? 'On the cover' : 'No artwork yet', lit: Boolean(release.artwork_id) },
    {
      part: 'details',
      icon: ScrollText,
      label: 'Details',
      fact: section === 'released' ? (detailsDone ? 'UPC and ISRCs in' : 'UPC and ISRCs to add') : release.release_date ? 'Day planned' : 'No day planned',
      lit: detailsDone,
    },
  ]

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <section
        aria-label="Summary"
        className="release-sky glass-edge relative overflow-hidden rounded-[2rem] px-6 pt-8 pb-28 sm:px-10 sm:pt-10"
        style={{ '--art-hue': titleHue(release.title) } as CSSProperties}
      >
        {release.artwork_id && (
          // The artwork lights the room: blurred far behind everything, the sky's colour over it.
          <img src={fileUrl(release.artwork_id)} alt="" aria-hidden="true" className="absolute inset-0 -z-10 size-full scale-125 object-cover opacity-45 blur-3xl" />
        )}
        <p className="readout text-ink-soft">
          {FORMAT_LABEL[release.format]} · {SECTIONS[section].label}
        </p>
        <p className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{dateLabel(section, release, zone)}</p>
        {section === 'upcoming' && release.release_date && (
          <p className="mt-1 text-[15px] text-ink-soft">Planned for {formatDay(release.release_date, today)}</p>
        )}
        {instruments.length > 0 && (
          <dl className="mt-8 flex flex-wrap items-stretch gap-x-6 gap-y-4">
            {instruments.map(({ label, value }, i) => (
              <Fragment key={label}>
                {i > 0 && <span aria-hidden="true" className="w-px self-stretch bg-current opacity-15" />}
                <div className="flex flex-col gap-1">
                  <dt className="readout text-ink-soft">{label}</dt>
                  <dd data-numeric className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                    {value}
                  </dd>
                </div>
              </Fragment>
            ))}
          </dl>
        )}
        <svg aria-hidden="true" viewBox="0 0 1200 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-28 w-full">
          <path d={`${HORIZON} L1200 120 L0 120 Z`} className="sky-ground" />
          <path d={HORIZON} pathLength={1} fill="none" strokeWidth="2" className="scope-trace sky-line" vectorEffect="non-scaling-stroke" />
          <path d={HORIZON} pathLength={1} fill="none" strokeWidth="3" strokeLinecap="round" className="scope-pulse" vectorEffect="non-scaling-stroke" />
        </svg>
      </section>

      <section aria-labelledby="signal-path" className="surface-card rounded-3xl p-5 sm:p-6">
        <h2 id="signal-path" className="readout mb-5 text-ink-muted">Signal path</h2>
        <ol className="relative grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-5">
          <span aria-hidden="true" className="absolute top-5 right-[10%] left-[10%] hidden h-px bg-linear-to-r from-accent/50 via-line to-accent/20 sm:block" />
          {stations.map(({ part, icon: Icon, label, fact, lit }) => (
            <li key={label} className="relative">
              <Link {...releaseLink(section, release.id, part)} className="group press flex flex-col items-center gap-2 rounded-2xl p-1 text-center">
                <span
                  className={cn(
                    'relative flex size-10 items-center justify-center rounded-full border transition-colors',
                    lit ? 'border-accent/50 bg-room-surface text-accent glow-accent' : 'border-line bg-room-surface text-ink-muted group-hover:text-ink-soft',
                  )}
                >
                  <Icon size={17} aria-hidden="true" />
                  <Led lit={lit} className="absolute -top-0.5 -right-0.5" />
                </span>
                <span className="font-display text-sm font-semibold text-ink">{label}</span>
                <span className="text-[12.5px] leading-snug text-ink-muted">{fact}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="tracklist" className="surface-card rounded-3xl p-2 sm:p-3">
        <h2 id="tracklist" className="readout px-3 pt-3 pb-2 text-ink-muted">Tracklist</h2>
        {rows.length === 0 ? (
          <p className="px-3 pb-4 text-sm text-ink-muted">No tracks yet.</p>
        ) : (
          <ol className="flex flex-col">
            {rows.map(({ track, master }, i) => (
              <li key={track.id}>
                <Link
                  {...(release.format === 'single' ? releaseLink(section, release.id, 'tracks') : trackLink(section, release.id, track.id))}
                  className="group playhead-sweep press flex min-h-14 items-center gap-3 rounded-2xl px-3 transition-colors hover:bg-accent-dim"
                >
                  <span className="readout w-6 shrink-0 text-right text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 shrink truncate font-medium">{track.title}</span>
                  <span aria-hidden="true" className="min-w-6 flex-1 self-center border-b border-dotted border-line-strong" />
                  <span className="readout shrink-0 text-ink-muted">
                    {master ? `Master v${master.number} · ${isFinal(master.content_type) ? 'Final' : 'Test'}` : 'No master yet'}
                  </span>
                  <span data-numeric className="w-12 shrink-0 text-right text-[13px] text-ink-soft">
                    {track.duration_ms ? formatLength(track.duration_ms) : '—'}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
