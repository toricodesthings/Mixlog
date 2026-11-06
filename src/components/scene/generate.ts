import { DEFAULT_FINGERPRINT, type Fingerprint } from '#/server/loudness'

/*
 * A song's night, as plain data (1.3.0): `sceneOf(id, fingerprint, zone)` reads two stable inputs — the fingerprint
 * (the song's first measured mix or master, `server/loudness.ts`: it seeds and shapes the whole land, from where the
 * lake, the village, the tree and the woods sit to the land's height, the lake's width and the ridge's own contour) and
 * the id (an FNV-1a hash seeding only the sky's detail: the stars, the clouds' slots, the lanterns) — and returns
 * the land and sky as strings and numbers. `Land` and `Sky` only render this; nothing here imports React, so it's
 * unit-testable and memoisable.
 *
 * The art direction is Cadence's landscape language in a painted fantasy valley at night, cosy before grand: rounded
 * peaks rising into the sky, the cliffs with a beacon and a waterfall, the song's own envelope as the ridge in front,
 * wooded banks running down to a still lake that holds the moon and the lamps, a village loosely spread down one bank,
 * farmhouses on the other, a big tree at one edge, sky lanterns rising. Depth is aerial perspective: each plane nearer
 * is darker and crisper, wisps of mist lie between them, and the moon rims only the slopes turned toward it.
 * Coordinates are a 1920-wide band, y 0–300 its own height, plus `TOP`'s headroom where the peaks rise into the sky.
 *
 * Bump `SCENE` with any change that moves a pixel; every night redraws once, on purpose.
 */

export const SCENE = 5

export type Pt = readonly [number, number]
export type MoonZone = { x: [number, number]; y: [number, number] }

const W = 1920
const H = 300
/** Headroom above the band (negative y): the land's own box is `(H - TOP) / H` of the band's height, bottom-aligned. */
export const TOP = -120
export const VIEW_BOX = `0 ${TOP} ${W} ${H - TOP}`

/** FNV-1a over a string id: stable across a rename, a new master, a meter upgrade, a move between sections. */
export function hash32(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.codePointAt(i)!
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Seeded, so a song's woods, hamlet and stars are the same on every visit. */
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
/** Ramer–Douglas–Peucker: drops every point within `tol` units of the line between its neighbours, so a gentle slope
 *  costs a few points and a summit keeps all it needs. 0.15 units is under a fifth of a pixel at any width. */
function simplify(points: readonly Pt[], tol = 0.15): readonly Pt[] {
  if (points.length < 3) return points
  const [[ax, ay], [bx, by]] = [points[0], points[points.length - 1]]
  const len = Math.hypot(bx - ax, by - ay) || 1e-6
  let [far, at] = [0, 0]
  for (let i = 1; i < points.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / len
    if (d > far) [far, at] = [d, i]
  }
  if (far <= tol) return [points[0], points[points.length - 1]]
  return [...simplify(points.slice(0, at + 1), tol).slice(0, -1), ...simplify(points.slice(at), tol)]
}
const polyline = (points: readonly Pt[]) => simplify(points).map(([x, y], i) => `${i ? 'L' : 'M'}${pt(x, y)}`).join('')
const polygon = (points: readonly Pt[]) => `${polyline(points)}Z`

/** A ridge through `keys` (x rising): a centripetal Catmull–Rom curve, sampled every `step` units (10 keeps a hill's
 *  chord within a third of a unit of the curve, under a pixel at any width). Never loops or cusps however close two
 *  keys sit. */
function curve(keys: readonly Pt[], step = 10): Pt[] {
  const [first, second, last, before] = [keys[0], keys[1], keys[keys.length - 1], keys[keys.length - 2]]
  const pad: Pt[] = [[2 * first[0] - second[0], 2 * first[1] - second[1]], ...keys, [2 * last[0] - before[0], 2 * last[1] - before[1]]]
  const out: Pt[] = [first]
  for (let i = 1; i < pad.length - 2; i++) {
    const [p0, p1, p2, p3] = [pad[i - 1], pad[i], pad[i + 1], pad[i + 2]]
    const knot = (a: Pt, b: Pt) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-6
    const [t1, t2, t3] = [knot(p0, p1), knot(p0, p1) + knot(p1, p2), knot(p0, p1) + knot(p1, p2) + knot(p2, p3)]
    const mix = (a: Pt, b: Pt, ta: number, tb: number, t: number): Pt => [((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta), ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta)]
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let k = 1; k <= steps; k++) {
      const t = t1 + ((t2 - t1) * k) / steps
      const [a1, a2, a3] = [mix(p0, p1, 0, t1, t), mix(p1, p2, t1, t2, t), mix(p2, p3, t2, t3, t)]
      out.push(mix(mix(a1, a2, 0, t2, t), mix(a2, a3, t1, t3, t), t1, t2, t))
    }
  }
  return out
}

