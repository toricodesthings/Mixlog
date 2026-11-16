import { memo, useId, type CSSProperties, type ReactNode } from 'react'

import type { Fingerprint } from '#/server/loudness'
import { sceneOf, TOP, viewBoxOf, type MoonZone, type SceneModel, type Window } from './generate'
import { TubeShape } from './Tube'
import { useOutgoing } from './use-outgoing'

/*
 * The ground under a release's sky: a painted night drawn from the song's own fingerprint (`generate.ts`). Back to
 * front, in five depth groups (each an HTML box holding its SVG, so the pointer can lean them apart, `[data-pointer-read]`
 * with its `--shift` in px): the back range with its snow, the high fog and the low cloud bank, the distant range and
 * the cliffs with the landmark, the mid fog, the signal ridge, banks and lake, the low fog, the near banks and the
 * hearth, then the foreground (the framing tree, the knoll with its amp tube, the reeds). Every colour comes from the
 * artwork (`.art-scene` in app.css). The drawing always keeps its full height (1.7.2): when its box is short the peaks
 * rise above it, behind whatever floats there, and its top fades rather than ever meeting a hard edge. Everything that
 * moves is HTML animated with `opacity`, `translate` or `scale` alone, which the compositor runs without repainting.
 */

const H = 300

type LandProps = { sceneId: string; fp: Fingerprint | null; zone: MoonZone; frame: number; seat?: boolean; className?: string }
type ModelProps = { m: SceneModel; uid: string; seat?: boolean }

const svgProps = (frame: number) => ({ viewBox: viewBoxOf(frame), preserveAspectRatio: 'xMidYMax slice', 'aria-hidden': true, focusable: false, className: 'absolute inset-0 size-full overflow-visible' }) as const

function Grad({ id, top, base }: { id: string; top: string; base: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={top} />
      <stop offset="1" stopColor={base} />
    </linearGradient>
  )
}

/** A range's moonlit rim, lifted on the pointer's side: `d`, its gradient's `id`, and the range's `filter`. */
type Lift = { d: string; id: string; filter?: string }

/** One depth of the land: an HTML box the pointer can lean (`--shift`, its most in px), holding its own SVG. A `lift`
 *  adds its rim twice more, lit toward each side by a fixed gradient up to 10%, in its own SVG whose opacity the pointer
 *  sets (`data-pointer-lift`): the compositor fades it, so the range never repaints. */
function Depth({ shift, frame, children, className, lift }: { shift: number; frame: number; children: ReactNode; className?: string; lift?: Lift }) {
  return (
    <div data-pointer-read className={`scene-depth absolute inset-0 ${className ?? ''}`} style={{ '--shift': shift } as CSSProperties}>
      <svg {...svgProps(frame)}>{children}</svg>
      {lift && ([-1, 1] as const).map((side) => (
        <svg key={side} {...svgProps(frame)} data-pointer-lift={side} style={{ opacity: 0 }}>
          <linearGradient id={`${lift.id}${side}`} gradientUnits="userSpaceOnUse" x1="0" x2={frame} y1="0" y2="0">
            <stop offset="0" stopColor="var(--land-rim)" stopOpacity={side === -1 ? 0.1 : 0} />
            <stop offset="1" stopColor="var(--land-rim)" stopOpacity={side === 1 ? 0.1 : 0} />
          </linearGradient>
          <path d={lift.d} fill="none" stroke={`url(#${lift.id}${side})`} strokeWidth="1.4" strokeLinecap="round" filter={lift.filter} />
        </svg>
      ))}
    </div>
  )
}

