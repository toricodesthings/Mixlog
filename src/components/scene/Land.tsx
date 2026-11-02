import { useId, type CSSProperties } from 'react'

/*
 * The ground under a release's sky, in Cadence's landscape language (its landing hero), on a 1920×300 band that
 * sits on the release's facts (`xMidYMax slice`, at its natural height on wide screens, so nothing is cropped there;
 * phones keep the middle). Back to front: hazy spires, the far ridge with a broadcast mast carrying the one Phantom
 * light, mist, the signal ridge, valley fog, then the near hills with their woods and a hamlet whose windows are the
 * warm lights. Aerial perspective does the depth: each nearer layer is darker and crisper (`.art-room` in
 * app.css sets every colour from the artwork). Mixlog draws sound where Cadence draws hills, so the signal ridge is an
 * envelope (a swell, then attack, decay, sustain and release, then a peak) with a scope trace along it.
 */

type Pt = readonly [number, number]

const W = 1920
const H = 300

/** Seeded, so the woods are the same on every visit. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const n1 = (v: number) => Math.round(v * 10) / 10
const pt = (x: number, y: number) => `${n1(x)},${n1(y)}`
const polyline = (points: readonly Pt[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${pt(x, y)}`).join('')

/**
 * A ridge through `keys` (x rising): a centripetal Catmull–Rom curve, sampled every 6 units. It rounds through each key
 * the way a hill does, carrying its slope over the summit instead of stopping flat, and the centripetal form never
 * loops or cusps however close two keys sit.
 */
function curve(keys: readonly Pt[]): Pt[] {
  const [first, second, last, before] = [keys[0], keys[1], keys[keys.length - 1], keys[keys.length - 2]]
  const pad: Pt[] = [[2 * first[0] - second[0], 2 * first[1] - second[1]], ...keys, [2 * last[0] - before[0], 2 * last[1] - before[1]]]
  const out: Pt[] = [first]
  for (let i = 1; i < pad.length - 2; i++) {
    const [p0, p1, p2, p3] = [pad[i - 1], pad[i], pad[i + 1], pad[i + 2]]
    const knot = (a: Pt, b: Pt) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-6
    const [t1, t2, t3] = [knot(p0, p1), knot(p0, p1) + knot(p1, p2), knot(p0, p1) + knot(p1, p2) + knot(p2, p3)]
    const mix = (a: Pt, b: Pt, ta: number, tb: number, t: number): Pt => [((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta), ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta)]
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 6))
    for (let k = 1; k <= steps; k++) {
      const t = t1 + ((t2 - t1) * k) / steps
      const [a1, a2, a3] = [mix(p0, p1, 0, t1, t), mix(p1, p2, t1, t2, t), mix(p2, p3, t2, t3, t)]
      out.push(mix(mix(a1, a2, 0, t2, t), mix(a2, a3, t1, t3, t), t1, t2, t))
    }
  }
  return out
}

/**
 * Natural unevenness on a ridge: seeded value noise, smoothly interpolated, in a few octaves of [wavelength,
 * amplitude], so a far slope has the small rises and dips a real one does instead of a drawn curve's regularity.
 */
function roughen(line: readonly Pt[], octaves: readonly (readonly [number, number])[], seed: number): Pt[] {
  const rand = rng(seed)
  const lattices = octaves.map(([wavelength]) => Array.from({ length: Math.ceil(W / wavelength) + 2 }, () => rand() * 2 - 1))
  const noise = (x: number) =>
    octaves.reduce((sum, [wavelength, amplitude], o) => {
      const u = x / wavelength
      const i = Math.floor(u)
      const f = (1 - Math.cos((u - i) * Math.PI)) / 2
      return sum + amplitude * (lattices[o][i] * (1 - f) + lattices[o][i + 1] * f)
    }, 0)
  return line.map(([x, y]) => [x, y + noise(Math.max(0, x))] as Pt)
}

/** A hill line: through its keys, then roughened. */
const ridge = (keys: readonly Pt[], octaves: readonly (readonly [number, number])[] = [], seed = 1) => roughen(curve(keys), octaves, seed)

