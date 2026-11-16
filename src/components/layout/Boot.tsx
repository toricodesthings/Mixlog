import { Fragment, useEffect } from 'react'

import { cn } from '../../lib/utils'
import { BrandMark } from '../primitives'
import { sceneOf, ZONES } from '../scene/generate'
import { TubeBody } from '../scene/Tube'

/** How long the boot takes to fly into the valley and fade off the page that has arrived under it (`.boot-leaving` in
 *  app.css). The page is live underneath the whole time, so it never waits on this. */
const LEAVE_MS = 700

/** A sparse night from the listening room's own generator, on a fixed seed so it's the same sky every boot: its bright
 *  and mid tiers only, lifted into the upper screen and kept clear of the mark and the wordmark. */
const SCENE = sceneOf('mixlog-boot', null, ZONES.roomCompact)
const STARS = SCENE.sky.stars.filter(([, , size]) => size > 1)
  .map(([left, top, size, warm]) => [left, top * 0.9, size, warm] as const)
  .filter(([left, top]) => Math.abs(left - 50) > 16 || top < 24)
  .slice(0, 24)

/** The first thing anyone sees, before the app has arrived (it's in the shell HTML, so CSS alone runs it): a quiet
 *  night over a still valley, and the mark drawing itself in and back out as the room tunes in. It stays over the shell
 *  until the first page is ready (`AppShell`), then flies in: each depth grows from the crest's peak, nearer ones more,
 *  like a drone pushing into the valley, as it fades. */