/** The shared gradients and filters, referenced by every depth's SVG (ids are document-wide). */
function Defs({ m, uid }: ModelProps) {
  const { lake } = m.land
  return (
    <svg aria-hidden="true" className="absolute size-0">
      <defs>
        <Grad id={`${uid}back`} top="color-mix(in oklab, var(--land-back) 70%, var(--land-haze))" base="var(--land-haze)" />
        <Grad id={`${uid}distant`} top="var(--land-distant)" base="var(--land-haze)" />
        <Grad id={`${uid}far`} top="var(--land-far)" base="var(--land-haze)" />
        <Grad id={`${uid}signal`} top="var(--land-signal)" base="var(--land-far)" />
        <Grad id={`${uid}bank`} top="var(--land-valley)" base="var(--land-signal)" />
        <Grad id={`${uid}near`} top="var(--land-valley)" base="var(--land-near)" />
        <linearGradient id={`${uid}lake`} gradientUnits="userSpaceOnUse" x1="0" y1={lake.y} x2="0" y2={H}>
          <stop offset="0" stopColor="color-mix(in oklab, var(--land-haze) 50%, var(--land-far))" />
          <stop offset="1" stopColor="var(--land-near)" />
        </linearGradient>
        <linearGradient id={`${uid}reflect`} gradientUnits="userSpaceOnUse" x1="0" y1={lake.y} x2="0" y2={lake.y + 40}>
          <stop offset="0" stopColor="var(--land-far)" stopOpacity=".12" />
          <stop offset="1" stopColor="var(--land-far)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}fall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--land-rim)" stopOpacity=".4" />
          <stop offset="1" stopColor="var(--land-rim)" stopOpacity=".1" />
        </linearGradient>
        <linearGradient id={`${uid}mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--land-haze)" stopOpacity="0" />
          <stop offset=".55" stopColor="var(--land-haze)" stopOpacity=".55" />
          <stop offset="1" stopColor="var(--land-haze)" stopOpacity="0" />
        </linearGradient>
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
          <stop offset="0" stopColor="var(--scene-window)" stopOpacity=".26" />
          <stop offset="1" stopColor="var(--scene-window)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}streak`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--scene-lamp)" stopOpacity=".45" />
          <stop offset="1" stopColor="var(--scene-lamp)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}lowbank`} x1="0" y1="0" x2="0" y2="1">
          <stop offset=".1" stopColor="var(--scene-cloud-lit)" />
          <stop offset=".8" stopColor="var(--scene-cloud)" />
          <stop offset="1" stopColor="var(--scene-cloud)" stopOpacity="0" />
        </linearGradient>
        <filter id={`${uid}soft`} x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
        <filter id={`${uid}haze`} x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id={`${uid}cloud`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
    </svg>
  )
}

/** The static terrain, in its depth groups, with the fog sheets between them. Memoised by the model. */
const Terrain = memo(function Terrain({ m, uid, sig }: ModelProps & { sig: string }) {
  const { land, frame: W } = m
  const u = (name: string) => `url(#${uid}${name})`
  const { lake } = land
  const lit = (o: number) => Math.min(1, o * land.light)
  const rim = (d: string, o: number, w = 1.4) => <path d={d} fill="none" stroke="var(--land-rim)" strokeWidth={w} strokeLinecap="round" opacity={lit(o)} />
  const lb = land.lowBank
  const fog = (cls: string, y: number, shift: number) => (
    <div data-pointer-read className={`scene-depth scene-fog ${cls} pointer-events-none absolute inset-x-0`} style={{ '--shift': shift, top: `${((y - TOP) / (H - TOP)) * 100}%` } as CSSProperties} />
  )
  return (
    <>
      <Defs m={m} uid={uid} />
      {/* The back range: the song's form, half lost in the haze, strata down its moonlit slopes, snow on a loud one */}
      <Depth shift={2} frame={W} lift={{ d: land.backRim, id: `${uid}liftback`, filter: u('soft') }}>
        <g filter={u('soft')}>
          <path d={land.back} fill={u('back')} />
          {land.snow && <path d={land.snow} fill="var(--land-rim)" opacity=".3" />}
          {rim(land.backRim, 0.25)}
          {rim(land.backStrata[0], 0.1)}
          {rim(land.backStrata[1], 0.05)}
        </g>
      </Depth>
      {fog('scene-fog-high', 30, 2.5)}
      {/* The low bank lies between the ranges: behind one mountain, in front of another */}
      <div data-pointer-read className="scene-depth pointer-events-none absolute inset-0" style={{ '--shift': 2.5 } as CSSProperties}>
        <div className="scene-cloud-bank scene-lowbank absolute inset-0">
          <svg {...svgProps(W)}>
            {/* Near the land a cloud is barely there: a sheet of fog more than a cloud */}
            <g transform={`translate(${lb.x},${lb.y})`} opacity=".28">
              <path d={lb.d} fill={u('lowbank')} filter={u('haze')} />
            </g>
          </svg>
        </div>
      </div>
      {/* The distant range (the song's sections) and the cliffs (its changes), the landmark, the waterfall */}
      <Depth shift={3} frame={W} lift={{ d: land.distantRim, id: `${uid}liftdistant`, filter: u('soft') }}>
        <g filter={u('soft')}>
          <path d={land.distant} fill={u('distant')} />
          {rim(land.distantRim, 0.22)}
          {rim(land.distantStrata[0], 0.09)}
          {rim(land.distantStrata[1], 0.045)}
        </g>
        <rect y="40" width={W} height="90" fill={u('mist')} opacity=".8" />
      </Depth>
      <Depth shift={4} frame={W} lift={{ d: land.farRim, id: `${uid}liftfar` }}>
        <path d={land.far} fill={u('far')} />
        {rim(land.farRim, 0.2, 1.2)}
        {land.fall && (
          <path
            d={`M${land.fall.x - land.fall.width / 2},${land.fall.top}L${land.fall.x + land.fall.width / 2},${land.fall.top}L${land.fall.x + land.fall.width * 0.7},${land.fall.bottom}L${land.fall.x - land.fall.width * 0.7},${land.fall.bottom}Z`}
            fill={u('fall')}
          />
        )}
        {land.landmark === 'mast' || land.landmark === 'bridge' ? (
          <path d={land.mast} fill={land.landmark === 'bridge' ? 'var(--land-signal)' : 'none'} stroke="var(--land-signal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d={land.mast} fill="var(--land-signal)" />
        )}
        <g filter={u('haze')}>
          <path d={land.mists.back[0]} fill={u('wisp')} />
          <path d={land.mists.back[1]} fill={u('wisp')} />
        </g>
      </Depth>
      {fog('scene-fog-mid', 135, 4)}
      {/* The signal ridge, the banks and the lake */}
      <Depth shift={6} frame={W}>
        <path d={land.signalFill} fill={u('signal')} />
        <use href={`#${sig}`} fill="none" strokeWidth="4" className="scene-trace" opacity=".16" filter={u('haze')} />
        <path d={land.banks} fill={u('bank')} />
        {rim(land.banksRim, 0.16, 1)}
        <rect x="-40" y={lake.y} width={W + 80} height={H - lake.y + 30} fill={u('lake')} />
        {land.reflection && <path d={land.reflection} fill={u('reflect')} />}
        <ellipse cx={lake.moonX} cy={lake.y + 10} rx="150" ry="10" fill={u('moonpool')} opacity={lit(0.85)} />
        <path d={lake.ripples} stroke="var(--land-rim)" strokeWidth=".8" strokeLinecap="round" opacity={lit(0.18)} />
        <g className="scene-lamps">
          {land.shore.map(([x], i) => <rect key={i} x={x - 1.5} y={lake.y + 1} width="3" height="24" rx="1.5" fill={u('streak')} />)}
        </g>
        <g filter={u('haze')}>
          <path d={land.mists.front[0]} fill={u('wisp')} opacity=".7" />
        </g>
      </Depth>
      {fog('scene-fog-low', 222, 8)}
      {/* The near banks and the hearth: its pool of light clipped to the bank it lies on */}
      <Depth shift={8} frame={W}>
        <defs>
          <clipPath id={`${uid}ground`}>
            <path d={land.near} />
          </clipPath>
        </defs>
        <path d={land.near + land.woods} fill={u('near')} />
        <ellipse className="scene-lamps" cx={land.hearth.x} cy={land.hearth.y} rx="150" ry="40" fill={u('hearth')} clipPath={`url(#${uid}ground)`} />
        {/* Houses one step lighter than their ground, the roof plane facing the moon lit */}
        <path d={land.houses} fill="var(--land-far)" className="scene-houses" />
        <path d={land.roofs} fill="var(--land-rim)" opacity={lit(0.25)} />
        {rim(land.nearRim, 0.14, 1)}
      </Depth>
    </>
  )
})

/** The framing tree, the knoll and the reeds: the darkest thing on screen, crisp, nearest of all. The tree leans
 *  toward the pointer from its trunk's foot and breathes on its own at rest. */
const Foreground = memo(function Foreground({ m, uid, seat }: ModelProps) {
  const { land, frame: W } = m
  const foot = `${(land.treeFoot[0] / W) * 100}% 100%`
  return (
    <div data-pointer-read className="scene-depth absolute inset-0" style={{ '--shift': 12 } as CSSProperties}>
      <div data-pointer-lean="0.6" className="scene-tree absolute inset-0" style={{ transformOrigin: foot }}>
        <svg {...svgProps(W)}>
          <path d={land.treeRim} fill="var(--land-rim)" opacity={Math.min(1, 0.2 * land.light)} />
          <path d={land.tree} fill="var(--land-fore)" />
          {/* The canopy a tone lighter inside (softened, so it reads as foliage, not discs), the limbs dark across it,
              and a soft glow where the top catches the moon */}
          <path d={land.treeLeaves} fill="color-mix(in oklab, var(--land-fore) 60%, var(--land-valley))" filter={`url(#${uid}soft)`} />
          <path d={land.treeLimbs} fill="var(--land-fore)" />
          <path d={land.treeLit} fill="var(--land-rim)" opacity={Math.min(1, 0.12 * land.light)} filter={`url(#${uid}haze)`} />
        </svg>
      </div>
      <svg {...svgProps(W)}>
        {seat && <path d={land.knoll} fill="var(--land-fore)" />}
      </svg>
      <div data-pointer-lean="1" className="scene-reeds absolute inset-0" style={{ transformOrigin: '50% 100%' }}>
        <svg {...svgProps(W)}>
          <path d={land.reeds} fill="var(--land-fore)" />
        </svg>
      </div>
    </div>
  )
})

/** A light: a soft glow and a core, sized by its depth so lights place themselves in space. */
const SIZE = { far: { r: 0.9, glow: 3, o: 0.6 }, mid: { r: 1.3, glow: 4, o: 0.8 }, near: { r: 1.8, glow: 5.5, o: 1 } } as const
function WindowLight({ w, glow }: { w: Window; glow: string }) {
  const s = SIZE[w.depth]
  // A warm rectangle, 2 × 3 units at its depth, a mullion on near ones
  const [ww, hh] = [2 * s.r, 3 * s.r]
  return (
    <g opacity={s.o}>
      <circle cx={w.x} cy={w.y} r={s.r * s.glow} fill={glow} />
      <rect x={w.x - ww / 2} y={w.y - hh / 2} width={ww} height={hh} fill="var(--scene-window)" />
      {w.depth === 'near' && <rect x={w.x - 0.2} y={w.y - hh / 2} width=".4" height={hh} fill="var(--land-far)" />}
    </g>
  )
}

/** The lights: the hearth's windows breathing (and, while the song plays, with its bass), the lone farms, the beacon.
 *  Each group one HTML layer whose opacity alone animates. */
const Lights = memo(function Lights({ m, uid }: ModelProps) {
  const { land, frame: W } = m
  const near = land.windows.filter((w) => w.depth === 'near')
  const far = land.windows.filter((w) => w.depth !== 'near')
  const glow = (tone: string) => `url(#${uid}glow-${tone})`
  const [bx, by] = land.beacon
  return (
    <>
      <svg aria-hidden="true" className="absolute size-0">
        <defs>
          {['window', 'beacon'].map((tone) => (
            <radialGradient key={tone} id={`${uid}glow-${tone}`}>
              <stop offset="0" stopColor={`var(--scene-${tone})`} stopOpacity=".55" />
              <stop offset="1" stopColor={`var(--scene-${tone})`} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
      </svg>
      <div data-pointer-read className="scene-depth scene-lamps absolute inset-0" style={{ '--shift': 4 } as CSSProperties}>
        <div className="scene-lamp absolute inset-0" style={{ animationDuration: '5.3s', animationDelay: '-2.2s' }}>
          <svg {...svgProps(W)}>{far.map((w) => <WindowLight key={`${w.x},${w.y}`} w={w} glow={glow('window')} />)}</svg>
        </div>
        <div className="scene-beacon-light absolute inset-0">
          <svg {...svgProps(W)}>
            <circle cx={bx} cy={by} r={2.2 * 4} fill={glow('beacon')} />
            <circle cx={bx} cy={by} r={1.6} fill="var(--scene-beacon)" />
          </svg>
        </div>
      </div>
      <div data-pointer-read className="scene-depth scene-lamps absolute inset-0" style={{ '--shift': 8 } as CSSProperties}>
        <div data-signal-read className="scene-lamp scene-hearth absolute inset-0">
          <svg {...svgProps(W)}>{near.map((w) => <WindowLight key={`${w.x},${w.y}`} w={w} glow={glow('window')} />)}</svg>
        </div>
      </div>
    </>
  )
})

/** The scope trace, drawing in once. It holds the signal path the bloom and the spark draw with `<use>`. */
function Trace({ m, sig, arrived }: { m: SceneModel; sig: string; arrived: string }) {
  return (
    <div data-pointer-read className="scene-depth absolute inset-0" style={{ '--shift': 6 } as CSSProperties}>
      <svg {...svgProps(m.frame)}>
        <defs>
          <path id={sig} d={m.land.signal} />
        </defs>
        <path d={m.land.signal} key={arrived} pathLength={1} fill="none" strokeWidth="1.25" strokeLinejoin="round" className="scope-trace scene-trace" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

const pct = (v: number) => `${v * 100}%`
const DASH = 14

/** What moves on the land, as HTML over it: a box laid exactly over the land's drawing, so anything inside sits in
 *  land units as percentages and moves with `translate` alone. The waterfall, the spark, the smoke, the tube lamps. */
function Stage({ m, sig, seat }: { m: SceneModel; sig: string; seat?: boolean }) {
  const { land, frame: W } = m
  const { fall } = land
  const height = H - TOP
  const at = ([x, y]: readonly [number, number]) => ({ left: pct(x / W), top: pct((y - TOP) / height) })
  return (
    <div className="absolute bottom-0 left-1/2" style={{ width: `max(100cqw, 100cqh * ${W / height})`, aspectRatio: `${W} / ${height}`, transform: 'translateX(-50%)' }}>
      {fall && (() => {
        const w = fall.width * 1.4
        const tall = fall.bottom - 2 - fall.top
        const run = Math.ceil(tall / DASH) * DASH
        return (
          <div data-pointer-read className="scene-depth absolute overflow-hidden" style={{ '--shift': 4, left: pct((fall.x - w / 2) / W), top: pct((fall.top - TOP) / height), width: pct(w / W), height: pct(tall / height) } as CSSProperties}>
            <div className="scene-fall absolute inset-x-0 top-0" style={{ height: pct((2 * run) / tall), animationDuration: `${(1.6 * run) / 28}s` }}>
              <svg viewBox={`0 0 ${w} ${2 * run}`} preserveAspectRatio="none" className="size-full">
                {[-0.25, 0.1, 0.32].map((f) => <line key={f} x1={w / 2 + f * fall.width} y1={0} x2={w / 2 + f * fall.width} y2={2 * run} />)}
              </svg>
            </div>
          </div>
        )
      })()}
      <div data-pointer-read className="scene-depth absolute inset-0" style={{ '--shift': 6 } as CSSProperties}>
        <div className="scene-pulse absolute inset-y-0 left-0 w-[2.5%] overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-[4000%]">
            <svg viewBox={viewBoxOf(W)} preserveAspectRatio="none" className="size-full" fill="none" strokeLinecap="round">
              <use href={`#${sig}`} strokeWidth="5" opacity=".2" />
              <use href={`#${sig}`} strokeWidth="2.5" opacity=".85" />
            </svg>
          </div>
        </div>
      </div>
      {/* Someone is home: smoke from the hearth's chimney, rising and thinning */}
      {land.smoke && (
        <div data-pointer-read className="scene-depth scene-lamps absolute inset-0" style={{ '--shift': 8 } as CSSProperties}>
          <span className="scene-smoke absolute" style={at(land.smoke)} />
        </div>
      )}
      {/* The shore's tube lamp, and on Summary the amp on the knoll: the listener's seat, breathing with the bass */}
      {land.shore.map((p, i) => (
        <div key={i} data-pointer-read className="scene-depth scene-lamps absolute inset-0" style={{ '--shift': 6 } as CSSProperties}>
          <TubeShape className="absolute w-[0.55%] -translate-x-1/2 -translate-y-full" style={at(p)} />
        </div>
      ))}
      {seat && (
        <div data-pointer-read className="scene-depth absolute inset-0" style={{ '--shift': 12 } as CSSProperties}>
          <TubeShape glowing data-signal-read className="scene-amp absolute w-[0.9%] -translate-x-1/2 -translate-y-full" style={at(land.amp)} />
        </div>
      )}
      {land.fireflies.map((f, i) => (
        <span key={i} className="scene-firefly scene-lamps absolute" style={{ ...at([f.x, f.y]), animationDelay: `${-f.delay}s` }} />
      ))}
    </div>
  )
}

/** Sky lanterns rising from the hearth, warm, in front of the land. */
function Lanterns({ m }: { m: SceneModel }) {
  return (
    <div aria-hidden="true" className="scene-lamps pointer-events-none absolute inset-0 overflow-hidden">
      {m.land.lanterns.map((l, i) => (
        <span
          key={i}
          className="scene-lantern absolute"
          style={{ left: `${(l.x / m.frame) * 100}%`, bottom: `${((H - 236) / (H - TOP)) * 100}%`, '--duration': `${l.duration}s`, '--rest': `${-25 - (l.delay % 40)}px`, animationDelay: `${-l.delay}s` } as CSSProperties}
        />
      ))}
    </div>
  )
}

/** One whole land: the drawing at its full height, bottom-anchored, clipped at the sides and bottom only. */
function Body({ sceneId, fp, zone, frame, seat, outgoing }: Omit<LandProps, 'className'> & { outgoing?: boolean }) {
  const m = sceneOf(sceneId, fp, zone, frame)
  const uid = useId().replace(/[^\w-]/g, '')
  const sig = `${uid}sig`
  return (
    <div
      className={`scene-land pointer-events-none absolute inset-x-0 bottom-0 -z-10 [container-type:size] ${outgoing ? 'scene-outgoing' : ''}`}
      style={{ aspectRatio: `${frame} / ${H - TOP}`, minHeight: `${((H - TOP) / H) * 100}%`, '--weather': m.land.weather } as CSSProperties}
    >
      <Terrain m={m} uid={uid} sig={sig} />
      <Lights m={m} uid={uid} />
      <Trace m={m} sig={sig} arrived={fp ? 'f' : 'd'} />
      <Stage m={m} sig={sig} seat={seat} />
      <Foreground m={m} uid={uid} seat={seat} />
      <Lanterns m={m} />
      <div data-pointer-read className="scene-pointer-light absolute" />
    </div>
  )
}

const keyOf = (fp: Fingerprint | null) => (fp ? JSON.stringify(fp) : 'd')

/** The land fills its box's width and keeps the drawing's full height, so on a short box its peaks rise into the sky
 *  above, behind whatever floats there. When the song's measurement arrives, the old night cross-fades to the new. */
export const Land = memo(function Land({ sceneId, fp, zone, frame, seat, className }: LandProps) {
  const out = useOutgoing(sceneId, keyOf(fp), fp)
  return (
    <div className={className}>
      {out && <Body key={`o${out.key}`} sceneId={sceneId} fp={out.value} zone={zone} frame={frame} seat={seat} outgoing />}
      <Body key={keyOf(fp)} sceneId={sceneId} fp={fp} zone={zone} frame={frame} seat={seat} />
    </div>
  )
}, (a, b) => a.sceneId === b.sceneId && keyOf(a.fp) === keyOf(b.fp) && a.zone === b.zone && a.frame === b.frame && a.seat === b.seat && a.className === b.className)