/** y on a ridge at x. */
function yAt(line: readonly Pt[], x: number) {
  const i = line.findIndex(([px]) => px >= x)
  if (i <= 0) return line[i === 0 ? 0 : line.length - 1][1]
  const [[ax, ay], [bx, by]] = [line[i - 1], line[i]]
  return ay + ((by - ay) * (x - ax)) / (bx - ax || 1)
}

/** A ridge filled down past the band's bottom, so no hairline of sky shows under it. */
const fill = (line: readonly Pt[]) => `${polyline(line)}L${W},${H + 2}L0,${H + 2}Z`

/** A soft spruce: two gentle bulges and a rounded tip. */
const spruce = (x: number, b: number, h: number, w: number) =>
  `M${pt(x - w, b)}Q${pt(x - w * 0.62, b - h * 0.3)} ${pt(x - w * 0.4, b - h * 0.55)}` +
  `Q${pt(x - w * 0.26, b - h * 0.86)} ${pt(x, b - h)}Q${pt(x + w * 0.26, b - h * 0.86)} ${pt(x + w * 0.4, b - h * 0.55)}` +
  `Q${pt(x + w * 0.62, b - h * 0.3)} ${pt(x + w, b)}Z`

/** A broadleaf crown: three overlapping discs, drawn the same way round so overlaps never cut holes. */
function canopy(x: number, b: number, h: number) {
  const disc = (cx: number, cy: number, r: number) => `M${pt(cx - r, cy)}a${n1(r)},${n1(r)} 0 1,1 ${n1(2 * r)},0a${n1(r)},${n1(r)} 0 1,1 ${n1(-2 * r)},0Z`
  const r = h * 0.34
  return disc(x, b - h + r, r) + disc(x - r * 0.7, b - r * 0.8, r * 0.8) + disc(x + r * 0.75, b - r * 0.75, r * 0.78)
}

/** A wood on a ridge: a low canopy mound with spruces and crowns rising out of it, tallest in the middle. */
function grove(line: readonly Pt[], cx: number, count: number, spread: number, hMax: number, seed: number) {
  const rand = rng(seed)
  const [x0, x1] = [cx - spread * 0.6, cx + spread * 0.6]
  const under = line.filter(([x]) => x > x0 && x < x1).reverse()
  let d = `M${pt(x0, yAt(line, x0) + 6)}Q${pt(cx, yAt(line, cx) - hMax * 0.6)} ${pt(x1, yAt(line, x1) + 6)}` + under.map(([x, y]) => `L${pt(x, y + 6)}`).join('') + 'Z'
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) / count - 0.5 + (rand() - 0.5) * 0.18
    const x = cx + u * spread
    const bell = 1 - Math.abs(u) * 1.3
    const h = hMax * (0.45 + 0.55 * bell) * (0.85 + rand() * 0.3)
    const b = yAt(line, x) + 4 - hMax * 0.18 * bell
    d += rand() < 0.45 ? canopy(x, b, h * 0.8) : spruce(x, b, h, h * (0.36 + rand() * 0.08))
  }
  return d
}

const DISTANT = ridge(
  [
    [0, 118], [150, 98], [300, 64], [430, 88], [600, 112], [800, 100], [980, 76], [1080, 54], [1180, 38], [1290, 60], [1440, 98],
    [1600, 78], [1760, 102], [1920, 90],
  ],
  [[110, 6], [38, 2.2], [14, 0.7]],
  3,
)
const FAR = ridge([[0, 142], [250, 128], [520, 146], [760, 134], [960, 148], [1180, 122], [1430, 146], [1700, 130], [1920, 142]], [[160, 4], [55, 1.6], [18, 0.5]], 5)
/** The signal ridge: a swell, an envelope (attack, decay, sustain, release), then a peak. */
const SIGNAL = ridge([
  [0, 214], [170, 172], [330, 150], [490, 160], [650, 196], [800, 216], [930, 146], [1070, 160], [1350, 164], [1470, 214], [1580, 218],
  [1720, 138], [1920, 200],
])
/** The signal ridge's length, so the travelling spark is sized in the band's own units, not as a share of the path. */
const SIGNAL_LENGTH = Math.round(SIGNAL.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - SIGNAL[i][0], y - SIGNAL[i][1]), 0))
const NEAR = ridge([[0, 252], [230, 242], [450, 256], [680, 246], [880, 260], [1100, 250], [1320, 262], [1540, 248], [1760, 258], [1920, 251]], [[140, 3], [45, 1], [16, 0.35]], 11)
/** A low knoll in front of the hamlet, hiding the cottages' footings. */
const KNOLL = ridge([[600, 304], [690, 276], [770, 268], [860, 267], [950, 276], [1030, 304]])

