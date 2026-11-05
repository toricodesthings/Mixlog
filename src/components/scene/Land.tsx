import { memo, useId, type CSSProperties } from 'react'

import type { Fingerprint } from '#/server/loudness'
import { sceneOf, TOP, VIEW_BOX, type MoonZone } from './generate'

/*
 * The ground under a release's sky (1.3.0): a painted night valley drawn from the song's own fingerprint
 * (`generate.ts`), in Cadence's landscape language. Back to front: rounded peaks rising into the sky, the cliffs with
 * the beacon and the waterfall, the signal ridge (the song's own loudness, left to right, with a scope trace), wooded
 * banks running down to a still lake, the near banks with the village and its farmhouses, the framing tree. Every
 * ridge takes its own colour, nearer ones darker and crisper (`.art-scene` in app.css sets every colour from the
 * artwork), the moon rims only the slopes turned toward it, and wisps of mist lie between the planes. The land stands
 * `-TOP` units taller than its box, so the peaks rise into the sky above the band. The terrain is drawn once and never
 * moves; everything that does (the lights, the waterfall, the spark, the lanterns) is an HTML layer over it animated
 * with `opacity` and `translate` alone, which the compositor runs without repainting a frame (§9).
 */

const W = 1920
const H = 300

function Grad({ id, top, base }: { id: string; top: string; base: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={top} />
      <stop offset="1" stopColor={base} />
    </linearGradient>
  )
}

/** A band of haze: clear at both edges, densest just below the middle. */
function Mist({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={color} stopOpacity="0" />
      <stop offset=".55" stopColor={color} stopOpacity=".55" />
      <stop offset="1" stopColor={color} stopOpacity="0" />
    </linearGradient>
  )
}

/** A light: a soft glow and a bright core, warm (`--scene-lamp`) or the beacon's own. */
function Light({ id, at: [x, y], r, tone }: { id: string; at: readonly [number, number]; r: number; tone: 'lamp' | 'beacon' }) {
  return (
    <>
      <circle cx={x} cy={y} r={r * 5.5} fill={`url(#${id}glow-${tone})`} />
      <circle cx={x} cy={y} r={r} fill={`var(--scene-${tone})`} />
    </>
  )
}

type LandProps = { sceneId: string; fp: Fingerprint | null; zone: MoonZone; className?: string }
/** `sig` names the one signal path (in `Trace`) that the bloom, the pulse and its tail all draw with `<use>`. */
type LayerProps = LandProps & { sig: string }

const svgProps = { viewBox: VIEW_BOX, preserveAspectRatio: 'xMidYMax slice', 'aria-hidden': true, focusable: false, className: 'absolute inset-0 size-full' } as const
const sameScene = (a: LandProps, b: LandProps) => a.sceneId === b.sceneId && a.fp === b.fp && a.zone === b.zone

/** The static terrain: everything that never moves, so it carries every filter and gradient without repainting a
 *  frame. Memoised by the scene's own key, so a playhead tick or a parent re-render never rebuilds it. */
