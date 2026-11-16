import { memo, useId, type CSSProperties } from 'react'

import type { Fingerprint } from '#/server/loudness'
import { cn } from '../../lib/utils'
import { sceneOf, type MoonZone, type SceneModel } from './generate'
import { useOutgoing } from './use-outgoing'

/** The moon's craters (Cadence's, at half size), drawn around its centre. */
const MARIA = 'M-8,-4a4.5,3.5 0 1,0 9,0a4.5,3.5 0 1,0 -9,0M3,4a3,2.5 0 1,0 6,0a3,2.5 0 1,0 -6,0M-4,7a2.5,1.75 0 1,0 5,0a2.5,1.75 0 1,0 -5,0'
const H = 300

type SkyProps = { sceneId: string; fp: Fingerprint | null; zone: MoonZone; frame: number }

/** A pointer-read box: leans against the pointer by at most `shift` px. */
const lean = (shift: number) => ({ 'data-pointer-read': true, style: { '--shift': shift } as CSSProperties })

/**
 * The night above a release's land (`generate.ts`'s `sceneOf`, in the room's colours): star tiers, the song's own
 * constellation, a band, meteors from one radiant, cirrus, far and near cumulus, and the moon (a pale sun by day),
 * placed inside `zone` (§5). Back to front, so a meteor passes behind the clouds. Stars never move with the pointer
 * (infinitely far); clouds and the moon a pixel or two.
 */
