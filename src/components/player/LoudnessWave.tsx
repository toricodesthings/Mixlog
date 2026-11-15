import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { cn } from '../../lib/utils'
import { clock } from './controls'
import type { Side } from './ab'
import { usePlayer, usePlayhead, type Playable, type Wave } from './Player'
import { heightOf, pool } from './wave'

const DRAWN = { bridge: 56, room: 72, pair: 56 }

/**
 * A song's loudness over its length, and a playhead: capsule bars on a horizon with mist below (the scene's skyline,
 * never a mirrored half), lit up to the playhead in the room's accent, with a Tube tick where it's loudest. One fixed
 * scale everywhere, so a louder master looks louder beside its mix. It's a native range on top: pressing it plays this
 * version from there through the one player, or seeks when it's already the one playing.
 *
 * In A/B, each side's wave is a `deck`: it reads that deck's playhead, and pressing it seeks there and listens to that
 * side. `axis` (seconds, the longer file's length) puts both on one time axis, so the same moment is the same x.
 */
export function LoudnessWave({ item, wave: { bars: wave, ms, loudestMs }, size = 'bridge', deck, axis, className }: {
  item: Playable
  wave: Wave
  size?: 'bridge' | 'room' | 'pair'
  deck?: Side
  axis?: number
  className?: string
}) {
  const player = usePlayer()
  const { time, duration, buffered } = usePlayhead(deck)
  const { isTouch } = useShellMode()
  const active = deck !== undefined || player.item?.versionId === item.versionId
  const length = active && duration ? duration : ms / 1000
  const now = active ? time : 0
  const share = length ? Math.min(1, now / length) : 0

  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const step = isTouch ? 6 : 5
  const heights = useMemo(() => pool(wave, Math.max(16, Math.floor(width / step))).map(heightOf), [wave, width, step])
  const [hover, setHover] = useState<number | null>(null)
  // Where it's lit, buffered and pointed at, on the few layers that draw them (`[data-playhead-read]`), never on the
  // wave itself: set there, every bar under it would restyle. The player's frame loop writes the same two while playing.
  const fill = `${share * 100}%`
  const filled = `${active && duration ? Math.min(100, (buffered / duration) * 100) : 0}%`
  const pointed = `${(hover ?? 0) * 100}%`
  // Layers come and go (the hover's, the playhead's, all of them on a resize): each new one is given them too
  const hovering = hover !== null
  useLayoutEffect(() => {
    for (const el of box.current?.querySelectorAll<HTMLElement>('[data-playhead-read]') ?? []) {
      el.style.setProperty('--fill', fill)
      el.style.setProperty('--buffered', filled)
      el.style.setProperty('--hover', pointed)
    }
  }, [fill, filled, pointed, width, hovering, active])

  const go = (to: number) => {
    const at = Math.min(1, Math.max(0, to))
    if (deck) return player.seekTo(at * length, deck), player.listen(deck)
    if (active) player.seek(at)
    else player.play(item, { at })
  }
  // ←/→ 5 s and PageUp/PageDown 30 s, as a transport's buttons; Home and End are the range's own.
  const keys = (event: KeyboardEvent) => {
    const by = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -30, PageUp: 30 }[event.key]
    if (by === undefined || !length) return
    event.preventDefault()
    go((now + by) / length)
  }

  const drawn = DRAWN[size]
  return (
    <div className={cn('flex w-full items-center gap-3', className)}>
      <span data-numeric className="w-10 shrink-0 text-right text-xs text-ink-muted">{clock(now)}</span>
      {/* On a shared axis, the shorter file's wave ends where its sound does */}
      <div className="min-w-0 flex-1">
      <div
        ref={box}
        className="loudness-wave relative min-w-0"
        data-active={active || undefined}
        data-playhead={deck ?? (active || undefined)}
        style={{
          '--wave-h': `${drawn}px`,
          width: axis && length ? `${Math.min(100, (length / axis) * 100)}%` : undefined,
        } as CSSProperties}
        onPointerMove={isTouch ? undefined : (event) => {
          const r = event.currentTarget.getBoundingClientRect()
          setHover(Math.min(1, Math.max(0, (event.clientX - r.left) / r.width)))
        }}
        onPointerLeave={() => setHover(null)}
      >
        {width > 0 && (
          <>
            <Bars heights={heights} width={width} height={drawn} className="wave-layer wave-rest" />
            <Bars heights={heights} width={width} height={drawn} className="wave-layer wave-buffered" read />
            {hover !== null && <Bars heights={heights} width={width} height={drawn} className="wave-layer wave-hover" read />}
            <Bars heights={heights} width={width} height={drawn} className="wave-layer wave-lit" lit read />
            <Bars heights={heights} width={width} height={drawn} className="wave-mist" />
          </>
        )}
        <span aria-hidden="true" data-playhead-read className="wave-ground" />
        {loudestMs != null && ms > 0 && <span aria-hidden="true" className="wave-loudest" style={{ left: `${(loudestMs / ms) * 100}%` }} />}
        {active && <span aria-hidden="true" data-signal data-playhead-read className="wave-playhead" />}
        {hover !== null && (
          <span aria-hidden="true" data-playhead-read className="wave-ghost">
            <span data-numeric className="readout surface-control rounded-full px-1.5 py-0.5 text-ink">{clock(hover * length)}</span>
          </span>
        )}
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(share * 1000)}
          onChange={(event) => go(Number(event.target.value) / 1000)}
          onKeyDown={keys}
          aria-label={`${deck ? `${deck.toUpperCase()} · ` : ''}Playhead, ${item.label.split(' · ')[0]}`}
          aria-valuetext={`${clock(now)} of ${clock(length)}`}
          className="wave-range"
        />
      </div>
      </div>
      <span data-numeric className="w-10 shrink-0 text-xs text-ink-muted">{clock(length)}</span>
    </div>
  )
}

/** The bars as one SVG, in real pixels so the capsules stay round. Memoized: the playhead moving never redraws them.
 *  `read`: a layer clipped to the playhead (or the pointer), so it's given the playhead's variables. */
const Bars = memo(function Bars({ heights, width, height, className, lit, read }: { heights: number[]; width: number; height: number; className: string; lit?: boolean; read?: boolean }) {
  const id = `wave${useId().replace(/\W/g, '')}`
  const pitch = width / heights.length
  const bar = Math.max(1.5, pitch * 0.6)
  return (
    <svg aria-hidden="true" data-playhead-read={read || undefined} className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {lit && (
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="1" stopColor="var(--accent-tertiary)" />
          </linearGradient>
        </defs>
      )}
      {heights.map((h, i) => (
        <rect key={i} x={i * pitch + (pitch - bar) / 2} y={height * (1 - h)} width={bar} height={height * h} rx={bar / 2} fill={lit ? `url(#${id})` : undefined} />
      ))}
    </svg>
  )
})