const Terrain = memo(function Terrain({ sceneId, fp, zone, sig }: LayerProps) {
  const { land } = sceneOf(sceneId, fp, zone)
  const uid = useId().replace(/[^\w-]/g, '')
  const u = (name: string) => `url(#${uid}${name})`
  const { lake } = land
  // The song sets how bright the night is: every moonlit touch below is scaled by it
  const lit = (o: number) => Math.min(1, o * land.light)
  return (
    <svg {...svgProps} style={{ contain: 'strict' }}>
      <defs>
        {/* The back range: opaque (nothing in the sky shows through a mountain), just paler, nearer the haze */}
        <Grad id={`${uid}back`} top="color-mix(in oklab, var(--land-distant) 55%, var(--land-haze))" base="var(--land-haze)" />
        <Grad id={`${uid}distant`} top="var(--land-distant)" base="var(--land-haze)" />
        <Grad id={`${uid}far`} top="var(--land-far)" base="var(--land-haze)" />
        <Grad id={`${uid}signal`} top="var(--land-signal)" base="var(--land-far)" />
        <Grad id={`${uid}bank`} top="var(--land-valley)" base="var(--land-signal)" />
        {/* Ends on the ground's own first colour (`.scene-ground`), so the banks run into the page with no seam */}
        <Grad id={`${uid}near`} top="var(--land-valley)" base="var(--land-near)" />
        <linearGradient id={`${uid}lake`} gradientUnits="userSpaceOnUse" x1="0" y1={lake.y} x2="0" y2={H}>
          <stop offset="0" stopColor="color-mix(in oklab, var(--land-haze) 50%, var(--land-far))" />
          <stop offset="1" stopColor="var(--land-near)" />
        </linearGradient>
        <linearGradient id={`${uid}fall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--land-rim)" stopOpacity=".4" />
          <stop offset="1" stopColor="var(--land-rim)" stopOpacity=".1" />
        </linearGradient>
        <Mist id={`${uid}mist`} color="var(--land-haze)" />
        {/* A wisp: clear at both ends, densest in the middle, so it has no edges */}
        <linearGradient id={`${uid}wisp`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--land-haze)" stopOpacity="0" />
          <stop offset=".5" stopColor="var(--land-haze)" stopOpacity=".7" />
          <stop offset="1" stopColor="var(--land-haze)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}moonpool`}>
          <stop offset="0" stopColor="var(--scene-moon)" stopOpacity=".22" />
          <stop offset="1" stopColor="var(--scene-moon)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}hearth`}>
          <stop offset="0" stopColor="var(--scene-lamp)" stopOpacity=".16" />
          <stop offset="1" stopColor="var(--scene-lamp)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}streak`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--scene-lamp)" stopOpacity=".45" />
          <stop offset="1" stopColor="var(--scene-lamp)" stopOpacity="0" />
        </linearGradient>
        <filter id={`${uid}soft`} x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
        <filter id={`${uid}haze`} x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Peaks, two ranges deep: the back one palest and half lost in the sky's haze, moonlight along the slopes
          turned toward it */}
      <g filter={u('soft')}>
        <path d={land.back} fill={u('back')} />
        <path d={land.backRim} fill="none" stroke="var(--land-rim)" strokeWidth="1.4" strokeLinecap="round" opacity={lit(0.25)} />
      </g>
      <g filter={u('soft')}>
        <path d={land.distant} fill={u('distant')} />
        <path d={land.distantRim} fill="none" stroke="var(--land-rim)" strokeWidth="1.4" strokeLinecap="round" opacity={lit(0.22)} />
      </g>
      <rect y="40" width={W} height="90" fill={u('mist')} opacity=".8" />

      {/* The cliffs: wooded along their crest, the beacon's mast, the waterfall down their face */}
      <path d={land.far} fill={u('far')} />
      <path d={land.farRim} fill="none" stroke="var(--land-rim)" strokeWidth="1.2" strokeLinecap="round" opacity={lit(0.2)} />
      {land.fall && (
        <path
          d={`M${land.fall.x - land.fall.width / 2},${land.fall.top}L${land.fall.x + land.fall.width / 2},${land.fall.top}L${land.fall.x + land.fall.width * 0.7},${land.fall.bottom}L${land.fall.x - land.fall.width * 0.7},${land.fall.bottom}Z`}
          fill={u('fall')}
        />
      )}
      <path d={land.mast} fill="none" stroke="var(--land-signal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <g filter={u('haze')}>
        <path d={land.mists.back[0]} fill={u('wisp')} />
        <path d={land.mists.back[1]} fill={u('wisp')} />
      </g>

      <path d={land.signalFill} fill={u('signal')} />
      {/* The trace's bloom, static and quiet (§4/§9: no filter on anything that animates) */}
      <use href={`#${sig}`} fill="none" strokeWidth="4" className="scene-trace" opacity=".16" filter={u('haze')} />

      {/* Wooded banks running down to the water, their tree line sinking into a wisp */}
      <path d={land.banks} fill={u('bank')} />
      <path d={land.banksRim} fill="none" stroke="var(--land-rim)" strokeWidth="1" strokeLinecap="round" opacity={lit(0.16)} />
      <g filter={u('haze')}>
        <path d={land.mists.back[2]} fill={u('wisp')} />
        <path d={land.mists.back[3]} fill={u('wisp')} />
      </g>

      {/* The lake: still water from its line down, its only edges the banks; the moon and the shore lamps on it */}
      <rect y={lake.y} width={W} height={H - lake.y + 2} fill={u('lake')} />
      <ellipse cx={lake.moonX} cy={lake.y + 10} rx="150" ry="10" fill={u('moonpool')} opacity={lit(0.85)} />
      <path d={lake.ripples} stroke="var(--land-rim)" strokeWidth=".8" strokeLinecap="round" opacity={lit(0.18)} />
      <g className="scene-lamps">
        {land.shore.map(([x], i) => <rect key={i} x={x - 1.5} y={lake.y + 1} width="3" height="24" rx="1.5" fill={u('streak')} />)}
      </g>
      <g filter={u('haze')}>
        <path d={land.mists.front[0]} fill={u('wisp')} opacity=".7" />
      </g>

      {/* Warm pools of lamplight tie the windows to the ground around them */}
      <g className="scene-lamps">
        <ellipse cx={land.glowX} cy={land.hamlet[0]?.ground ?? 240} rx="180" ry="44" fill={u('hearth')} />
      </g>
      <path d={land.houses} fill="var(--land-signal)" />
      <path d={land.roofs} fill="none" stroke="var(--land-rim)" strokeWidth="1" strokeLinecap="round" opacity={lit(0.28)} />
      <path d={land.near + land.woods} fill={u('near')} />
      <path d={land.nearRim} fill="none" stroke="var(--land-rim)" strokeWidth="1" strokeLinecap="round" opacity={lit(0.14)} />
    </svg>
  )
}, sameScene)

