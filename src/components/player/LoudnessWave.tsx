import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { cn } from '../../lib/utils'
import { clock } from './controls'
import { usePlayer, usePlayhead, type Playable, type Wave } from './Player'
import { heightOf, pool } from './wave'

const DRAWN = { bridge: 56, room: 72 }

/**
 * A song's loudness over its length, and a playhead: capsule bars on a horizon with mist below (the scene's skyline,
 * never a mirrored half), lit up to the playhead in the room's accent, with a Tube tick where it's loudest. One fixed
 * scale everywhere, so a louder master looks louder beside its mix. It's a native range on top: pressing it plays this
 * version from there through the one player, or seeks when it's already the one playing.
 */
export function LoudnessWave({ item, wave: { bars: wave, ms, loudestMs }, size = 'bridge', className }: {
  item: Playable
  wave: Wave
  size?: 'bridge' | 'room'
  className?: string
}) {
  const player = usePlayer()
  const { time, duration, buffered } = usePlayhead()
  const { isTouch } = useShellMode()
  const active = player.item?.versionId === item.versionId
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

  const go = (to: number) => {
    const at = Math.min(1, Math.max(0, to))
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
      <div
        ref={box}
        className="loudness-wave relative min-w-0 flex-1"
        data-active={active || undefined}
        style={{
          '--wave-h': `${drawn}px`,
          '--fill': `${share * 100}%`,
          '--buffered': `${active && duration ? Math.min(100, (buffered / duration) * 100) : 0}%`,
          '--hover': `${(hover ?? 0) * 100}%`,
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
            <Bars heights={heights} width={width} height={drawn} className="wave-layer wave-buffered" />
            {hover !== null && <Bars heights={heights} width={width} height={drawn} className="wave-layer wave-hover" />}
            <Bars heights={heights} width={width} height={drawn} className="wave-layer wave-lit" lit />
            <Bars heights={heights} width={width} height={drawn} className="wave-mist" />
          </>
        )}
        <span aria-hidden="true" className="wave-ground" />
        {loudestMs != null && ms > 0 && <span aria-hidden="true" className="wave-loudest" style={{ left: `${(loudestMs / ms) * 100}%` }} />}
        {active && <span aria-hidden="true" data-signal className="wave-playhead" />}
        {hover !== null && (
          <span aria-hidden="true" className="wave-ghost">
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
          aria-label={`Playhead, ${item.label.split(' · ')[0]}`}
          aria-valuetext={`${clock(now)} of ${clock(length)}`}
          className="wave-range"
        />
      </div>
      <span data-numeric className="w-10 shrink-0 text-xs text-ink-muted">{clock(length)}</span>
    </div>
  )
}

/** The bars as one SVG, in real pixels so the capsules stay round. Memoized: the playhead moving never redraws them. */
const Bars = memo(function Bars({ heights, width, height, className, lit }: { heights: number[]; width: number; height: number; className: string; lit?: boolean }) {
  const id = `wave${useId().replace(/\W/g, '')}`
  const pitch = width / heights.length
  const bar = Math.max(1.5, pitch * 0.6)
  return (
    <svg aria-hidden="true" className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
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
