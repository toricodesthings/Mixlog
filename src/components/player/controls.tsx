import { Pause, Play, RotateCcw, RotateCw, Volume1, Volume2, VolumeX } from 'lucide-react'
import type { CSSProperties } from 'react'

import { cn } from '../../lib/utils'
import { Tip } from '../primitives'
import { formatLength } from '../releases/browse'
import { usePlayer, usePlayhead } from './Player'

/** The transport's controls, shared by the bar and the listening room, so they look and behave the same everywhere. */

const clock = (seconds: number) => formatLength(seconds * 1000)

/** Play or pause what's loaded: the one solid Signal fill in the transport. */
export function PlayToggle({ size = 'md', className, ...rest }: { size?: 'sm' | 'md' | 'lg'; className?: string; 'data-room-play'?: boolean }) {
  const { playing, toggle } = usePlayer()
  const box = { sm: 'size-11', md: 'size-10', lg: 'size-16' }[size]
  const icon = size === 'lg' ? 26 : 18
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? 'Pause' : 'Play'}
      {...rest}
      className={cn('accent-fill press flex shrink-0 items-center justify-center rounded-full', box, className)}
    >
      {playing ? <Pause size={icon} aria-hidden="true" fill="currentColor" /> : <Play size={icon} aria-hidden="true" fill="currentColor" className="translate-x-[1.5px]" />}
    </button>
  )
}

/** Back or ahead by `by` seconds (negative is back): the circling arrow with the count inside, as on any player. */
export function SkipButton({ by, size = 'md' }: { by: number; size?: 'md' | 'lg' }) {
  const { skip } = usePlayer()
  const label = `${by < 0 ? 'Back' : 'Ahead'} ${Math.abs(by)} seconds`
  const Icon = by < 0 ? RotateCcw : RotateCw
  return (
    <Tip label={label}>
      <button
        type="button"
        onClick={() => skip(by)}
        aria-label={label}
        className={cn('press relative flex shrink-0 items-center justify-center rounded-full text-ink-soft hover:text-ink', size === 'lg' ? 'size-12' : 'size-10')}
      >
        <Icon size={size === 'lg' ? 30 : 24} strokeWidth={1.6} aria-hidden="true" />
        <span aria-hidden="true" data-numeric className={cn('absolute pt-px font-semibold', size === 'lg' ? 'text-[9.5px]' : 'text-[8px]')}>
          {Math.abs(by)}
        </span>
      </button>
    </Tip>
  )
}

/**
 * The playhead: a native range (keyboard, screen reader and touch for free) with the time either side, in tabular
 * figures so they never jitter while playing.
 */
export function Scrubber({ className }: { className?: string }) {
  const { seek } = usePlayer()
  const { time, duration } = usePlayhead()
  const share = duration ? time / duration : 0
  return (
    <div className={cn('flex w-full items-center gap-3', className)}>
      <span data-numeric className="w-10 shrink-0 text-right text-xs text-ink-muted">{clock(time)}</span>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(share * 1000)}
        disabled={!duration}
        onChange={(event) => seek(Number(event.target.value) / 1000)}
        aria-label="Playhead"
        aria-valuetext={`${clock(time)} of ${clock(duration)}`}
        className="scrubber min-w-0 flex-1"
        style={{ '--fill': `${share * 100}%` } as CSSProperties}
      />
      <span data-numeric className="w-10 shrink-0 text-xs text-ink-muted">{duration ? clock(duration) : '–:––'}</span>
    </div>
  )
}

/** Mute, and the level: louder sounds better, so it's always in reach and always the listener's call. */
export function VolumeControl({ className }: { className?: string }) {
  const { volume, muted, setVolume, setMuted } = usePlayer()
  const level = muted ? 0 : volume
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Tip label={muted ? 'Unmute' : 'Mute'}>
        <button type="button" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'} className="press flex size-10 items-center justify-center rounded-full text-ink-soft hover:text-ink">
          <Icon size={18} aria-hidden="true" />
        </button>
      </Tip>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(level * 100)}
        onChange={(event) => setVolume(Number(event.target.value) / 100)}
        aria-label="Volume"
        className="scrubber w-24"
        style={{ '--fill': `${level * 100}%` } as CSSProperties}
      />
    </div>
  )
}