const WOODS = grove(NEAR, 230, 18, 260, 30, 23) + grove(NEAR, 1560, 18, 250, 32, 29) + grove(NEAR, 1860, 8, 120, 22, 37) + grove(NEAR, 1060, 5, 54, 18, 31)

/** Cottages in the valley under the swell, a little left of centre (inside a phone's crop): [x, width, wall height, sink]. */
const COTTAGES: readonly (readonly [number, number, number, number])[] = [
  [716, 18, 8, 2], [742, 24, 11, 5], [776, 16, 8, 0], [810, 26, 12, 4], [846, 18, 9, 1], [874, 14, 7, 3],
]
const HAMLET = COTTAGES.map(([x, w, h, sink], i) => {
  const b = yAt(NEAR, x) + 6 + sink
  const top = b - h
  const roof = top - h * 0.6
  const chimney = i === 3 ? `M${pt(x + w * 0.22, top - h * 0.3)}L${pt(x + w * 0.22, roof)}L${pt(x + w * 0.32, roof)}L${pt(x + w * 0.32, top - h * 0.42)}Z` : ''
  return {
    body: `M${pt(x - w / 2, b)}L${pt(x - w / 2, top)}L${pt(x - w / 2 - 2.5, top)}L${pt(x, roof)}L${pt(x + w / 2 + 2.5, top)}L${pt(x + w / 2, top)}L${pt(x + w / 2, b)}Z${chimney}`,
    window: [x + (i % 2 ? -w * 0.2 : w * 0.15), top + h * 0.34] as Pt,
  }
})

/** The broadcast mast on the far ridge's summit: a thin lattice, the one Phantom light on top. */
const MAST_FOOT: Pt = [1180, yAt(FAR, 1180) + 2]
const MAST_TOP: Pt = [1180, MAST_FOOT[1] - 38]
const MAST =
  `M${pt(MAST_FOOT[0] - 6, MAST_FOOT[1])}L${pt(...MAST_TOP)}L${pt(MAST_FOOT[0] + 6, MAST_FOOT[1])}` +
  [12, 22, 31].map((up) => { const half = 6 * (1 - up / 38); return `M${pt(MAST_FOOT[0] - half, MAST_FOOT[1] - up)}L${pt(MAST_FOOT[0] + half, MAST_FOOT[1] - up)}` }).join('')

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

/** A light: a soft glow (`<id>glow-<tone>`) and a bright core. The Phantom blooms slowly instead of flickering. */
function Light({ id, at: [x, y], r, tone, delay }: { id: string; at: Pt; r: number; tone: 'tube' | 'phantom'; delay?: number }) {
  return (
    <g className={tone === 'phantom' ? 'scene-phantom' : 'scene-lamp'} style={delay === undefined ? undefined : { animationDelay: `${delay}s` }}>
      <circle cx={x} cy={y} r={r * 4.5} fill={`url(#${id}glow-${tone})`} />
      <circle cx={x} cy={y} r={r} fill={`var(--color-${tone})`} />
    </g>
  )
}

