import { Link } from '@tanstack/react-router'
import { AudioLines, FileAudio, Gauge, Image, Pause, Play, ScrollText, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { isFinal } from '#/server/files'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { dayOf, deviceZone, formatDay, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { usePlayer, usePlayhead, type Playable } from '../player/Player'
import { Led, Meter, useHoverSlide } from '../primitives'
import { Land } from '../scene/Land'
import { Sky } from '../scene/Sky'
import { MetaLine } from '../shared/MetaLine'
import { ArtworkButton } from './ArtworkButton'
import { dateLabel, formatLength, releaseFacts } from './browse'
import type { ReleaseData } from './loaders'
import { FORMAT_LABEL, releaseLink, sectionOf, trackLink, type Part } from './sections'
import { KIND_LABEL, formatOf, stacksOf } from './stacks'

/**
 * A release at a glance, as its own place rather than a dashboard: a whole night in its artwork's colours (the room is
 * set by ReleaseLayout), the signal path of what it has floating in the sky, and on the ground, like a player's now
 * playing, the cover (the way to its artwork), the title, its facts once, Play, and a strip with a segment per track.
 * The tracklist follows below. Every fact appears once on the screen.
 */
export function ReleaseSummary({ release, tracks, versions }: ReleaseData) {
  const { isCompact, isDesktop } = useShellMode()
  const player = usePlayer()
  const playhead = usePlayhead()
  const [artFailure, setArtFailure] = useState<string | null>(null)
  const stationSlide = useHoverSlide()
  const rowSlide = useHoverSlide()
  const section = sectionOf(release)
  const zone = deviceZone()
  const today = todayIn(zone)
  const rows = tracks.map((track) => {
    const stacks = stacksOf(track, versions)
    const master = stacks.find((s) => s.kind === 'master')?.current
    // What Play plays: the current master, else the current version of the next audio stack.
    const version = master ?? stacks.find((s) => s.current.content_type.startsWith('audio/'))?.current
    const playable: Playable | null = version
      ? {
          versionId: version.id,
          title: track.title,
          label: `${KIND_LABEL[version.kind]} v${version.number} · ${formatOf(version.filename)}`,
          day: section === 'released' ? dateLabel(section, release, zone) : `Uploaded ${formatDay(dayOf(version.created_at, zone), today)}`,
          released: section === 'released',
          release: release.title,
          artworkId: release.artwork_id,
          link: releaseLink(section, release.id),
        }
      : null
    return { track, master, playable }
  })
  const bounces = versions.filter((v) => v.track_id).length
  const mastered = rows.filter((r) => r.master).length
  const finals = rows.filter((r) => r.master && isFinal(r.master.content_type)).length
  const n = tracks.length
  const all = (count: number) => n > 0 && count === n
  const detailsDone = section === 'released' ? Boolean(release.upc) && tracks.every((t) => t.isrc) : Boolean(release.release_date)
  const first = rows.find((r) => r.playable)?.playable ?? null
  const isLive = (playable: Playable | null) => Boolean(playable && playable.versionId === player.item?.versionId)
  const ownsPlayer = rows.some((r) => isLive(r.playable))
  const day =
    section === 'released' ? dateLabel(section, release, zone) : release.release_date ? `Out ${formatDay(release.release_date, today)}` : null

  const stations: { part: Part; icon: LucideIcon; label: string; fact: string; lit: boolean }[] = [
    { part: 'tracks', icon: AudioLines, label: 'Bounces', fact: bounces ? `${bounces} ${bounces === 1 ? 'bounce' : 'bounces'}` : 'None yet', lit: bounces > 0 },
    { part: 'tracks', icon: Gauge, label: 'Masters', fact: n ? `${mastered} of ${n}` : 'No tracks yet', lit: all(mastered) },
    { part: 'tracks', icon: FileAudio, label: 'Finals', fact: mastered ? `${finals} of ${n}` : 'After masters', lit: all(finals) },
    { part: 'artwork', icon: Image, label: 'Artwork', fact: release.artwork_id ? 'Cover set' : 'No artwork yet', lit: Boolean(release.artwork_id) },
    {
      part: 'details',
      icon: ScrollText,
      label: 'Details',
      fact: section === 'released' ? (detailsDone ? 'All codes in' : 'Codes to add') : release.release_date ? 'Date set' : 'No date yet',
      lit: detailsDone,
    },
  ]
  // The path is lit from the source for as long as each station on it is done, like a signal reaching it.
  const reached = Math.max(0, stations.findIndex((s) => !s.lit) === -1 ? 4 : stations.findIndex((s) => !s.lit) - 1)

  return (
    <>
      <section aria-labelledby="release-title" className="art-scene @container relative isolate flex min-h-full shrink-0 flex-col overflow-hidden">
        {/* Upper left when the signal path sits right; under it, above the ridges, when it spans the sky */}
        <Sky moon={isDesktop ? 'top-[16%] left-[12%]' : 'top-[44%] left-[20%]'} />

        {/* The signal path floats in the sky on its own glass, so it reads the same over any artwork (under the part tabs, when they float here). */}
        {/* Clear of the header (and the part tabs on compact) floating over the top of the sky */}
        <div className={cn('shrink-0', isCompact ? 'h-[calc(var(--shell-header-h)+env(safe-area-inset-top)+3.5rem)]' : 'h-(--shell-header-h)')} />
        <div className="min-h-2 flex-[0.5]" />
        <nav aria-labelledby="signal-path" className="px-3 sm:px-10">
          <div className="scene-glass glass-edge mx-auto w-full max-w-[44rem] rounded-3xl px-2 pt-4 pb-3 sm:px-5 sm:pt-5 @6xl:max-w-[52rem]">
            <h2 id="signal-path" className="readout mb-3 px-2 text-ink-soft sm:px-1 @6xl:text-xs">Signal path</h2>
            <ol className="relative grid grid-cols-5 gap-x-1 sm:gap-x-3" {...stationSlide.group}>
              {stationSlide.light}
              <span aria-hidden="true" className="absolute top-6 right-[10%] left-[10%] h-px bg-line-strong">
                <span className="absolute inset-y-0 left-0 bg-accent shadow-[0_0_8px_var(--accent)]" style={{ width: `${(reached / 4) * 100}%` }} />
              </span>
              {stations.map(({ part, icon: Icon, label, fact, lit }) => (
                <li key={label} className="relative min-w-0" {...stationSlide.row}>
                  <Link
                    {...releaseLink(section, release.id, part)}
                    className="group press flex flex-col items-center gap-1.5 rounded-2xl px-1 pt-1 pb-2 text-center"
                  >
                    <span
                      className={cn(
                        'relative flex size-10 items-center justify-center rounded-full border bg-room-surface transition-colors',
                        lit ? 'border-accent/60 text-accent glow-accent' : 'border-line-strong text-ink-muted group-hover:border-accent/40 group-hover:text-ink-soft',
                      )}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <Led lit={lit} className="absolute -top-1 left-1/2 -translate-x-1/2" />
                    </span>
                    <span className="font-display text-xs font-semibold text-ink sm:text-sm @6xl:text-[15px]">{label}</span>
                    <span className="text-[11.5px] leading-tight text-balance text-ink-soft sm:text-[12.5px] @6xl:text-sm">{fact}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="min-h-16 flex-1" />
        {/* The land grows with a tall screen, so the sky never outweighs it */}
        <div className="scene-horizon relative shrink-0">
          <Land className={cn('relative block w-full', isCompact ? 'h-[max(15.625cqw,30dvh)]' : 'h-[max(15.625cqw,24dvh)]')} />
        </div>

        {/* Now playing: the cover, the title, its facts once, Play, and (for an EP or album) a strip with a segment per
            track. The cover's top and the title's line up; room under them for the now-playing pill. */}
        <div className={cn('scene-ground relative flex items-start gap-4 px-4 sm:gap-8 sm:px-10', isCompact ? 'pb-[calc(8rem+var(--player-space))]' : 'pb-12')}>
          <div className="-mt-6 shrink-0">
            <ArtworkButton releaseId={release.id} title={release.title} artworkId={release.artwork_id} onFailure={setArtFailure} size="stage" />
          </div>
          <div className="-mt-6 flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 id="release-title" className="truncate font-display text-[1.75rem] leading-[1.05] font-semibold tracking-[-0.02em] sm:text-5xl @5xl:text-6xl">
                {release.title}
              </h1>
              {artFailure ? (
                <p role="alert" className="mt-1.5 text-sm text-feedback-error">
                  {artFailure} Tap the cover to try again.
                </p>
              ) : (
                <MetaLine facts={[...releaseFacts(release, FORMAT_LABEL[release.format]), day]} className="mt-1.5 text-sm text-ink-soft" />
              )}
            </div>
            <div className="flex min-w-0 items-center gap-3">
              {first ? (
                <>
                  <button
                    type="button"
                    onClick={() => (ownsPlayer ? player.toggle() : player.play(first))}
                    aria-label={ownsPlayer && player.playing ? 'Pause' : `Play ${first.title}, ${first.label}`}
                    className="accent-fill press flex size-12 shrink-0 items-center justify-center rounded-full sm:size-14"
                  >
                    {ownsPlayer && player.playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" className="translate-x-0.5" />}
                  </button>
                  <span className="min-w-0">
                    {/* A single's track is the release, already named above */}
                    {release.format !== 'single' && <span className="block truncate text-sm font-medium text-ink">{ownsPlayer && player.item ? player.item.title : first.title}</span>}
                    <span className="readout block truncate text-ink-muted @6xl:text-xs">{ownsPlayer && player.item ? player.item.label : first.label}</span>
                  </span>
                  <Meter live={ownsPlayer && player.playing} bars={5} className="ml-1 shrink-0" />
                </>
              ) : (
                <span className="readout text-ink-muted">No bounces yet</span>
              )}
            </div>
            {/* A single is one track, already Play above; the tracklist below numbers an EP's */}
            {release.format !== 'single' && first && (
              <ol aria-label="Tracks to play" className="flex gap-1.5">
                {rows.map(({ track, master, playable }) => (
                  <li key={track.id} style={{ flexGrow: track.duration_ms || 180_000 }} className="min-w-8 basis-0">
                    <button
                      type="button"
                      disabled={!playable}
                      onClick={() => playable && player.play(playable)}
                      aria-label={playable ? `Play ${track.title}, ${playable.label}` : `${track.title}: nothing to play yet`}
                      className="group flex w-full rounded-md py-2 disabled:cursor-default"
                    >
                      <span aria-hidden="true" className="relative h-1.5 w-full overflow-hidden rounded-full bg-line-strong group-enabled:group-hover:bg-ink-muted/40">
                        {master && <span className="absolute inset-0 bg-accent/45" />}
                        {isLive(playable) && (
                          <span className="absolute inset-y-0 left-0 bg-accent shadow-[0_0_8px_var(--accent)]" style={{ width: `${playhead.duration ? (playhead.time / playhead.duration) * 100 : 0}%` }} />
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      {/* A single's release is its track, so it has no tracklist: Play above is all of it */}
      {release.format !== 'single' && (
        <section aria-labelledby="tracklist" className={cn('px-2 pt-6 sm:px-8', isCompact ? 'pb-[calc(7rem+var(--player-space))]' : 'pb-12')}>
          <h2 id="tracklist" className="readout px-2 pb-2 text-ink-muted">Tracklist</h2>
          {rows.length === 0 ? (
            <p className="px-2 pb-4 text-sm text-ink-muted">No tracks yet.</p>
          ) : (
            <ol className="relative flex flex-col" {...rowSlide.group}>
              {rowSlide.light}
              {rows.map(({ track, master, playable }, i) => {
                const live = isLive(playable)
                return (
                  <li key={track.id} className="group playhead-sweep flex min-h-14 items-center gap-1 rounded-2xl pr-3" {...rowSlide.row}>
                    {/* The number until you point at it, then Play; the button says what plays. */}
                    <button
                      type="button"
                      disabled={!playable}
                      onClick={() => playable && player.play(playable)}
                      aria-label={playable ? (live && player.playing ? `Pause ${track.title}` : `Play ${track.title}, ${playable.label}`) : `${track.title}: nothing to play yet`}
                      className="press relative flex size-11 shrink-0 items-center justify-center rounded-full text-accent disabled:cursor-default"
                    >
                      {live ? (
                        player.playing ? <Meter live bars={3} /> : <Play size={16} aria-hidden="true" />
                      ) : (
                        <>
                          <span className={cn('readout', playable && 'group-hover:opacity-0 group-focus-within:opacity-0')}>{String(i + 1).padStart(2, '0')}</span>
                          {playable && <Play size={16} aria-hidden="true" className="absolute opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" />}
                        </>
                      )}
                    </button>
                    <Link
                      {...(release.format === 'single' ? releaseLink(section, release.id, 'tracks') : trackLink(section, release.id, track.id))}
                      className="press flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl"
                    >
                      <span className={cn('min-w-0 shrink truncate font-medium', live && 'text-accent')}>{track.title}</span>
                      <span aria-hidden="true" className="min-w-6 flex-1 self-center border-b border-dotted border-line-strong" />
                      <span className="readout shrink-0 text-ink-muted">
                        {master ? `Master v${master.number} · ${isFinal(master.content_type) ? 'Final' : 'Test'}` : 'No master yet'}
                      </span>
                      {track.duration_ms ? (
                        <span data-numeric className="w-12 shrink-0 text-right text-[13px] text-ink-soft">
                          {formatLength(track.duration_ms)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      )}
    </>
  )
}