/** Natural, rounded unevenness on a ridge: seeded value noise with a quintic fade (no slope breaks, so a crest never
 *  looks chewed), its finest octave capped so peaks stay smooth. */
function roughen(line: readonly Pt[], octaves: readonly (readonly [number, number])[], seed: number, cap: number): Pt[] {
  const rand = rng(seed)
  const capped = octaves.map(([wavelength, amplitude], i) => [wavelength, i === octaves.length - 1 ? Math.min(amplitude, cap) : amplitude] as const)
  const lattices = capped.map(([wavelength]) => Array.from({ length: Math.ceil((W + 200) / wavelength) + 2 }, () => rand() * 2 - 1))
  const quintic = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const noise = (x: number) =>
    capped.reduce((sum, [wavelength, amplitude], o) => {
      const u = x / wavelength
      const i = Math.floor(u)
      const f = quintic(u - i)
      return sum + amplitude * (lattices[o][i] * (1 - f) + lattices[o][i + 1] * f)
    }, 0)
  return line.map(([x, y]) => [x, y + noise(Math.max(0, x + 40))] as Pt)
}

/** A key that rises far above its neighbours gets two shoulders, so a summit rounds over instead of peaking sharp;
 *  a low key gets a flattened partner, so a valley reads U-shaped rather than V-shaped. */
function shoulder(keys: readonly Pt[]): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < keys.length; i++) {
    const [x, y] = keys[i]
    const neighbours = [keys[i - 1], keys[i + 1]].filter(Boolean) as Pt[]
    if (!neighbours.length) {
      out.push(keys[i])
      continue
    }
    const meanY = neighbours.reduce((s, [, ny]) => s + ny, 0) / neighbours.length
    const span = i < keys.length - 1 ? keys[i + 1][0] - x : x - keys[i - 1][0]
    if (meanY - y > (meanY === 0 ? 0 : Math.abs(meanY) * 0.6) && y < meanY - 8) {
      out.push([x - span * 0.18, y + (meanY - y) * 0.35], [x, y], [x + span * 0.18, y + (meanY - y) * 0.35])
    } else out.push([x, y])
  }
  return out
}

/** The steepest a flank may run between two keys: the curve through them then stays under 0.9 everywhere, so a hill
 *  rounds over instead of reading as a pyramid or a wall. */
const SLOPE = 0.5

/** Keys (x rising) eased until no flank between two is steeper than `SLOPE`: a too-steep pair meets halfway, the
 *  summit lowering and its saddle rising, so a peak keeps most of its height and gains a broader foot. */
function ease(keys: readonly Pt[]): Pt[] {
  const out = keys.map(([x, y]) => [x, y] as [number, number])
  for (let pass = 0; pass < 6; pass++)
    for (let i = 1; i < out.length; i++) {
      const [a, b] = [out[i - 1], out[i]]
      const over = (Math.abs(b[1] - a[1]) - SLOPE * (b[0] - a[0])) / 2
      if (over <= 0) continue
      const dir = Math.sign(b[1] - a[1])
      a[1] += dir * over
      b[1] -= dir * over
    }
  return out
}

/** A hill line: through its keys (summits rounded, valleys flattened, flanks eased), then roughened. */
const ridge = (keys: readonly Pt[], octaves: readonly (readonly [number, number])[], seed: number, cap = 6, step = 10) => roughen(curve(ease(shoulder(keys)), step), octaves, seed, cap)

/** y on a ridge at x. */
function yAt(line: readonly Pt[], x: number) {
  const i = line.findIndex(([px]) => px >= x)
  if (i <= 0) return line[i === 0 ? 0 : line.length - 1][1]
  const [[ax, ay], [bx, by]] = [line[i - 1], line[i]]
  return ay + ((by - ay) * (x - ax)) / (bx - ax || 1)
}

/** A ridge filled down past the band's bottom, so no hairline of sky shows under it. */
const fill = (line: readonly Pt[]) => `${polyline(line)}L${W + 40},${H + 2}L-40,${H + 2}Z`

/** A disc, drawn clockwise like every other shape here, so overlaps union instead of cutting holes. */
const disc = (cx: number, cy: number, r: number) => `M${pt(cx - r, cy)}a${n1(r)},${n1(r)} 0 1,1 ${n1(2 * r)},0a${n1(r)},${n1(r)} 0 1,1 ${n1(-2 * r)},0Z`

/** A soft spruce: two gentle bulges and a rounded tip. */
const spruce = (x: number, b: number, h: number, w: number) =>
  `M${pt(x - w, b)}Q${pt(x - w * 0.62, b - h * 0.3)} ${pt(x - w * 0.4, b - h * 0.55)}` +
  `Q${pt(x - w * 0.26, b - h * 0.86)} ${pt(x, b - h)}Q${pt(x + w * 0.26, b - h * 0.86)} ${pt(x + w * 0.4, b - h * 0.55)}` +
  `Q${pt(x + w * 0.62, b - h * 0.3)} ${pt(x + w, b)}Z`