export function Boot({ leaving, onLeft }: { leaving: boolean; onLeft: () => void }) {
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(onLeft, LEAVE_MS)
    return () => clearTimeout(timer)
  }, [leaving, onLeft])

  return (
    <div role="status" className={cn('boot bg-atmosphere layer-loading-screen fixed inset-0 overflow-hidden', leaving && 'boot-leaving')}>
      <div aria-hidden="true" className="boot-sky absolute inset-0">
        <div className="boot-depth boot-depth-sky absolute inset-0">
          {STARS.map(([left, top, size, warm], i) => (
            <span
              key={i}
              className={cn('boot-star', warm && 'boot-star-warm', i === 0 && 'boot-sparkle', i % 8 === 4 && 'boot-twinkle')}
              style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${-i * 1.3}s` }}
            />
          ))}
        </div>
        <Ground />
      </div>
      <div className="boot-stage relative flex h-full flex-col items-center justify-center gap-8">
        <div className="boot-mark relative">
          <div aria-hidden="true" className="boot-aura" />
          <BrandMark className="brand-boot relative size-28" />
        </div>
        <p className="boot-wordmark flex items-center gap-5 font-display text-4xl font-medium tracking-tight text-ink">
          <span aria-hidden="true" className="boot-rule" />
          <span className="sr-only">Loading </span>Mixlog
          <span aria-hidden="true" className="boot-rule boot-rule-r" />
        </p>
      </div>
    </div>
  )
}

/** The valley's crest: the old horizon trace, level out to both edges and swelling gently under the mark (its peak at
 *  960, 266), so the tubes at the edges always stand on level ground, a phone's crop (x 704–1217) included. */
const CREST = 'M0 296H700C820 296 860 266 960 266S1100 296 1220 296H1920'
/** The crest's level, as a share of the ground's height up from its bottom: (400 − 296) / 400. */
const LEVEL = 0.26
/** Amp tubes standing on the crest at both edges, mirrored: a tall one outside glowing Tube orange, a shorter one
 *  inside glowing the mark's Rose, each pair the other's reflection, so they frame the valley instead of sitting in the
 *  way. `b` breathes out of step. */
const TUBES = [
  { side: 'left', inset: '6%', s: 1.15, b: false, tone: 'tube' },
  { side: 'left', inset: 'calc(6% + 1.75rem)', s: 0.85, b: true, tone: 'rose' },
  { side: 'right', inset: '6%', s: 1.15, b: true, tone: 'tube' },
  { side: 'right', inset: 'calc(6% + 1.75rem)', s: 0.85, b: false, tone: 'rose' },
] as const
const ground = { viewBox: '0 0 1920 400', preserveAspectRatio: 'xMidYMax slice', className: 'absolute inset-0 size-full' } as const
/** A tube's own box, in the ground's units (so it scales with it): its base at 0, its halo above and its reflection in
 *  the lake (from 44 below the crest) under it. */
const TUBE_BOX = { viewBox: '-40 -50 80 130', className: 'absolute inset-0 size-full overflow-visible' } as const

/** One amp tube: glass, cap, dark plate and socket, its light broken on the water below; its filament and glow are a
 *  layer of their own over it, so only that layer breathes (a box's opacity, composited). */
function Tube({ side, inset, s, b, tone }: (typeof TUBES)[number]) {
  return (
    <div
      className="boot-tube absolute -translate-x-1/2"
      style={{ [side]: inset, ...(side === 'right' && { translate: '50% 0' }), bottom: `${(LEVEL - 80 / 400) * 100}%` }}
    >
      <svg {...TUBE_BOX}>
        <g transform={`scale(${s})`}>
          <TubeBody glass="var(--boot-glass)" rim="var(--boot-rim)" base="var(--boot-land-near)" />
        </g>
        <path
          className="boot-reflection"
          d={`M${-9 * s} 51H${9 * s}M${-5 * s} 58H${6 * s}M${-3 * s} 66H${2 * s}M${-1.5 * s} 75H${1.5 * s}`}
          stroke={`var(--boot-light-${tone})`} strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity=".3"
        />
      </svg>
      <svg {...TUBE_BOX} className={cn(TUBE_BOX.className, 'boot-tube-light', b && 'boot-tube-light-b')}>
        <g transform={`scale(${s})`}>
          <circle cy="-14" r="30" fill={`url(#boot-halo-${tone})`} />
          <circle cy="-14" r="7" fill={`url(#boot-core-${tone})`} />
          <rect x="-.7" y="-18.5" width="1.4" height="8" rx=".7" fill={`var(--boot-light-${tone})`} />
        </g>
      </svg>
    </div>
  )
}

/** One depth of the valley: a box the size of the ground, grown from the crest's peak as the boot flies in (`--depth`,
 *  1 farthest). */
const Depth = ({ depth, children }: { depth: number; children: React.ReactNode }) => (
  <div className="boot-depth absolute inset-0" style={{ '--depth': depth } as React.CSSProperties}>
    {children}
  </div>
)

/** Two ranges deep in the room's language (the generator's own back and distant peaks, flattened), mist lying between
 *  them, the lit crest with amp tubes at its edges, and a still lake holding the glow. Every layer shares one viewBox and
 *  the box keeps the viewBox's height in view (`.boot-ground`), so the mist's HTML band lines up between the ranges.
 *  Only the mist and the tubes' light move, each on a box of its own; the tubes are HTML pinned to the screen's edges. */
function Ground() {
  const { land } = SCENE
  return (
    <div className="boot-ground absolute inset-x-0 bottom-0">
      <Depth depth={1}>
        <svg {...ground}>
          <g transform="translate(0 130) scale(1 .65)">
            <path d={land.back} fill="var(--boot-land-back)" />
            <path d={land.backRim} fill="none" stroke="var(--boot-rim)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" opacity=".5" />
          </g>
        </svg>
      </Depth>
      <Depth depth={2}>
        <div className="boot-mist absolute inset-x-0" />
      </Depth>
      <Depth depth={3}>
        <svg {...ground}>
          <g transform="translate(0 175) scale(1 .6)">
            <path d={land.distant} fill="var(--boot-land-distant)" />
            <path d={land.distantRim} fill="none" stroke="var(--boot-rim)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" opacity=".35" />
          </g>
        </svg>
      </Depth>
      <Depth depth={5}>
        <svg {...ground}>
          <defs>
            <radialGradient id="boot-glow" cx="960" cy="266" r="700" gradientTransform="translate(0 266) scale(1 .16) translate(0 -266)" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--boot-glow)" />
              <stop offset="1" stopColor="var(--boot-glow)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="boot-trace" x1="0" x2="1">
              <stop offset=".08" stopColor="var(--boot-trace)" stopOpacity="0" />
              <stop offset=".5" stopColor="var(--boot-trace)" />
              <stop offset=".92" stopColor="var(--boot-trace)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="boot-near" x1="0" y1="262" x2="0" y2="340" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--boot-land-near)" />
              <stop offset="1" stopColor="var(--boot-land-foot)" />
            </linearGradient>
            {/* Each tube's light (orange or pink) eases toward the other's at its rim, so neighbouring halos blend */}
            {(['tube', 'rose'] as const).map((tone) => (
              <Fragment key={tone}>
                <radialGradient id={`boot-halo-${tone}`}>
                  <stop offset="0" stopColor={`var(--boot-light-${tone})`} stopOpacity=".34" />
                  <stop offset=".55" stopColor="var(--boot-light-blend)" stopOpacity=".17" />
                  <stop offset="1" stopColor="var(--boot-light-blend)" stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`boot-core-${tone}`}>
                  <stop offset=".2" stopColor={`var(--boot-light-${tone})`} stopOpacity=".8" />
                  <stop offset="1" stopColor={`var(--boot-light-${tone})`} stopOpacity="0" />
                </radialGradient>
              </Fragment>
            ))}
            {/* The lake holds the glow as a long, soft column under the crest's peak */}
            <radialGradient id="boot-sheen" cx="960" cy="340" r="420" gradientTransform="translate(960 340) scale(1 .18) translate(-960 -340)" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--boot-glow)" />
              <stop offset="1" stopColor="var(--boot-glow)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1920" height="400" fill="url(#boot-glow)" />
          <path d={`${CREST}V400H0Z`} fill="url(#boot-near)" />
          <path d={CREST} fill="none" stroke="url(#boot-trace)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
          <rect y="340" width="1920" height="60" fill="var(--boot-lake)" />
          <path d="M0 340.5H1920" stroke="url(#boot-trace)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".35" />
          <rect y="340" width="1920" height="60" fill="url(#boot-sheen)" />
        </svg>
        {TUBES.map((tube) => <Tube key={`${tube.side}${tube.s}`} {...tube} />)}
      </Depth>
    </div>
  )
}
