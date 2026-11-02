import { useId } from 'react'

import { cn } from '../../lib/utils'

/** Stars in the sky above the hills, seeded so they never move: [left %, top %, size px, warm, sparkle, twinkle]. */
const STARS = (() => {
  let seed = 17
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const stars: (readonly [number, number, number, boolean, boolean, boolean])[] = []
  // [count, size]: the brightest tier is placed first, so it gets the best sky.
  for (const [count, size] of [[10, 2.2], [26, 1.4], [40, 0.9]] as const) {
    for (let placed = 0, guard = 0; placed < count && guard < 4000; guard++) {
      const [left, top] = [2 + rand() * 96, 3 + 62 * rand() * (0.35 + 0.65 * rand())]
      // Clear of the moon (upper left on a wide screen) and of each other.
      if (Math.hypot((left - 12) * 1.6, top - 16) < 14) continue
      if (stars.some(([l, t]) => Math.abs(l - left) < 3.5 && Math.abs(t - top) < 4)) continue
      stars.push([left, top, size, rand() < 0.3, size > 2 && placed < 4, size < 1 && placed % 6 === 0])
      placed++
    }
  }
  return stars
})()

/** The moon's craters (Cadence's, at half size), drawn around its centre. */
const MARIA = 'M-8,-4a4.5,3.5 0 1,0 9,0a4.5,3.5 0 1,0 -9,0M3,4a3,2.5 0 1,0 6,0a3,2.5 0 1,0 -6,0M-4,7a2.5,1.75 0 1,0 5,0a2.5,1.75 0 1,0 -5,0'

/**
 * The night above a release's land (Cadence's HeroSky, in the room's colours, `.art-scene` in app.css): star tiers
 * with a few sparkles and twinkles, and the moon (a pale sun by day). Fills its positioned parent, behind everything.
 * `moon` places the moon's centre, so each screen can keep it clear of what floats in its sky.
 */
export function Sky({ moon }: { moon: string }) {
  const id = useId().replace(/[^\w-]/g, '')
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10">
      {STARS.map(([left, top, size, warm, sparkle, twinkle], i) => (
        <span
          key={i}
          className={cn('scene-star', warm && 'scene-star-warm', sparkle && 'scene-sparkle', twinkle && 'scene-twinkle')}
          style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${-i * 0.9}s` }}
        />
      ))}
      <svg viewBox="-140 -140 280 280" className={cn('scene-moon absolute size-72 -translate-x-1/2 -translate-y-1/2', moon)}>
        <defs>
          <radialGradient id={`${id}wide`}>
            <stop offset="0" stopColor="var(--scene-moon-halo)" stopOpacity=".16" />
            <stop offset="1" stopColor="var(--scene-moon-halo)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}near`}>
            <stop offset=".25" stopColor="var(--scene-moon)" stopOpacity=".16" />
            <stop offset="1" stopColor="var(--scene-moon)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r="140" fill={`url(#${id}wide)`} />
        <circle r="48" fill={`url(#${id}near)`} />
        <circle r="11" fill="var(--scene-moon)" opacity=".7" />
        <path d={MARIA} fill="var(--color-room-deep)" opacity=".08" />
      </svg>
    </div>
  )
}