export function Land({ className }: { className?: string }) {
  // Its own ids: two lands can share a screen (the listening room over a release), each in its own room's colours.
  const id = useId().replace(/[^\w-]/g, '')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <Grad id={`${id}distant`} top="var(--land-distant)" base="var(--land-haze)" />
        <Grad id={`${id}far`} top="var(--land-far)" base="var(--land-haze)" />
        <Grad id={`${id}signal`} top="var(--land-signal)" base="var(--land-far)" />
        <Grad id={`${id}knoll`} top="var(--land-signal)" base="var(--land-near)" />
        {/* Dusk settling into the valley: the ground's own dark rising over the far slopes, so the near ridge has no cut */}
        <linearGradient id={`${id}dusk`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--land-near)" stopOpacity="0" />
          <stop offset=".35" stopColor="var(--land-near)" stopOpacity=".5" />
          <stop offset=".62" stopColor="var(--land-near)" />
        </linearGradient>
        <Mist id={`${id}mist`} color="var(--land-haze)" />
        <Mist id={`${id}fog`} color="var(--land-signal)" />
        <radialGradient id={`${id}hamlet`}>
          <stop offset="0" stopColor="var(--color-tube)" stopOpacity=".22" />
          <stop offset="1" stopColor="var(--color-tube)" stopOpacity="0" />
        </radialGradient>
        {(['tube', 'phantom'] as const).map((tone) => (
          <radialGradient key={tone} id={`${id}glow-${tone}`}>
            <stop offset="0" stopColor={`var(--color-${tone})`} stopOpacity=".6" />
            <stop offset="1" stopColor={`var(--color-${tone})`} stopOpacity="0" />
          </radialGradient>
        ))}
        <filter id={`${id}soft`} x="-5%" y="-20%" width="110%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <filter id={`${id}rim`} x="-5%" y="-50%" width="110%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id={`${id}glow`} x="-5%" y="-50%" width="110%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Spires: softest and palest, moonlight caught along their whole crest (a soft glow, so it has no ends) */}
      <g filter={`url(#${id}soft)`}>
        <path d={fill(DISTANT)} fill={`url(#${id}distant)`} />
      </g>
      <path d={polyline(DISTANT)} fill="none" stroke="var(--land-rim)" strokeWidth="2.5" opacity=".14" filter={`url(#${id}rim)`} />
      <path d={fill(FAR)} fill={`url(#${id}far)`} />
      <path d={polyline(FAR)} fill="none" stroke="var(--land-rim)" strokeWidth="2" opacity=".08" filter={`url(#${id}rim)`} />
      <path d={MAST} fill="none" stroke="var(--land-signal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect y="128" width={W} height="70" fill={`url(#${id}mist)`} />

      <path d={fill(SIGNAL)} fill={`url(#${id}signal)`} />
      {/* The scope trace along the envelope: a soft bloom under a crisp line that draws in, then a spark of signal travels it */}
      <path d={polyline(SIGNAL)} fill="none" strokeWidth="6" className="scene-trace" opacity=".35" filter={`url(#${id}glow)`} />
      <path d={polyline(SIGNAL)} pathLength={1} fill="none" strokeWidth="1.6" strokeLinejoin="round" className="scope-trace scene-trace" vectorEffect="non-scaling-stroke" />
      <g style={{ '--len': `${SIGNAL_LENGTH}px` } as CSSProperties}>
        <path d={polyline(SIGNAL)} fill="none" strokeWidth="7" strokeLinecap="round" className="scene-pulse-tail" />
        <path d={polyline(SIGNAL)} fill="none" strokeWidth="4" strokeLinecap="round" className="scene-pulse" />
      </g>
      <rect y="196" width={W} height="60" fill={`url(#${id}fog)`} opacity=".55" />
      {/* Solid from 242 down, below the near ridge's lowest dip (~266), so no lighter fog shows between them */}
      <rect y="200" width={W} height="68" fill={`url(#${id}dusk)`} />

      {/* The hamlet's light spills over the valley behind it, backlighting the roofs */}
      <ellipse className="scene-lamps" cx="800" cy="246" rx="190" ry="44" fill={`url(#${id}hamlet)`} />
      <path d={fill(NEAR) + WOODS + HAMLET.map((c) => c.body).join('')} fill="var(--land-near)" />
      <path d={fill(KNOLL)} fill={`url(#${id}knoll)`} />

      <g className="scene-lamps">
        {HAMLET.map(({ window: [x, y] }, i) => (
          <Light key={x} id={id} at={[x + 1.5, y + 1.5]} r={1.3} tone="tube" delay={i * 0.6} />
        ))}
        <Light id={id} at={MAST_TOP} r={2.2} tone="phantom" />
      </g>
    </svg>
  )
}