/** The framing tree, nearest of all, so it stands in front of the trace too: lit at its crown, rimmed by the moon. */
const Foreground = memo(function Foreground({ sceneId, fp, zone }: LandProps) {
  const { land } = sceneOf(sceneId, fp, zone)
  const uid = useId().replace(/[^\w-]/g, '')
  return (
    <svg {...svgProps} style={{ contain: 'strict' }}>
      <defs>
        <linearGradient id={`${uid}tree`} gradientUnits="userSpaceOnUse" x1="0" y1="70" x2="0" y2="300">
          <stop offset="0" stopColor="var(--land-far)" />
          <stop offset=".5" stopColor="var(--land-valley)" />
          <stop offset="1" stopColor="var(--land-near)" />
        </linearGradient>
      </defs>
      <path d={land.treeRim} fill="var(--land-rim)" opacity={Math.min(1, 0.2 * land.light)} />
      <path d={land.tree} fill={`url(#${uid}tree)`} />
    </svg>
  )
}, sameScene)

/** The lights: the windows in two groups breathing out of step, and the beacon blooming, each group one HTML layer
 *  over the terrain whose opacity is all that animates, so the compositor runs them and no frame repaints the land. */
const Lights = memo(function Lights({ sceneId, fp, zone }: LandProps) {
  const { land } = sceneOf(sceneId, fp, zone)
  const uid = useId().replace(/[^\w-]/g, '')
  const lamps = [
    ...land.hamlet.map(({ window, far }) => ({ at: window, r: far ? 1.2 : 1.6 })),
    ...land.shore.map((at) => ({ at, r: 1.5 })),
  ]
  const layers = [
    { className: 'scene-lamp', style: undefined, lights: lamps.filter((_, i) => i % 2 === 0), tone: 'lamp' as const },
    { className: 'scene-lamp', style: { animationDuration: '5.3s', animationDelay: '-2.2s' }, lights: lamps.filter((_, i) => i % 2 === 1), tone: 'lamp' as const },
    { className: 'scene-beacon-light', style: undefined, lights: [{ at: land.beacon, r: 2.2 }], tone: 'beacon' as const },
  ]
  return layers.map(({ className, style, lights, tone }, i) => (
    <div key={i} className={`scene-lamps ${className} absolute inset-0`} style={style}>
      <svg {...svgProps}>
        <defs>
          <radialGradient id={`${uid}${i}glow-${tone}`}>
            <stop offset="0" stopColor={`var(--scene-${tone})`} stopOpacity=".55" />
            <stop offset="1" stopColor={`var(--scene-${tone})`} stopOpacity="0" />
          </radialGradient>
        </defs>
        {lights.map(({ at, r }) => <Light key={`${at}`} id={`${uid}${i}`} at={at} r={r} tone={tone} />)}
      </svg>
    </div>
  ))
}, sameScene)

/** The scope trace, drawing in once: the only thing in an `<svg>` that moves, and only on arrival. It holds the signal
 *  path the bloom and the spark draw with `<use>`. */