/** A broadleaf crown: three overlapping discs. */
function canopy(x: number, b: number, h: number) {
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

/** A cumulus in its own box (0,0)–(w,h): puffs tallest in the middle on a flat base, the way a painted cloud sits. */
function cumulus(w: number, h: number, rand: () => number) {
  const k = 4 + Math.floor(rand() * 3)
  let d = `M${pt(w * 0.12, h * 0.72)}H${n1(w * 0.88)}V${n1(h)}H${n1(w * 0.12)}Z`
  for (let i = 0; i < k; i++) {
    const u = (i + 0.5) / k
    const r = Math.min(h * (0.24 + 0.3 * Math.sin(u * Math.PI)) * (0.85 + rand() * 0.3), h * 0.5)
    const cx = Math.min(w - r, Math.max(r, u * w + (rand() - 0.5) * w * 0.06))
    d += disc(cx, h - r * 0.98, r)
  }
  return d
}

/** The slopes turned toward the moon, as one stroke: where the light catches a ridge (Cadence's rim). */
function litEdges(points: readonly Pt[], side: -1 | 1) {
  const runs: Pt[][] = []
  let open = false
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]]
    if (side === -1 ? b[1] < a[1] - 0.4 : b[1] > a[1] + 0.4) {
      if (open) runs[runs.length - 1].push(b)
      else runs.push([a, b])
      open = true
    } else open = false
  }
  return runs.map(polyline).join('')
}

/** A wisp of mist lying along a valley, x0→x1: a soft, uneven top over a flatter base, thickest in the middle, so it
 *  reads as a painted ribbon rather than a blurred box. */
function ribbon(x0: number, x1: number, y: number, thick: number, rand: () => number) {
  const n = Math.max(4, Math.round((x1 - x0) / 90))
  const top = Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y - thick * Math.sin((Math.PI * i) / n) * (0.55 + rand() * 0.5)] as Pt)
  const base = Array.from({ length: n + 1 }, (_, i) => [x1 - ((x1 - x0) * i) / n, y + thick * 0.3 * Math.sin((Math.PI * (n - i)) / n) * (0.6 + rand() * 0.6)] as Pt)
  // Sampled coarsely: it lies under a 4-unit blur, where finer steps only add markup
  return polygon([...curve(top, 24), ...curve(base, 24)])
}

export type House = { x: number; base: number; ground: number; window: Pt; far?: boolean }
/** A cloud in the sky, in % of the scene (left, top, width), its shape in its own `w × h` box. */
export type Cloud = { left: number; top: number; width: number; w: number; h: number; d: string; drift: number }
export type Lantern = { x: number; delay: number; duration: number }
export type Star = readonly [left: number, top: number, size: number, warm: boolean, sparkle: boolean, twinkle: boolean]
export type Moon = { x: number; y: number; side: -1 | 1; phase: 'full' | 'gibbous' | 'crescent' }
export type Fall = { x: number; top: number; bottom: number; width: number }

export type SceneModel = {
  land: {
    back: string
    backRim: string
    distant: string
    distantRim: string
    far: string
    farRim: string
    fall: Fall | null
    signalFill: string
    signal: string
    banks: string
    banksRim: string
    mast: string
    beacon: Pt
    /** The lake: its water line, its x span between the near banks, and the moon's spot on it. */
    lake: { y: number; x0: number; x1: number; moonX: number; ripples: string }
    mists: { back: string[]; front: string[] }
    houses: string
    roofs: string
    hamlet: House[]
    shore: Pt[]
    near: string
    nearRim: string
    woods: string
    tree: string
    treeRim: string
    lanterns: Lantern[]
    glowX: number
    /** The night's brightness from the song (0.7–1.3): scales the moonlight on rims, water and mist. */
    light: number
  }
  sky: { moon: Moon; stars: Star[]; band: (readonly [left: number, top: number, size: number])[]; clouds: Cloud[]; shooting: { left: number; top: number; angle: number; delay: number; every: number }; light: number }
}

/** The moon's zone (§5), as fractions of the scene: where it may sit on each screen, clear of what floats over it. */
export const ZONES = {
  summaryDesktop: { x: [0.08, 0.2], y: [0.12, 0.24] } as MoonZone,
  summaryCompact: { x: [0.12, 0.26], y: [0.38, 0.46] } as MoonZone,
  roomDesktop: { x: [0.07, 0.2], y: [0.12, 0.26] } as MoonZone,
  roomCompact: { x: [0.1, 0.22], y: [0.09, 0.15] } as MoonZone,
}

const cache = new Map<string, SceneModel>()

/** The song's night: generated once per `id + fingerprint + zone + SCENE`, then memoised (a handful of keys, so a
 *  parent re-render or a playhead tick never recomputes it). */
