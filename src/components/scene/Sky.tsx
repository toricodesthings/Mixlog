import { memo, useId, type CSSProperties } from 'react'

import type { Fingerprint } from '#/server/loudness'
import { cn } from '../../lib/utils'
import { sceneOf, type MoonZone } from './generate'

/** The moon's craters (Cadence's, at half size), drawn around its centre. */
const MARIA = 'M-8,-4a4.5,3.5 0 1,0 9,0a4.5,3.5 0 1,0 -9,0M3,4a3,2.5 0 1,0 6,0a3,2.5 0 1,0 -6,0M-4,7a2.5,1.75 0 1,0 5,0a2.5,1.75 0 1,0 -5,0'
const W = 1920
const H = 300

/**
 * The night above a release's land (1.3.0: `generate.ts`'s `sceneOf`, in the room's colours, `.art-scene` in
 * app.css): star tiers with a few sparkles and twinkles, and the moon (a pale sun by day), placed inside `zone`
 * (§5) so each screen keeps it clear of what floats in its sky. Memoised by the scene's own key.
 */
export const Sky = memo(function Sky({ sceneId, fp, zone }: { sceneId: string; fp: Fingerprint | null; zone: MoonZone }) {
  const { sky } = sceneOf(sceneId, fp, zone)
  const uid = useId().replace(/[^\w-]/g, '')
  const [moonLeft, moonTop] = [(sky.moon.x / W) * 100, (sky.moon.y / H) * 100]
  const bright = sky.stars.filter((s) => s[2] > 2 || s[2] < 1).slice(0, 12)
  const rest = sky.stars.filter((s) => !bright.includes(s))
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10">
      {/* The dim and mid tiers, painted once: a static layer, never animated */}
      {/* The song sets how bright the night is: a dim, hazy night shows fewer stars clearly */}
      {/* Each tint is one group, so a star is only its place and size */}
      <svg className="absolute inset-0 size-full" preserveAspectRatio="none" style={{ opacity: Math.min(1, 0.45 + 0.45 * sky.light) }}>
        {[true, false].map((warm) => (
          <g key={`${warm}`} fill={warm ? 'var(--scene-star-warm)' : 'var(--scene-star-cool)'}>
            {rest.filter((s) => s[3] === warm).map(([left, top, size], i) => <circle key={i} cx={`${left}%`} cy={`${top}%`} r={size / 2} />)}
          </g>
        ))}
        {/* The faint band across the upper sky */}
        <g fill="var(--scene-star-cool)" opacity=".55">
          {sky.band.map(([left, top, size], i) => <circle key={i} cx={`${left}%`} cy={`${top}%`} r={size / 2} />)}
        </g>
      </svg>
      {/* The bright tier: the only stars that twinkle, sparkle or pulse on the kick */}
      {bright.map(([left, top, size, warm, sparkle, twinkle], i) => (
        <span
          key={i}
          className={cn('scene-star', warm && 'scene-star-warm', sparkle && 'scene-sparkle', twinkle && 'scene-twinkle')}
          style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${-i * 0.9}s` }}
        />
      ))}
      {/* Clouds, high in the sky, each in its own slot so two never meet; blurred soft, drifting with `translate` alone */}
      {sky.clouds.map((c, i) => {
        const pad = c.h * 0.35
        return (
          <div key={i} className="scene-cloud-bank absolute" style={{ left: `${c.left}%`, top: `${c.top}%`, width: `${c.width}%`, '--drift': `${c.drift}px` } as CSSProperties}>
            <svg viewBox={`${-pad} ${-pad} ${c.w + 2 * pad} ${c.h + 2 * pad}`} className="block w-full">
              <defs>
                <linearGradient id={`${uid}c${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset=".1" stopColor="var(--scene-cloud-lit)" />
                  <stop offset=".7" stopColor="var(--scene-cloud)" />
                  <stop offset="1" stopColor="var(--scene-cloud)" stopOpacity="0" />
                </linearGradient>
                <filter id={`${uid}cb${i}`} x="-30%" y="-40%" width="160%" height="180%">
                  <feGaussianBlur stdDeviation={c.h * 0.07} />
                </filter>
              </defs>
              <path d={c.d} fill={`url(#${uid}c${i})`} filter={`url(#${uid}cb${i})`} />
            </svg>
          </div>
        )
      })}
      {/* Now and then a star falls, away from the moon: rare enough to be a moment, never a show */}
      <span
        className="scene-shooting absolute"
        style={{ left: `${sky.shooting.left}%`, top: `${sky.shooting.top}%`, '--angle': `${sky.shooting.angle}deg`, '--every': `${sky.shooting.every}s`, animationDelay: `${sky.shooting.delay}s` } as CSSProperties}
      />
      <svg
        viewBox="-140 -140 280 280"
        className="scene-moon absolute size-72 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${moonLeft}%`, top: `${moonTop}%` }}
      >
        <defs>
          <radialGradient id={`${uid}wide`}>
            <stop offset="0" stopColor="var(--scene-moon-halo)" stopOpacity=".16" />
            <stop offset="1" stopColor="var(--scene-moon-halo)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}near`}>
            <stop offset=".25" stopColor="var(--scene-moon)" stopOpacity=".16" />
            <stop offset="1" stopColor="var(--scene-moon)" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${uid}disc`}>
            <circle r="11" />
          </clipPath>
        </defs>
        <circle r="140" fill={`url(#${uid}wide)`} opacity={Math.min(1, sky.light)} />
        <circle r="48" fill={`url(#${uid}near)`} opacity={Math.min(1, sky.light)} />
        <g transform={sky.moon.side === 1 ? 'scale(-1,1)' : undefined}>
          <circle r="11" fill="var(--scene-moon)" opacity=".7" />
          {/* The shadow: a second disc offset to one side, clipped to the moon so it never spills into the sky */}
          {sky.moon.phase !== 'full' && (
            <circle cx={sky.moon.phase === 'crescent' ? -7 : -15} r="11" clipPath={`url(#${uid}disc)`} fill="var(--color-room-deep)" opacity={sky.moon.phase === 'crescent' ? 0.82 : 0.55} />
          )}
          <path d={MARIA} fill="var(--color-room-deep)" opacity=".08" />
        </g>
      </svg>
    </div>
  )
})