function Trace({ sceneId, fp, zone, sig }: LayerProps) {
  const { land } = sceneOf(sceneId, fp, zone)
  return (
    <svg {...svgProps}>
      <defs>
        <path id={sig} d={land.signal} />
      </defs>
      <path d={land.signal} key={fp ? 'f' : 'd'} pathLength={1} fill="none" strokeWidth="1.25" strokeLinejoin="round" className="scope-trace scene-trace" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const pct = (v: number) => `${v * 100}%`
/** A waterfall thread's dash period, in land units. */
const DASH = 14

/** What moves on the land, as HTML over it (§9): a box laid exactly over the land's drawing (the `xMidYMax slice` of its
 *  viewBox, through container units), so anything inside can sit in land units as percentages and move with
 *  `translate` alone. The waterfall's threads fall; the spark runs the ridge. */
function Stage({ sceneId, fp, zone, sig }: LayerProps) {
  const { land } = sceneOf(sceneId, fp, zone)
  const { fall } = land
  const height = H - TOP
  return (
    <div className="absolute bottom-0 left-1/2" style={{ width: `max(100cqw, 100cqh * ${W / height})`, aspectRatio: `${W} / ${height}`, transform: 'translateX(-50%)' }}>
      {fall && (() => {
        const w = fall.width * 1.4
        const tall = fall.bottom - 2 - fall.top
        const run = Math.ceil(tall / DASH) * DASH
        return (
          <div className="absolute overflow-hidden" style={{ left: pct((fall.x - w / 2) / W), top: pct((fall.top - TOP) / height), width: pct(w / W), height: pct(tall / height) }}>
            <div className="scene-fall absolute inset-x-0 top-0" style={{ height: pct((2 * run) / tall), animationDuration: `${(1.6 * run) / 28}s` }}>
              <svg viewBox={`0 0 ${w} ${2 * run}`} preserveAspectRatio="none" className="size-full">
                {[-0.25, 0.1, 0.32].map((f) => <line key={f} x1={w / 2 + f * fall.width} y1={0} x2={w / 2 + f * fall.width} y2={2 * run} />)}
              </svg>
            </div>
          </div>
        )
      })()}
      <div className="scene-pulse absolute inset-y-0 left-0 w-[2.5%] overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-[4000%]">
          <svg viewBox={VIEW_BOX} preserveAspectRatio="none" className="size-full" fill="none" strokeLinecap="round">
            <use href={`#${sig}`} strokeWidth="5" opacity=".2" />
            <use href={`#${sig}`} strokeWidth="2.5" opacity=".85" />
          </svg>
        </div>
      </div>
    </div>
  )
}

/** Sky lanterns rising slowly from the valley, warm, in front of the land; night-only, with the rest of `.scene-lamps`. */
function Lanterns({ sceneId, fp, zone }: LandProps) {
  const { land } = sceneOf(sceneId, fp, zone)
  return (
    <div aria-hidden="true" className="scene-lamps pointer-events-none absolute inset-0 overflow-hidden">
      {land.lanterns.map((l, i) => (
        <span
          key={i}
          className="scene-lantern absolute"
          style={{ left: `${(l.x / W) * 100}%`, bottom: `${((H - 236) / (H - TOP)) * 100}%`, '--duration': `${l.duration}s`, '--rest': `${-25 - (l.delay % 40)}px`, animationDelay: `${-l.delay}s` } as CSSProperties}
        />
      ))}
    </div>
  )
}

/** The land fills its box's width and stands taller than it, bottom-aligned, so its peaks reach into the sky above;
 *  behind whatever floats there (the signal path), in front of the sky and the horizon's glow. */
export function Land({ sceneId, fp, zone, className }: LandProps) {
  const sig = `${useId().replace(/[^\w-]/g, '')}sig`
  return (
    <div className={className}>
      {/* A size container, so the stage can match the land's drawing in container units */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 overflow-hidden [container-type:size]" style={{ height: `${((H - TOP) / H) * 100}%` }}>
        <Terrain sceneId={sceneId} fp={fp} zone={zone} sig={sig} />
        <Lights sceneId={sceneId} fp={fp} zone={zone} />
        <Trace sceneId={sceneId} fp={fp} zone={zone} sig={sig} />
        <Stage sceneId={sceneId} fp={fp} zone={zone} sig={sig} />
        <Foreground sceneId={sceneId} fp={fp} zone={zone} />
        <Lanterns sceneId={sceneId} fp={fp} zone={zone} />
      </div>
    </div>
  )
}