export function sceneOf(id: string, fp: Fingerprint | null, zone: MoonZone): SceneModel {
  // A track's fingerprint is stamped once and never rewritten, so keying on its small JSON is cheap and exact.
  const key = `${id}:${fp ? JSON.stringify(fp) : 'd'}:${zone.x.join(',')}:${zone.y.join(',')}:${SCENE}`
  const hit = cache.get(key)
  if (hit) return hit
  const model = buildScene(id, fp, zone)
  cache.set(key, model)
  if (cache.size > 8) cache.delete(cache.keys().next().value!)
  return model
}

/** Where the water lies: below every point of the song's ridge, so the lake never covers any of its line. */
const WATER = 232

function buildScene(id: string, fp: Fingerprint | null, zone: MoonZone): SceneModel {
  // The song is the seed. The whole land (peaks, cliffs, ridge, banks, lake, village, tree, mist) draws from a
  // generator seeded by the fingerprint alone, and on top of that the fingerprint places and sizes it directly: the
  // moon, the tallest summit, the beacon and the village are where the song puts them, and its loudness, dynamics,
  // width, weather and length set the light, the relief, the roughness, the lake and the mist. The id seeds only the
  // sky's own detail (the star field, which slots the clouds take, the sky lanterns), so two songs that measure
  // exactly alike still get their own sky.
  const song = fp ?? DEFAULT_FINGERPRINT
  const { loud, dyn, width, weather, peak, length, env } = song
  const seed = hash32(`${song.env.join(',')}|${loud}|${dyn}|${width}|${weather}|${peak}|${length}`)
  const rand = rng(seed)
  const own = rng(hash32(id))
  const relief = 0.75 + 0.5 * loud
  const rough = 0.6 + 0.8 * dyn
  // The night's light: a loud song under a clear sky is a bright night; a quiet one under weather a dim, hazy one
  const light = 0.7 + 0.4 * loud + 0.2 * (1 - weather)

  // Moon first: its side is where the song's energy sits (the envelope's centre of mass), so every rim, roof and
  // glint agrees with it; it sits higher the more dynamic the song, further out the louder, fuller the more it moves.
  const centroid = env.reduce((s, v, i) => s + v * i, 0) / (env.reduce((s, v) => s + v, 0) || 1) / (env.length - 1)
  const side: -1 | 1 = centroid < 0.5 ? -1 : 1
  const [xr, yr] = side === 1 ? [[1 - zone.x[1], 1 - zone.x[0]], zone.y] : [zone.x, zone.y]
  const along = side === 1 ? loud : 1 - loud
  const moon: Moon = {
    x: (xr[0] + along * (xr[1] - xr[0])) * W,
    y: (yr[0] + (1 - dyn) * (yr[1] - yr[0])) * H,
    side,
    phase: dyn > 0.55 ? 'full' : dyn > 0.3 ? 'gibbous' : 'crescent',
  }

  // Peaks: rounded summits rising into the headroom, taller the louder the song, in the song's profile (a V that
  // frames the valley, a slope climbing toward one side, or between); a dynamic song gives each a shoulder, a compressed one
  // broad single domes. Keys stay well apart, so the curve rounds every top.
  // Each summit leans (its saddles off-centre) and most carry a shoulder on one flank, so no two read alike.
  // The range's profile is the song's own: anywhere from a V framing the valley to a slope climbing toward one side
  const [vee, climb] = [rand(), rand() < 0.5 ? -1 : 1]
  const profile = (u: number) => vee * Math.abs(u - 0.5) * 2 + (1 - vee) * (climb === 1 ? u : 1 - u)
  const range = (count: number, lift: number, scale: number, offset: number) => {
    const keys: Pt[] = [[-40, 78 + rand() * 16]]
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5 + offset) / count
      // Clear of the last key by enough that a left shoulder still falls after the saddle: keys always run left to right
      const x = Math.max(keys[keys.length - 1][0] + 220, (u + (rand() - 0.5) * 0.1) * W)
      // The song's profile, plus a crown over its loudest moment
      const crown = 40 * Math.exp(-(((u - peak) / 0.16) ** 2))
      const rise = (lift + 62 * profile(u) + crown + (rand() - 0.5) * 26 * rough) * relief * scale
      if (i > 0) keys.push([keys[keys.length - 1][0] + (x - keys[keys.length - 1][0]) * (0.38 + rand() * 0.24), 62 + rand() * 24])
      const shoulder = rand() < 0.35 + dyn * 0.5 ? (rand() < 0.5 ? -1 : 1) : 0
      if (shoulder === -1) keys.push([x - 95, 40 - rise * (0.45 + rand() * 0.2)])
      keys.push([x, 40 - rise])
      if (shoulder === 1) keys.push([x + 95, 40 - rise * (0.45 + rand() * 0.2)])
    }
    keys.push([W + 40, 78 + rand() * 16])
    return ease(keys.filter(([x], i) => i === 0 || x > keys[i - 1][0] + 20)).map(([x, y]) => [x, Math.max(y, TOP + 16)] as Pt)
  }
  // A paler range behind, its summits between the front ones', so the mountains overlap in depth like a painting's
  // A longer song spreads into more summits; a dynamic one's slopes are rougher
  const peakCount = 4 + Math.round(length * 1.6)
  const BACK = roughen(curve(range(peakCount + 1, 58, 1.08, -0.5)), [[120, 2 * rough]], seed ^ 0x52, 2 * rough)
  const DISTANT = roughen(curve(range(peakCount, 46, 1, 0)), [[110, 2.5 * rough], [36, 0.6 * rough]], seed ^ 0x51, 0.6 * rough)

  // The cliffs: the far range, wooded in a few runs along its crest; key spacing grows with length, its swell with
  // dynamics. The beacon stands on it inside the phone-safe core; most nights a waterfall leaves a raised stretch on
  // the side away from it.
  const beaconX = 760 + 400 * Math.max(0, Math.min(1, peak + (rand() - 0.5) * 0.6))
  const beaconSide: -1 | 1 = beaconX < 960 ? -1 : 1
  const fallX = 960 - beaconSide * (130 + rand() * 110)
  const hasFall = rand() < 0.75
  const farKeyCount = 7 + Math.round(length * 4)
  const farKeys: Pt[] = Array.from({ length: farKeyCount }, (_, i) => [(i / (farKeyCount - 1)) * W, 128 + Math.sin(i * 1.7 + rand() * 2) * 12 * (0.6 + 0.8 * dyn)] as Pt)
    .filter(([x]) => !hasFall || Math.abs(x - fallX) > 140)
  if (hasFall) farKeys.push([fallX - 110, 110], [fallX, 100 + rand() * 6], [fallX + 110, 112])
  farKeys.sort((a, b) => a[0] - b[0])
  const FAR = ridge(farKeys, [[160, 2.5], [55, 0.8]], seed ^ 0x9e, 0.8)
  const beaconFoot: Pt = [beaconX, yAt(FAR, beaconX) + 2]
  const beaconHeight = 38 * (0.85 + rand() * 0.3)
  const beaconTop: Pt = [beaconFoot[0], beaconFoot[1] - beaconHeight]
  const mast =
    `M${pt(beaconFoot[0] - 6, beaconFoot[1])}L${pt(...beaconTop)}L${pt(beaconFoot[0] + 6, beaconFoot[1])}` +
    [0.3, 0.55, 0.8].map((f) => { const up = beaconHeight * f; const half = 6 * (1 - f); return `M${pt(beaconFoot[0] - half, beaconFoot[1] - up)}L${pt(beaconFoot[0] + half, beaconFoot[1] - up)}` }).join('')
  let far = fill(FAR)
  // One to three woods along the crest, each its own size, wherever the song puts them
  for (let k = 0, n = 1 + Math.floor(rand() * 3); k < n; k++) {
    const cx = ((k + 0.2 + rand() * 0.6) / n) * W
    const spread = 140 + rand() * 140
    if (Math.abs(cx - beaconX) > 120 && (!hasFall || Math.abs(cx - fallX) > 160)) far += grove(FAR, cx, Math.round(spread / 17), spread, 9 + rand() * 5, seed ^ Math.round(cx))
  }

  // The signal ridge: the song's own loudness, 24 points → 13 keys, its range stretched over y 142–210, but never
  // more than 2.5×, so a song that barely moves draws a gentle ridge rather than amplified noise. A slow seeded roll
  // keeps it land. It never dips below the water line.
  const sampled = [env[0], ...Array.from({ length: 11 }, (_, i) => env[(i + 1) * 2]), env[23]]
  const [lo, hi] = [Math.min(...sampled), Math.max(...sampled)]
  const span = Math.max(hi - lo, 0.4)
  const signalKeys: Pt[] = sampled.map((v, i) => [(i / (sampled.length - 1)) * W, 210 - ((v - lo) / span) * 68])
  const SIGNAL = ridge(signalKeys, [[300, 10], [110, 2]], seed ^ 0x33, 2, 6).map(([x, y]) => [x, Math.min(y, WATER - 8)] as Pt)
  const fall: Fall | null = hasFall ? { x: fallX, top: yAt(FAR, fallX) + 3, bottom: yAt(SIGNAL, fallX), width: 6 + width * 8 } : null

  // The village takes a bank of its own, and the valley (the lake and everything framing it) slides away from it,
  // giving the village room and keeping its heart inside a phone's crop. The lake is wider the wider the mix.
  const hamletSide: -1 | 1 = rand() < 0.5 ? -1 : 1
  const vx = 960 - hamletSide * rand() * 180
  const half = 120 + 170 * width
  const [lx0, lx1] = [vx - half, vx + half]
  /** The outermost key of a bank always reaches past the band's edge, wherever the valley sits. */
  const edge = (dir: -1 | 1) => (dir === -1 ? -60 : W + 60)

  // Mid banks: wooded hills in front of the ridge, following it from below (never hiding its line) and running down
  // to the water either side of the lake.
  const bank = (dir: -1 | 1) => {
    const shore = vx + dir * (half - 40)
    // The crest echoes the light's path a step below it (deep enough that the woods' tips stay under the trace), then
    // runs down to the water
    const echo: Pt[] = []
    for (let x = edge(dir); dir * (x - shore - dir * 200) > 0; x -= dir * 70) echo.push([x, Math.min(yAt(SIGNAL, x) + 24 + (rand() - 0.5) * 3, WATER - 8)])
    const keys: Pt[] = [...echo, [shore + dir * 60, Math.max(WATER - 8, echo[echo.length - 1][1])], [shore - dir * 40, WATER + 14]]
    const line = ridge(dir === -1 ? keys : [...keys].reverse(), [[120, 1.5]], seed ^ (0x4b + dir), 1.5)
    const [x0, x1] = [line[0][0], line[line.length - 1][0]]
    return { line, d: `${polyline(line)}L${pt(x1, H + 2)}L${pt(x0, H + 2)}Z` }
  }
  const banksWE = [bank(-1), bank(1)]
  const banks = banksWE.map((b) => b.d).join('') + banksWE.flatMap(({ line }, i) => [0.18 + rand() * 0.22, 0.56 + rand() * 0.24].map((f) => {
    const x = line[0][0] + (line[line.length - 1][0] - line[0][0]) * (i === 0 ? f : 1 - f)
    return grove(line, x, 8 + Math.floor(rand() * 4), 130 + rand() * 40, 15 + rand() * 4, seed ^ Math.round(x * 3))
  })).join('')

  // The near banks frame the lake in a matched V, the same rise either side.
  const nearBank = (dir: -1 | 1) => {
    const keys: Pt[] = [[edge(dir), 222], [vx + dir * (680 + rand() * 160), 214], [vx + dir * (half + 230 + rand() * 60), 220], [vx + dir * (half + 120), 238], [vx + dir * (half + 30), 262], [vx + dir * (half - 20), H + 4]]
      .map(([x, y], i) => [x, y + (rand() - 0.5) * (i < 2 ? 14 : 3)] as Pt)
    return ridge(dir === -1 ? keys : [...keys].reverse(), [[140, 1.5]], seed ^ (0x77 + dir), 1.5)
  }
  const [NEAR_W, NEAR_E] = [nearBank(-1), nearBank(1)]
  const nearFill = (line: readonly Pt[]) => `${polyline(line)}L${pt(line[line.length - 1][0], H + 2)}L${pt(line[0][0], H + 2)}Z`

  // Houses: a village on the hamlet's bank, loosely spread down its slope toward the water; a farmhouse or two on the
  // other bank; one far cottage on a mid bank. Each stands on its ground, its base just under the slope's lower edge.
  const villageLine = hamletSide === -1 ? NEAR_W : NEAR_E
  const otherLine = hamletSide === -1 ? NEAR_E : NEAR_W
  const spots: [readonly Pt[], number, boolean][] = []
  // The village's own shape: tight or loose, its gap (a lane, a green) after any house
  let u = half + 60 + rand() * 40
  const [pitch, gapAt] = [30 + rand() * 30, 1 + Math.floor(rand() * 4)]
  for (let k = 0, n = 3 + Math.round(loud * 2 + rand() * 2); k < n; k++) {
    spots.push([villageLine, vx + hamletSide * u, false])
    u += pitch + rand() * 40 + (k === gapAt ? 50 + rand() * 40 : 0)
  }
  const villageEnd = u
  // One to three farmhouses scattered on the other bank, a cottage or two up on the mid banks
  for (let k = 0, n = 1 + Math.floor(rand() * 3), at = half + 110; k < n; k++) {
    at += rand() * 140
    spots.push([otherLine, vx - hamletSide * at, false])
    at += 120 + rand() * 120
  }
  // Each cottage keeps clear of every house below it, so none reads as perched on another's roof
  for (let k = 0, n = rand() < 0.4 ? 2 : 1; k < n; k++) {
    const dir = k ? hamletSide : -hamletSide
    let x = vx + dir * (half + 100 + rand() * 160)
    for (let guard = 0; guard < 8 && spots.some(([, sx]) => Math.abs(sx - x) < 50); guard++) x += dir * 50
    spots.push([banksWE[dir === -1 ? 0 : 1].line, x, true])
  }
  // The beacon keeper's hut at its foot, on the side toward the middle: always inside the phone-safe core, so a phone
  // sees a lit window too
  spots.push([FAR, beaconX - beaconSide * 30, true])
  let houses = ''
  let roofs = ''
  const hamlet: House[] = spots.map(([line, x, isFar], i) => {
    const scale = isFar ? 0.6 : 1
    const w = (18 + rand() * 10) * scale
    const h = (10 + rand() * 5) * scale
    const ground = Math.max(yAt(line, x - w / 2), yAt(line, x + w / 2))
    const base = ground + 1.5
    const top = Math.min(yAt(line, x - w / 2), yAt(line, x + w / 2)) - h
    const roof = top - h * 0.65
    const chimney = i % 3 === 1 && !isFar ? `M${pt(x - side * w * 0.25, top - h * 0.25)}L${pt(x - side * w * 0.25, roof + 1)}L${pt(x - side * w * 0.12, roof + 1)}L${pt(x - side * w * 0.12, top - h * 0.4)}Z` : ''
    houses += `M${pt(x - w / 2, base)}L${pt(x - w / 2, top)}L${pt(x - w / 2 - 3 * scale, top)}L${pt(x, roof)}L${pt(x + w / 2 + 3 * scale, top)}L${pt(x + w / 2, top)}L${pt(x + w / 2, base)}Z${chimney}`
    roofs += `M${pt(x, roof)}L${pt(x + side * (w / 2 + 3 * scale), top)}`
    return { x, base, ground, window: [x + (i % 2 ? -w * 0.2 : w * 0.15), top + h * 0.4] as Pt, far: isFar }
  })

  // Lanterns on posts at the water's edge either side, their light laid on the lake.
  // Each end has its lamp most nights, never neither; a long lake sometimes a jetty lamp between.
  const ends = rand()
  const shore: Pt[] = [...(ends < 0.8 ? [[lx0 + 30, WATER - 6] as Pt] : []), ...(ends > 0.2 ? [[lx1 - 30, WATER - 6] as Pt] : [])]
  if (half > 200 && rand() < 0.5) shore.push([vx + (rand() - 0.5) * half, WATER - 3])

  // Woods on both near banks, matched, kept off the village; the framing tree across from it.
  // Woods beyond the village's last house on its bank, and wherever the song puts them on the other.
  const woodsAt = (dir: -1 | 1) => vx + dir * (dir === hamletSide ? villageEnd + 100 + rand() * 80 : half + 220 + rand() * 200)
  const woods = [
    grove(NEAR_W, woodsAt(-1), 10 + Math.floor(rand() * 7), 170 + rand() * 100, 24 + rand() * 8, seed ^ 0x2f),
    grove(NEAR_E, woodsAt(1), 10 + Math.floor(rand() * 7), 170 + rand() * 100, 24 + rand() * 8, seed ^ 0x5e),
  ].join('')
  // The tree across from the village, kept on the band; its own size and spread
  const tx = Math.max(160, Math.min(W - 160, vx - hamletSide * (620 + rand() * 160)))
  const lean = hamletSide
  const crownX = tx + lean * (20 + rand() * 30)
  const crownY = 96 + rand() * 30
  const [crownW, crownH] = [56 + rand() * 30, 26 + rand() * 12]
  const trunk =
    `M${pt(tx - 9, H + 4)}Q${pt(tx - 4, 220)} ${pt(crownX - 3, crownY + 30)}L${pt(crownX + 3, crownY + 30)}Q${pt(tx + 6, 220)} ${pt(tx + 9, H + 4)}Z` +
    `M${pt(tx + lean * 6, 200)}Q${pt(tx + lean * 40, 180)} ${pt(tx + lean * 70, 168)}L${pt(tx + lean * 70, 172)}Q${pt(tx + lean * 40, 186)} ${pt(tx + lean * 5, 208)}Z`
  const clump = (cx: number, cy: number, rx: number, ry: number, n: number, r: number) =>
    Array.from({ length: n }, () => {
      const a = rand() * Math.PI * 2
      const d = Math.sqrt(rand())
      return [cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d * (Math.sin(a) > 0 ? 0.6 : 1), r * (1.15 - d * 0.6) * (0.8 + rand() * 0.4)] as [number, number, number]
    })
  const masses = [...clump(crownX, crownY, crownW, crownH, Math.round(crownW * 0.37), 24 + rand() * 10), ...clump(tx + lean * 80, 162, 30, 12, 9, 16)]
  const tree = trunk + masses.map(([x, y, r]) => disc(x, y, r)).join('')
  const treeRim = masses.map(([x, y, r]) => disc(x + side * 2.5, y - 2, r)).join('')

  // Mist: wisps at the cliffs' foot and over the mid banks' tree line (behind the lake), and a thin one lying on the
  // water (in front of it).
  const mists = {
    back: [
      ribbon(-40, 820 + rand() * 120, 150 + rand() * 8, 10 + 14 * weather, rand),
      ribbon(1100 - rand() * 120, W + 40, 152 + rand() * 8, 10 + 14 * weather, rand),
      ribbon(40 + rand() * 160, vx - 60 - rand() * 80, WATER - 16, 8 + 10 * weather, rand),
      ribbon(vx + 60 + rand() * 80, W - 40 - rand() * 160, WATER - 14, 8 + 10 * weather, rand),
    ],
    front: [ribbon(lx0 - 60, lx1 + 60, WATER + 10, 5 + 8 * weather, rand)],
  }
  const ripples = Array.from({ length: 7 }, (_, k) => {
    const y = WATER + 8 + k * 9
    const len = 60 + rand() * 120
    const x = lx0 + 40 + rand() * Math.max(0, lx1 - lx0 - 80 - len)
    return `M${pt(x, y)}H${n1(x + len)}`
  }).join('')

  // Sky lanterns: 4–6, warm, rising slowly from the valley at seeded delays.
  // The first always rises inside the phone-safe core (x 760–1160), so a phone sees one too.
  const lanterns: Lantern[] = Array.from({ length: 3 + Math.round(loud * 4) }, (_, i) => ({ x: i ? 420 + own() * 1080 : 800 + own() * 320, delay: own() * 70, duration: 46 + own() * 30 }))

  // Clouds: high in the sky, each in its own slot across it (so two never meet), alternating sides, none over the
  // moon; more of them with weather.
  const moonLeft = (moon.x / W) * 100
  const slots = [6, 26, 66, 86].filter((s) => Math.abs(s + 4 - moonLeft) > 14)
  const want = Math.min(slots.length, 2 + Math.round(weather))
  const order = [...slots].sort(() => own() - 0.5).slice(0, want).sort((a, b) => a - b)
  const clouds: Cloud[] = order.map((slot) => {
    const w = 160 + rand() * 120
    const h = w * (0.42 + rand() * 0.1)
    const width = 9 + rand() * 3
    return { left: slot + rand() * (14 - width), top: 8 + rand() * 14, width, w, h, d: cumulus(w, h, rand), drift: 6 + rand() * 8 }
  })

  // Stars: tier counts scale with dynamics.
  const starRand = rng(hash32(id) ^ 0x55)
  const stars: Star[] = []
  for (const [n, size] of [[Math.round(13 * (0.8 + 0.4 * dyn)), 2.2], [Math.round(34 * (0.8 + 0.4 * dyn)), 1.4], [Math.round(54 * (0.8 + 0.4 * dyn)), 0.9]] as const) {
    for (let placed = 0, guard = 0; placed < n && guard < 4000; guard++) {
      const left = 2 + starRand() * 96
      const top = 3 + 62 * starRand() * (0.35 + 0.65 * starRand())
      if (Math.hypot((left - moonLeft) * 1.6, top - (moon.y / H) * 100) < 14) continue
      if (stars.some(([l, t]) => Math.abs(l - left) < 3 && Math.abs(t - top) < 3.4)) continue
      stars.push([n1(left), n1(top), size, starRand() < 0.3, size > 2 && placed < 3, size < 1 && placed % 6 === 0])
      placed++
    }
  }
  // A faint band of stars across the upper sky at a seeded angle (−25°…25°), thickest along its spine and thinning to
  // nothing either side; clear of the moon.
  const tilt = Math.tan(((starRand() - 0.5) * 50 * Math.PI) / 180) * 0.4
  const [bandX, bandY] = [30 + starRand() * 40, 18 + starRand() * 14]
  const band: (readonly [left: number, top: number, size: number])[] = []
  for (let k = 0; k < 70; k++) {
    const left = 1 + starRand() * 98
    const top = bandY + (left - bandX) * tilt + (starRand() + starRand() + starRand() - 1.5) * 9
    if (top < 2 || top > 60 || Math.hypot((left - moonLeft) * 1.6, top - (moon.y / H) * 100) < 16) continue
    band.push([n1(left), n1(top), n1(0.5 + starRand() * 0.4)])
  }
  // A shooting star now and then, falling away from the moon.
  const shooting = { left: 25 + starRand() * 50, top: 4 + starRand() * 20, angle: side === -1 ? 24 + starRand() * 14 : 142 + starRand() * 14, delay: 3 + starRand() * 12, every: 18 + starRand() * 14 }

  return {
    land: {
      back: fill(BACK),
      backRim: litEdges(BACK, side),
      distant: fill(DISTANT),
      distantRim: litEdges(DISTANT, side),
      far,
      farRim: litEdges(FAR, side),
      fall,
      signalFill: fill(SIGNAL),
      signal: polyline(SIGNAL),
      banks,
      banksRim: banksWE.map(({ line }) => litEdges(line, side)).join(''),
      mast,
      beacon: beaconTop,
      lake: { y: WATER, x0: lx0, x1: lx1, moonX: Math.max(lx0 + 50, Math.min(lx1 - 50, moon.x)), ripples },
      mists,
      houses,
      roofs,
      hamlet,
      shore,
      near: nearFill(NEAR_W) + nearFill(NEAR_E),
      nearRim: litEdges(NEAR_W, side) + litEdges(NEAR_E, side),
      woods,
      tree,
      treeRim,
      lanterns,
      glowX: hamlet.slice(0, 3).reduce((s, h) => s + h.x, 0) / 3,
      light,
    },
    sky: { moon, stars, band, clouds, shooting, light },
  }
}