function SkyBody({ m, outgoing }: { m: SceneModel; outgoing?: boolean }) {
  const { sky, frame: W } = m
  const uid = useId().replace(/[^\w-]/g, '')
  const [moonLeft, moonTop] = [(sky.moon.x / W) * 100, (sky.moon.y / H) * 100]
  const bright = sky.stars.filter((s) => s[2] > 2 || s[2] < 1).slice(0, 12)
  const rest = sky.stars.filter((s) => !bright.includes(s))
  return (
    <div aria-hidden="true" className={cn('scene-sky absolute inset-0 -z-10', outgoing && 'scene-outgoing')}>
      {sky.aurora && (
        <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={sky.aurora} fill="var(--scene-aurora)" opacity=".06" />
        </svg>
      )}
      <svg className="absolute inset-0 size-full" preserveAspectRatio="none" style={{ opacity: Math.min(1, 0.45 + 0.45 * sky.light) }}>
        {[true, false].map((warm) => (
          <g key={`${warm}`} fill={warm ? 'var(--scene-star-warm)' : 'var(--scene-star-cool)'}>
            {rest.filter((s) => s[3] === warm).map(([left, top, size], i) => <circle key={i} cx={`${left}%`} cy={`${top}%`} r={size / 2} opacity={top > 45 ? 0.6 : 1} />)}
          </g>
        ))}
        <g fill="var(--scene-star-cool)" opacity=".55">
          {sky.band.map(([left, top, size], i) => <circle key={i} cx={`${left}%`} cy={`${top}%`} r={size / 2} />)}
        </g>
        {/* The song's constellation: its envelope's turns as a star sign, joined by hairlines that fade in once */}
        <g className="scene-constellation" stroke="var(--scene-star-cool)" strokeWidth=".6" opacity=".18">
          {sky.constellation.slice(1).map(([l, t], i) => <line key={i} x1={`${sky.constellation[i][0]}%`} y1={`${sky.constellation[i][1]}%`} x2={`${l}%`} y2={`${t}%`} />)}
        </g>
      </svg>
      {bright.map(([left, top, size, warm, sparkle, twinkle], i) => (
        <span
          key={i}
          data-signal-read
          data-pointer-near="120"
          className={cn('scene-star', warm && 'scene-star-warm', sparkle && 'scene-sparkle', twinkle && 'scene-twinkle')}
          style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${-i * 0.9}s` }}
        />
      ))}
      {/* Meteors fall through the sky before the clouds, so they pass behind them */}
      {sky.meteors.map((s, i) => (
        <span
          key={i}
          className={cn('scene-shooting absolute', `scene-shooting-${s.depth}`)}
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.length, '--len': `${s.length}px`, '--angle': `${s.angle}deg`, '--every': `${s.every}s`, '--life': `${(s.duration / s.every) * 100}%`, animationDelay: `${s.delay}s` } as CSSProperties}
        />
      ))}
      {/* Cirrus: long thin streaks high up, at the star band's angle; they may cross the moon */}
      <div {...lean(1)} className="scene-depth absolute inset-0">
        {sky.cirrus.map((c, i) => (
          <span key={i} className="scene-cirrus scene-cloud-bank absolute" style={{ left: `${c.left}%`, top: `${c.top}%`, width: `${c.width}%`, height: `${c.height}%`, rotate: `${c.angle}deg`, opacity: c.opacity, '--drift': '4px', '--duration': '140s' } as CSSProperties} />
        ))}
      </div>
      {sky.clouds.map((c, i) => {
        const pad = c.h * 0.35
        // A near bank is lit along the edge that faces the moon
        const moonLeftOf = (sky.moon.x / W) * 100 < c.left + c.width / 2
        return (
          <div key={i} {...lean(c.near ? 2 : 1)} className="scene-depth absolute inset-0">
            <div className="scene-cloud-bank absolute" style={{ left: `${c.left}%`, top: `${c.top}%`, width: `${c.width}%`, '--drift': `${c.drift}px`, '--duration': c.near ? '70s' : '90s', opacity: c.near ? 1 : 0.67 } as CSSProperties}>
              <svg viewBox={`${-pad} ${-pad} ${c.w + 2 * pad} ${c.h + 2 * pad}`} className="block w-full">
                <defs>
                  <linearGradient id={`${uid}c${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset=".1" stopColor="var(--scene-cloud-lit)" />
                    <stop offset=".7" stopColor="var(--scene-cloud)" />
                    <stop offset="1" stopColor="var(--scene-cloud)" stopOpacity="0" />
                  </linearGradient>
                  {c.near && (
                    <linearGradient id={`${uid}r${i}`} x1={moonLeftOf ? '0' : '1'} x2={moonLeftOf ? '1' : '0'} y1="0" y2="0">
                      <stop offset="0" stopColor="var(--scene-moon)" stopOpacity=".35" />
                      <stop offset=".25" stopColor="var(--scene-moon)" stopOpacity="0" />
                    </linearGradient>
                  )}
                  <filter id={`${uid}cb${i}`} x="-30%" y="-40%" width="160%" height="180%">
                    <feGaussianBlur stdDeviation={c.near ? Math.max(2, c.h * 0.05) : c.h * 0.07} />
                  </filter>
                </defs>
                <path d={c.d} fill={`url(#${uid}c${i})`} filter={`url(#${uid}cb${i})`} />
                {c.near && <path d={c.d} fill={`url(#${uid}r${i})`} filter={`url(#${uid}cb${i})`} />}
              </svg>
            </div>
          </div>
        )
      })}
      <div {...lean(1.5)} className="scene-depth absolute inset-0">
        <svg
          viewBox="-140 -140 280 280"
          data-signal-read
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
          <circle r="140" fill={`url(#${uid}wide)`} data-pointer-near="300" className="scene-moon-halo" style={{ '--halo': Math.min(1, sky.light) } as CSSProperties} />
          <circle r="48" fill={`url(#${uid}near)`} opacity={Math.min(1, sky.light)} />
          {/* A ring around the moon on a weathered night */}
          {sky.moon.ring && <circle r="34" fill="none" stroke="var(--scene-moon-halo)" strokeWidth="3" opacity=".12" />}
          <g transform={sky.moon.side === 1 ? 'scale(-1,1)' : undefined}>
            <circle r="11" fill="var(--scene-moon)" opacity=".7" />
            {sky.moon.phase !== 'full' && (
              <circle cx={sky.moon.phase === 'crescent' ? -7 : -15} r="11" clipPath={`url(#${uid}disc)`} fill="var(--color-room-deep)" opacity={sky.moon.phase === 'crescent' ? 0.82 : 0.55} />
            )}
            <path d={MARIA} fill="var(--color-room-deep)" opacity=".08" />
          </g>
        </svg>
      </div>
    </div>
  )
}

const keyOf = (fp: Fingerprint | null) => (fp ? JSON.stringify(fp) : 'd')

export const Sky = memo(function Sky({ sceneId, fp, zone, frame }: SkyProps) {
  const out = useOutgoing(sceneId, keyOf(fp), fp)
  return (
    <>
      {out && <SkyBody key={`o${out.key}`} m={sceneOf(sceneId, out.value, zone, frame)} outgoing />}
      <SkyBody key={keyOf(fp)} m={sceneOf(sceneId, fp, zone, frame)} />
    </>
  )
}, (a, b) => a.sceneId === b.sceneId && keyOf(a.fp) === keyOf(b.fp) && a.zone === b.zone && a.frame === b.frame)
