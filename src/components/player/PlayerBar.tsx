import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Maximize2, X } from 'lucide-react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { SPRINGS } from '../../lib/constants/motion'
import { cn } from '../../lib/utils'
import { Meter, Tip } from '../primitives'
import { ReleaseArt } from '../releases/ReleaseArt'
import { ABSwitch, TONE } from './ABSwitch'
import { PlayToggle, Scrubber, SkipButton, VolumeControl } from './controls'
import { useOpenRoom, usePlayer, usePlayhead } from './Player'

/**
 * The player's everyday face, while something is loaded. With a mouse it docks along the bottom of the app like a
 * streaming app's (what's playing; the transport and playhead in the middle; level, the listening room and stop on
 * the right), in the layout, so it never covers a page. On touch the dock carries it instead (MiniPlayer, below).
 * Either way it outlives every page. While A/B is split and the room lowered, it carries the A | B switch, A in the
 * app's own Signal and Tube (the room's light stays in the room), and says which side you hear.
 */
export function PlayerBar() {
  const { item, playing, stop, ab } = usePlayer()
  const openRoom = useOpenRoom()
  const { isDesktop } = useShellMode()
  if (!item || !isDesktop) return null
  return (
    <section aria-label="Player" className="player-bar relative grid h-[5.5rem] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-6 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Tip label="Open the listening room">
          <button type="button" onClick={openRoom} aria-label="Open the listening room" className="group press relative shrink-0 rounded-xl">
            <ReleaseArt title={item.release} id={item.releaseId} artworkId={item.artworkId} size="row" />
            <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-room-void/55 text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              <Maximize2 size={16} aria-hidden="true" />
            </span>
          </button>
        </Tip>
        <div className="min-w-0">
          <Link {...item.link} className="block truncate font-display text-[0.9375rem] font-semibold text-ink hover:underline hover:underline-offset-4">
            {item.title}
            {item.name !== item.title && <span className="font-sans font-medium text-ink-soft"> · {item.name}</span>}
          </Link>
          <p className="readout mt-1 truncate text-ink-muted">
            {ab && (
              <>
                <span aria-hidden="true" style={{ color: TONE[ab.live] }}>
                  {ab.live.toUpperCase()}
                </span>
                {' · '}
              </>
            )}
            {item.label}
          </p>
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
        {ab?.b && <ABSwitch size="bar" className="mr-2" />}
        <VolumeControl />
        <Tip label="Open the listening room">
          <button type="button" onClick={openRoom} aria-label="Open the listening room" className="press flex size-10 items-center justify-center rounded-full text-ink-soft hover:text-ink">
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

/** On touch, part of the dock: what's playing and play or pause in thumb's reach, the playhead along its edge. A tap or
 *  a swipe up opens the listening room. While A/B is split, the A | B switch stands in for the meter. With the dock
 *  tucked it sits beside the current tab, title and play only. */
export function MiniPlayer({ tucked }: { tucked: boolean }) {
  const { item, playing, ab } = usePlayer()
  const openRoom = useOpenRoom()
  if (!item) return null
  return (
    <motion.section
      layout
      layoutId="mini-player"
      transition={SPRINGS.SNAP}
      style={{ borderRadius: 24 }}
      onPanEnd={(_, info) => void (info.offset.y < -24 && openRoom())}
      aria-label="Player"
      className={cn('mobile-dock glass glass-edge relative flex min-w-0 touch-none items-center gap-3 overflow-hidden p-1.5 pr-2', tucked && 'flex-1')}
    >
      <button type="button" onClick={openRoom} aria-label={`Open the listening room: ${item.title}, ${item.name}, ${item.label}`} className="press flex min-w-0 flex-1 items-center gap-3 text-left">
        <ReleaseArt title={item.release} id={item.releaseId} artworkId={item.artworkId} size="row" className={cn('rounded-[18px]', tucked ? 'size-9' : 'size-11')} />
        <span className="min-w-0">
          <span className="block truncate font-display text-[0.9375rem] font-semibold text-ink">
            {item.title}
            {item.name !== item.title && <span className="font-sans font-medium text-ink-soft"> · {item.name}</span>}
          </span>
          {!tucked && <span className="readout mt-0.5 block truncate text-ink-muted">{item.label}</span>}
        </span>
      </button>
      {!tucked && (ab?.b ? <ABSwitch size="bar" className="shrink-0" /> : <Meter live={playing} bars={4} className="shrink-0" />)}
      <PlayToggle size="sm" />
      <MiniHairline />
    </motion.section>
  )
}

/** The mini player's hairline: its own component, so the playhead re-renders it alone, not the (layout-animated) bar. */
function MiniHairline() {
  const { time, duration } = usePlayhead()
  return <span aria-hidden="true" data-playhead className="absolute inset-x-5 bottom-0 h-0.5 origin-left scale-x-(--share) rounded-full bg-accent" style={{ '--share': duration ? time / duration : 0 } as CSSProperties} />
}
