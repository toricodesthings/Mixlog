import { Link } from '@tanstack/react-router'
import { Maximize2, X } from 'lucide-react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { Meter, Tip } from '../primitives'
import { ReleaseArt } from '../releases/ReleaseArt'
import { PlayToggle, Scrubber, SkipButton, VolumeControl } from './controls'
import { useListenParam, usePlayer, usePlayhead } from './Player'

/**
 * The player's everyday face, while something is loaded. With a mouse it docks along the bottom of the app like a
 * streaming app's (what's playing; the transport and playhead in the middle; level, the listening room and stop on
 * the right), in the layout, so it never covers a page. On touch it's a mini player above the dock: tap it for the
 * listening room. Either way it outlives every page.
 */
export function PlayerBar() {
  const { item, playing, stop } = usePlayer()
  const listen = useListenParam()
  const { isDesktop } = useShellMode()
  if (!item) return null
  if (!isDesktop) return <MiniPlayer />
  return (
    <section aria-label="Player" className="player-bar relative grid h-[5.5rem] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-6 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Tip label="Open the listening room">
          <button type="button" onClick={listen.show} aria-label="Open the listening room" className="group press relative shrink-0 rounded-xl">
            <ReleaseArt title={item.release} artworkId={item.artworkId} size="row" />
            <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-room-void/55 text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              <Maximize2 size={16} aria-hidden="true" />
            </span>
          </button>
        </Tip>
        <div className="min-w-0">
          <Link {...item.link} className="block truncate font-display text-[15px] font-semibold text-ink hover:underline hover:underline-offset-4">
            {item.title}
          </Link>
          <p className="readout mt-1 truncate text-ink-muted">{item.label}</p>
        </div>
        <Meter live={playing} bars={4} className="ml-1 shrink-0" />
      </div>

      <div className="flex min-w-0 flex-col items-center gap-1 pt-1">
        <div className="flex items-center gap-2">
          <SkipButton by={-10} />
          <PlayToggle />
          <SkipButton by={10} />
        </div>
        <Scrubber className="max-w-[40rem]" />
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1">
        <VolumeControl />
        <Tip label="Open the listening room">
          <button type="button" onClick={listen.show} aria-label="Open the listening room" className="press flex size-10 items-center justify-center rounded-full text-ink-soft hover:text-ink">
            <Maximize2 size={17} aria-hidden="true" />
          </button>
        </Tip>
        <Tip label="Stop">
          <button type="button" onClick={stop} aria-label={`Stop ${item.title}`} className="press flex size-10 items-center justify-center rounded-full text-ink-soft hover:text-ink">
            <X size={18} aria-hidden="true" />
          </button>
        </Tip>
      </div>
    </section>
  )
}

/** On touch: what's playing and play or pause, in thumb's reach above the dock; the rest is a tap away. */
function MiniPlayer() {
  const { item, playing } = usePlayer()
  const { time, duration } = usePlayhead()
  const listen = useListenParam()
  if (!item) return null
  return (
    <section
      aria-label="Player"
      data-mini-player
      className="glass-surface glass-edge layer-floating-bar fixed inset-x-2 bottom-[calc(4.4rem+env(safe-area-inset-bottom))] flex items-center gap-3 overflow-hidden rounded-2xl border border-line p-2 shadow-2xl shadow-black/40"
    >
      <button type="button" onClick={listen.show} aria-label={`Open the listening room: ${item.title}, ${item.label}`} className="press flex min-w-0 flex-1 items-center gap-3 text-left">
        <ReleaseArt title={item.release} artworkId={item.artworkId} size="row" className="size-11 rounded-lg" />
        <span className="min-w-0">
          <span className="block truncate font-display text-[15px] font-semibold text-ink">{item.title}</span>
          <span className="readout mt-0.5 block truncate text-ink-muted">{item.label}</span>
        </span>
      </button>
      <Meter live={playing} bars={4} className="shrink-0" />
      <PlayToggle size="sm" />
      <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 origin-left rounded-full bg-accent" style={{ scale: `${duration ? time / duration : 0} 1` }} />
    </section>
  )
}
