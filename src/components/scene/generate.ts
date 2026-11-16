import { DEFAULT_FINGERPRINT, fingerprint, type Fingerprint } from '#/server/loudness'

/*
 * A song's night, as plain data: `sceneOf(id, fingerprint, zone, frame)` reads two stable inputs and returns the land
 * and sky as strings and numbers. `Land` and `Sky` only render this; nothing here imports React, so it's unit-testable
 * and memoisable.
 *
 * The song decides the big shapes, the seed only the small ones (1.7.2). The fingerprint alone (the song's first
 * measured mix or master, `server/loudness.ts`) picks the archetype (valley, coast, highlands), where the summits and
 * saddles stand, the lake's width and the moon; the fingerprint and the id together seed the small things (noise,
 * groves, shoulders, houses), so two songs that measure alike still differ. The envelope is read at three zoom levels:
 * the back range is its form, the distant range its sections, the cliffs its changes, the signal ridge the signal.
 *
 * Blue hour, not midnight: few lights, each something (a hearth, a lone farm, a tube lamp on the shore, the beacon),
 * a knoll to stand on with an amp glowing on it, and a sky in three depths. Coordinates are a `frame`-wide band
 * (1920 wide, 1280 laptop and tablet, 840 phone: the envelope spans the frame at every size), y 0–300 its own height,
 * plus `TOP`'s headroom where the peaks rise into the sky.
 *
 * Bump `SCENE` with any change that moves a pixel; every night redraws once, on purpose.
 */

export const SCENE = 6

export type Pt = readonly [number, number]
export type MoonZone = { x: [number, number]; y: [number, number] }
export type Frame = 1920 | 1280 | 840

/** The band's width for this build: set once at the top of `buildScene`, read by every helper below (synchronous). */
let W: number = 1920
const H = 300
/** Headroom above the band (negative y): the land's own box is `(H - TOP) / H` of the band's height, bottom-aligned. */
export const TOP = -120
export const viewBoxOf = (frame: number) => `0 ${TOP} ${frame} ${H - TOP}`
/** How far below the band every fill reaches, so a layer nudged by the pointer never shows an edge. */
const FLOOR = H + 24

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
/** Ramer–Douglas–Peucker: drops every point within `tol` units of the line between its neighbours. */
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
function polyline(points: readonly Pt[]) {
  // A bad number would otherwise vanish in `simplify` (a NaN distance is never "far") and draw a slab
  if (import.meta.env?.DEV && points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) throw new Error('scene: a non-finite point')
  return simplify(points).map(([x, y], i) => `${i ? 'L' : 'M'}${pt(x, y)}`).join('')
}
const polygon = (points: readonly Pt[]) => `${polyline(points)}Z`

/** A ridge through `keys` (x rising): a centripetal Catmull–Rom curve, sampled every `step` units. */
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

/** Natural, rounded unevenness on a ridge: seeded value noise with a quintic fade, its finest octave capped. */
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

/** A key far above its neighbours gets two shoulders, so a summit rounds over; a low key reads U-shaped. */
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

/** The steepest a flank may run between two keys. */
const SLOPE = 0.5

/** Keys (x rising) eased until no flank between two is steeper than `SLOPE`. */
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

/** Keys kept strictly left to right, at least `gap` apart. */
function rising(keys: readonly Pt[], gap = 20) {
  const out: Pt[] = []
  for (const key of keys) if (!out.length || key[0] > out[out.length - 1][0] + gap) out.push(key)
  return out
}

/** A hill line: through its keys (summits rounded, valleys flattened, flanks eased), then roughened. */
const ridge = (keys: readonly Pt[], octaves: readonly (readonly [number, number])[], seed: number, cap = 6, step = 10) => roughen(curve(ease(shoulder(rising(keys, 0))), step), octaves, seed, cap)

/** y on a ridge at x. */
function yAt(line: readonly Pt[], x: number) {
  const i = line.findIndex(([px]) => px >= x)
  if (i <= 0) return line[i === 0 ? 0 : line.length - 1][1]
  const [[ax, ay], [bx, by]] = [line[i - 1], line[i]]
  return ay + ((by - ay) * (x - ax)) / (bx - ax || 1)
}

/** A ridge filled down past the band's bottom. */
const fill = (line: readonly Pt[]) => `${polyline(line)}L${W + 40},${FLOOR}L-40,${FLOOR}Z`

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

/** A cumulus in its own box (0,0)–(w,h): puffs tallest in the middle on a flat base. */
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

/** The slopes turned toward the moon, as one stroke, `dy` units down the slope (0 for the rim, more for its strata). */
function litEdges(points: readonly Pt[], side: -1 | 1, dy = 0) {
  const runs: Pt[][] = []
  let open = false
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]]
    if (side === -1 ? b[1] < a[1] - 0.4 : b[1] > a[1] + 0.4) {
      const [a2, b2]: Pt[] = [[a[0], a[1] + dy], [b[0], b[1] + dy]]
      if (open) runs[runs.length - 1].push(b2)
      else runs.push([a2, b2])
      open = true
    } else open = false
  }
  return runs.map(polyline).join('')
}

/** A wisp of mist lying along a valley, x0→x1: a soft, uneven top over a flatter base, thickest in the middle. */
function ribbon(x0: number, x1: number, y: number, thick: number, rand: () => number) {
  const n = Math.max(4, Math.round((x1 - x0) / 90))
  const top = Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y - thick * Math.sin((Math.PI * i) / n) * (0.55 + rand() * 0.5)] as Pt)
  const base = Array.from({ length: n + 1 }, (_, i) => [x1 - ((x1 - x0) * i) / n, y + thick * 0.3 * Math.sin((Math.PI * (n - i)) / n) * (0.6 + rand() * 0.6)] as Pt)
  return polygon([...curve(top, 24), ...curve(base, 24)])
}

/** The envelope, linearly resampled to `n` points. */
function resample(env: readonly number[], n: number) {
  return Array.from({ length: n }, (_, i) => {
    const u = (i / (n - 1)) * (env.length - 1)
    const k = Math.min(env.length - 2, Math.floor(u))
    return env[k] + (env[k + 1] - env[k]) * (u - k)
  })
}
/** A Gaussian blur, edges held. */
function blur(a: readonly number[], sigma: number) {
  const r = Math.ceil(sigma * 3)
  const kernel = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)))
  const sum = kernel.reduce((s, v) => s + v, 0)
  return a.map((_, i) => kernel.reduce((s, k, j) => s + k * a[Math.max(0, Math.min(a.length - 1, i + j - r))], 0) / sum)
}
/** Rounds a summit under the ceiling instead of flattening it there: identity above `floor + k`, easing to `floor`. */
const softFloor = (y: number, floor: number, k = 30) => (y >= floor + k ? y : floor + k * Math.exp((y - floor - k) / k))

export type Archetype = 'valley' | 'coast' | 'highlands'
export type Landmark = 'mast' | 'lighthouse' | 'dome' | 'windmill' | 'bridge'
/** A light at a depth: far ones small and dim, near ones larger with a wider glow. */
export type Depth = 'far' | 'mid' | 'near'
export type Window = { x: number; y: number; depth: Depth }
export type House = { x: number; base: number; ground: number; window: Pt; far?: boolean }
/** A cloud in the sky, in % of the scene (left, top, width), its shape in its own `w × h` box. */
export type Cloud = { left: number; top: number; width: number; w: number; h: number; d: string; drift: number; near: boolean }
export type Cirrus = { left: number; top: number; width: number; height: number; angle: number; opacity: number }
export type Lantern = { x: number; delay: number; duration: number }
export type Firefly = { x: number; y: number; delay: number }
export type Star = readonly [left: number, top: number, size: number, warm: boolean, sparkle: boolean, twinkle: boolean]
export type Moon = { x: number; y: number; side: -1 | 1; phase: 'full' | 'gibbous' | 'crescent'; ring: boolean }
export type Fall = { x: number; top: number; bottom: number; width: number }
export type Meteor = { left: number; top: number; angle: number; length: number; depth: Depth; every: number; delay: number; duration: number }

export type SceneModel = {
  frame: number
  archetype: Archetype
  land: {
    back: string
    backRim: string
    backStrata: [string, string]
    snow: string
    distant: string
    distantRim: string
    distantStrata: [string, string]
    /** The low cloud bank lying between the back range and the distant one, in land units. */
    lowBank: { x: number; y: number; w: number; h: number; d: string }
    far: string
    farRim: string
    fall: Fall | null
    reflection: string
    signalFill: string
    signal: string
    banks: string
    banksRim: string
    landmark: Landmark
    mast: string
    beacon: Pt
    /** The lake: its water line, its x span between the near banks, and the moon's spot on it. */
    lake: { y: number; x0: number; x1: number; moonX: number; ripples: string }
    mists: { back: string[]; front: string[] }
    houses: string
    /** The moonward roof planes, lit. */
    roofs: string
    hamlet: House[]
    windows: Window[]
    /** The hearth: the warm place, its pool's centre and the ground it lies on. */
    hearth: { x: number; y: number }
    smoke: Pt | null
    /** The shore's one tube lamp, if it has one. */
    shore: Pt[]
    near: string
    nearRim: string
    woods: string
    tree: string
    treeRim: string
    /** The tree's trunk foot, for its lean. */
    treeFoot: Pt
    knoll: string
    reeds: string
    /** Where the amp tube stands on the knoll: the listener's seat. */
    amp: Pt
    lanterns: Lantern[]
    fireflies: Firefly[]
    glowX: number
    /** The night's brightness from the song (0.7–1.3): scales the moonlight on rims, water and mist. */
    light: number
    /** The song's weather (0–1): how thick the fog sheets lie. */
    weather: number
  }
  sky: {
    moon: Moon
    stars: Star[]
    band: (readonly [left: number, top: number, size: number])[]
    constellation: (readonly [left: number, top: number])[]
    clouds: Cloud[]
    cirrus: Cirrus[]
    meteors: Meteor[]
    aurora: string | null
    light: number
  }
}

/** The moon's zone (§5), as fractions of the scene: where it may sit on each screen, clear of what floats over it. */
export const ZONES = {
  summaryDesktop: { x: [0.08, 0.2], y: [0.12, 0.24] } as MoonZone,
  summaryCompact: { x: [0.12, 0.26], y: [0.38, 0.46] } as MoonZone,
  roomDesktop: { x: [0.07, 0.2], y: [0.12, 0.26] } as MoonZone,
  roomCompact: { x: [0.1, 0.22], y: [0.09, 0.15] } as MoonZone,
  /** Each half of the room split for A/B: in its outer corner, below the header's buttons and beside the record. */
  roomPair: { x: [0.05, 0.13], y: [0.3, 0.42] } as MoonZone,
}

/** The frame a shell mode draws at: the envelope always spans it, so a phone sees the whole song, recomposed. */
export const frameOf = (mode: 'wide' | 'laptop' | 'tablet' | 'phone'): Frame => (mode === 'wide' ? 1920 : mode === 'phone' ? 840 : 1280)

/** What the song reads as: anything not a valid fingerprint (an old row, a hand edit) draws the default night. */
function read(fp: unknown): Fingerprint {
  if (fp == null) return DEFAULT_FINGERPRINT
  const parsed = fingerprint.safeParse(fp)
  return parsed.success ? parsed.data : DEFAULT_FINGERPRINT
}

/** The archetype is the song's: wide mixes get open water, big dynamic songs big mountains, everything else a valley. */
export function archetypeOf(fp: Fingerprint): Archetype {
  if (fp.loud >= 0.6 && fp.dyn >= 0.55) return 'highlands'
  if (fp.width >= 0.65) return 'coast'
  return 'valley'
}

const cache = new Map<string, SceneModel>()

/** The song's night: generated once per `id + fingerprint + zone + frame + SCENE`, then memoised. */
export function sceneOf(id: string, fp: Fingerprint | null, zone: MoonZone, frame: number = 1920): SceneModel {
  let json: string
  try {
    json = fp ? JSON.stringify(fp) : 'd'
  } catch {
    json = 'x'
  }
  const key = `${id}:${json}:${zone.x.join(',')}:${zone.y.join(',')}:${frame}:${SCENE}`
  const hit = cache.get(key)
  if (hit) return hit
  const model = buildScene(id, read(fp), zone, frame)
  cache.set(key, model)
  if (cache.size > 12) cache.delete(cache.keys().next().value!)
  return model
}

/** Where the water lies: below every point of the song's ridge, so the lake never covers any of its line. */
const WATER = 232

function buildScene(id: string, song: Fingerprint, zone: MoonZone, frame: number): SceneModel {
  W = frame
  /** Horizontal spreads (the lake, the valley's furniture) shrink on a narrow frame so the valley still fits. */
  const k = Math.min(1, W / 1600)
  const { loud, dyn, width, weather, peak, length, env } = song
  const songKey = `${env.join(',')}|${loud}|${dyn}|${width}|${weather}|${peak}|${length}`
  // The big shapes are the song's alone; the small ones the song's and the id's together
  const big = rng(hash32(songKey))
  const seed = hash32(`${songKey}|${id}`)
  const rand = rng(seed)
  const own = rng(hash32(id))
  const archetype = archetypeOf(song)
  const relief = (0.75 + 0.5 * loud) * (archetype === 'highlands' ? 1.12 : 1)
  const rough = 0.6 + 0.8 * dyn
  const light = 0.7 + 0.4 * loud + 0.2 * (1 - weather)

  // Moon first: its side is where the song's energy sits, so every rim and glint agrees with it
  const centroid = env.reduce((s, v, i) => s + v * i, 0) / (env.reduce((s, v) => s + v, 0) || 1) / (env.length - 1)
  const side: -1 | 1 = centroid < 0.5 ? -1 : 1
  const [xr, yr] = side === 1 ? [[1 - zone.x[1], 1 - zone.x[0]], zone.y] : [zone.x, zone.y]
  const along = side === 1 ? loud : 1 - loud
  const moon: Moon = {
    x: (xr[0] + along * (xr[1] - xr[0])) * W,
    y: (yr[0] + (1 - dyn) * (yr[1] - yr[0])) * H,
    side,
    phase: dyn > 0.55 ? 'full' : dyn > 0.3 ? 'gibbous' : 'crescent',
    ring: weather >= 0.7,
  }

  // A. The ranges, from the envelope at two zoom levels: the back range is the song's form, the distant its sections.
  const fine = resample(env, 96)
  const peakCount = Math.max(2, Math.round((4 + length * 1.6) * (W / 1920) + (W < 1920 ? 1 : 0)))
  const spacing = 220 * Math.max(0.6, k)
  const range = (sigma: number, count: number, lift: number, scale: number, shift: number) => {
    const b = blur(fine, sigma)
    const mean = b.reduce((s, v) => s + v, 0) / b.length
    const height = (v: number) => mean + (v - mean) * (0.35 + 0.65 * dyn)
    // A monotone warp of x, its own per plane, so the ranges never line up as copies of the trace
    const [amp, f, phi] = [big() * 60, 0.5 + big() * 1.5, big() * Math.PI * 2]
    const xOf = (i: number) => {
      const x = (i / (b.length - 1)) * W
      return x + Math.min(amp, W / (2 * Math.PI * f) * 0.9) * Math.sin((2 * Math.PI * f * x) / W + phi) + shift
    }
    const maxima = b.map((_, i) => i).filter((i) => (i === 0 || b[i] >= b[i - 1]) && (i === b.length - 1 || b[i] >= b[i + 1]))
    const kept: number[] = []
    for (const i of [...maxima].sort((p, q) => b[q] - b[p])) {
      if (kept.length >= count) break
      const x = xOf(i)
      if (x < 40 || x > W - 40) continue
      if (kept.every((j) => Math.abs(xOf(j) - x) >= spacing)) kept.push(i)
    }
    // A flat song still gets its massifs: evenly spread, at its own level there
    for (let n = 0; kept.length < Math.min(3, count) && n < 12; n++) {
      const i = Math.round(((n % 6) + 0.5 + big() * 0.4) / 6 * (b.length - 1))
      if (kept.every((j) => Math.abs(xOf(j) - xOf(i)) >= spacing)) kept.push(i)
    }
    kept.sort((p, q) => p - q)
    const keys: Pt[] = [[-40, 78 + rand() * 16]]
    kept.forEach((i, n) => {
      const x = xOf(i)
      if (n > 0) {
        const prev = kept[n - 1]
        let low = prev
        for (let j = prev; j <= i; j++) if (b[j] < b[low]) low = j
        const sx = Math.max(keys[keys.length - 1][0] + 30, Math.min(x - 60, xOf(low)))
        keys.push([sx, 86 - 30 * height(b[low]) * relief + rand() * 8])
      }
      const u = x / W
      const crown = 40 * Math.exp(-(((u - peak) / 0.16) ** 2))
      const rise = (lift + 110 * height(b[i]) + crown) * relief * scale * (0.85 + rand() * 0.3)
      const sh = rand() < 0.35 + dyn * 0.5 ? (rand() < 0.5 ? -1 : 1) : 0
      if (sh === -1) keys.push([x - 80, 40 - rise * (0.45 + rand() * 0.2)])
      keys.push([x, 40 - rise])
      if (sh === 1) keys.push([x + 80, 40 - rise * (0.45 + rand() * 0.2)])
    })
    keys.push([W + 40, 78 + rand() * 16])
    return ease(rising(keys)).map(([x, y]) => [x, softFloor(y, TOP + 16)] as Pt)
  }
  const shiftBack = (big() < 0.5 ? -1 : 1) * (0.04 + big() * 0.04) * W
  const BACK = roughen(curve(range(4, peakCount + 1, 30, archetype === 'highlands' ? 1.2 : 1.05, shiftBack)), [[120, 2 * rough]], seed ^ 0x52, 2 * rough).map(([x, y]) => [x, softFloor(y, TOP + 12, 8)] as Pt)
  const DISTANT = roughen(curve(range(1.5, peakCount, 20, 1, 0)), [[110, 2.5 * rough], [36, 0.6 * rough]], seed ^ 0x51, 0.6 * rough).map(([x, y]) => [x, softFloor(y, TOP + 12, 8)] as Pt)

  // Snow: only a range whose tallest summit passes y −40 earns it (highlands always), above a ragged seeded line
  const snowOn = (line: readonly Pt[], force: boolean) => {
    const top = Math.min(...line.map(([, y]) => y))
    if (top >= -40 && !force) return ''
    const lineAt = (x: number) => Math.min(-30, top + 26) + 7 * Math.sin(x / 37 + seed) + 4 * Math.sin(x / 13)
    const runs: Pt[][] = []
    let open = false
    for (const p of line) {
      if (p[1] < lineAt(p[0])) {
        if (open) runs[runs.length - 1].push(p)
        else runs.push([p])
        open = true
      } else open = false
    }
    return runs.filter((r) => r.length > 2).map((r) => polygon([...r, ...[...r].reverse().map(([x]) => [x, lineAt(x)] as Pt)])).join('')
  }
  const snow = snowOn(BACK, archetype === 'highlands')

  // The cliffs: the song's changes, its first difference, as steps and bluffs; the waterfall at its biggest drop.
  const beaconX = W / 2 - 200 * k + 400 * k * Math.max(0, Math.min(1, peak + (big() - 0.5) * 0.6))
  const beaconSide: -1 | 1 = beaconX < W / 2 ? -1 : 1
  const mid = blur(fine, 1.5)
  const diff = mid.slice(1).map((v, i) => v - mid[i])
  let drop = 0
  for (let i = 1; i < diff.length; i++) if (diff[i] < diff[drop]) drop = i
  const dropX = (drop / (diff.length - 1)) * W
  const fallX = Math.abs(dropX - beaconX) > 160 && dropX > 120 && dropX < W - 120 ? dropX : W / 2 - beaconSide * (130 + rand() * 110) * k
  const hasFall = diff[drop] < -0.02 || big() < 0.6
  const farKeyCount = Math.max(5, Math.round((7 + length * 4) * (W / 1920)) + 2)
  const dScale = 1 / (Math.max(...diff.map(Math.abs)) || 1)
  const farKeys: Pt[] = Array.from({ length: farKeyCount }, (_, i) => {
    const u = i / (farKeyCount - 1)
    const step = -diff[Math.min(diff.length - 1, Math.round(u * (diff.length - 1)))] * dScale
    return [u * W, 128 + step * 14 * (0.6 + 0.8 * dyn) + Math.sin(i * 1.7 + rand() * 2) * 4] as Pt
  }).filter(([x]) => !hasFall || Math.abs(x - fallX) > 140)
  if (hasFall) farKeys.push([fallX - 110, 110], [fallX, 100 + rand() * 6], [fallX + 110, 112])
  farKeys.sort((a, b) => a[0] - b[0])
  const FAR = ridge(farKeys, [[160, 2.5], [55, 0.8]], seed ^ 0x9e, 0.8)

  // U3. One landmark per night, by the song: the coast's lighthouse, else a mast, an observatory, a windmill or a bridge
  const landmark: Landmark = archetype === 'coast' ? 'lighthouse' : (['mast', 'dome', 'windmill', 'bridge'] as const)[Math.floor(big() * 4)]
  const beaconFoot: Pt = [beaconX, yAt(FAR, beaconX) + 2]
  const lmHeight = 38 * (0.85 + rand() * 0.3)
  let mast = ''
  let beaconTop: Pt
  const [bx, by] = beaconFoot
  if (landmark === 'lighthouse') {
    const h = lmHeight * 1.1
    beaconTop = [bx, by - h - 3]
    mast = `M${pt(bx - 6, by)}L${pt(bx - 3.5, by - h)}L${pt(bx + 3.5, by - h)}L${pt(bx + 6, by)}Z` + `M${pt(bx - 4.5, by - h)}L${pt(bx, by - h - 7)}L${pt(bx + 4.5, by - h)}Z`
  } else if (landmark === 'dome') {
    beaconTop = [bx + 6, by - 21]
    mast = `M${pt(bx - 13, by)}V${n1(by - 10)}H${n1(bx + 13)}V${n1(by)}Z` + `M${pt(bx - 12, by - 10)}A12,12 0 0,1 ${pt(bx + 12, by - 10)}Z`
  } else if (landmark === 'windmill') {
    const hub: Pt = [bx, by - 26]
    beaconTop = [bx, by - 12]
    const blade = (a: number) => `M${pt(...hub)}L${pt(hub[0] + Math.cos(a) * 18 - Math.sin(a) * 2, hub[1] + Math.sin(a) * 18 + Math.cos(a) * 2)}L${pt(hub[0] + Math.cos(a) * 18, hub[1] + Math.sin(a) * 18)}Z`
    const a0 = rand() * Math.PI
    mast = `M${pt(bx - 6, by)}L${pt(bx - 3, by - 26)}L${pt(bx + 3, by - 26)}L${pt(bx + 6, by)}Z` + [0, 1, 2, 3].map((q) => blade(a0 + (q * Math.PI) / 2)).join('')
  } else {
    // The mast (and, under a bridge night, a lamp post: the bridge itself carries no light)
    const h = landmark === 'bridge' ? 14 : lmHeight
    beaconTop = [bx, by - h]
    mast = `M${pt(bx - 6 * (h / 38), by)}L${pt(...beaconTop)}L${pt(bx + 6 * (h / 38), by)}` + [0.3, 0.55, 0.8].map((f) => { const up = h * f; const half = 6 * (h / 38) * (1 - f); return `M${pt(bx - half, by - up)}L${pt(bx + half, by - up)}` }).join('')
  }
  let far = fill(FAR)
  for (let q = 0, n = 1 + Math.floor(rand() * 3); q < n; q++) {
    const cx = ((q + 0.2 + rand() * 0.6) / n) * W
    const spread = (140 + rand() * 140) * k
    if (Math.abs(cx - beaconX) > 120 && (!hasFall || Math.abs(cx - fallX) > 160)) far += grove(FAR, cx, Math.round(spread / 17), spread, 9 + rand() * 5, seed ^ Math.round(cx))
  }

  // The signal ridge: the song's own loudness, 24 points → 13 keys, stretched over y 142–210, never past 2.5×
  const sampled = [env[0], ...Array.from({ length: 11 }, (_, i) => env[(i + 1) * 2]), env[23]]
  const [lo, hi] = [Math.min(...sampled), Math.max(...sampled)]
  const span = Math.max(hi - lo, 0.4)
  const signalKeys: Pt[] = sampled.map((v, i) => [(i / (sampled.length - 1)) * W, 210 - ((v - lo) / span) * 68])
  const SIGNAL = ridge(signalKeys, [[Math.max(180, 300 * k), 10], [110, 2]], seed ^ 0x33, 2, 6).map(([x, y]) => [x, Math.min(y, WATER - 8)] as Pt)
  const fall: Fall | null = hasFall ? { x: fallX, top: yAt(FAR, fallX) + 3, bottom: yAt(SIGNAL, fallX), width: 6 + width * 8 } : null
  if (landmark === 'bridge' && fall) {
    // A stone arch over the stream below the waterfall
    const [fx, fy] = [fall.x, fall.bottom - 2]
    mast += `M${pt(fx - 24, fy + 4)}L${pt(fx - 24, fy - 6)}H${n1(fx + 24)}V${n1(fy + 4)}H${n1(fx + 14)}A14,9 0 0,0 ${pt(fx - 14, fy + 4)}Z`
  }
  const brightest = SIGNAL.reduce((a, b) => (b[1] < a[1] ? b : a))[0]

  // B. The hearth sits on a third of the frame, never the centre; the valley opens beside it.
  const hamletSide: -1 | 1 = big() < 0.5 ? -1 : 1
  const hearthX = W * (hamletSide === 1 ? 0.64 : 0.36) + (rand() - 0.5) * 30 * k
  const half = archetype === 'highlands' ? 80 * k + 20 : (120 + 170 * width) * k
  const vx = hearthX - hamletSide * (half + 90 * k)
  // On the coast the water runs off the edge away from the hearth to an open horizon
  const open: -1 | 1 | 0 = archetype === 'coast' ? (-hamletSide as -1 | 1) : 0
  const [lx0, lx1] = [open === -1 ? -60 : vx - half, open === 1 ? W + 60 : vx + half]
  const edge = (dir: -1 | 1) => (dir === -1 ? -60 : W + 60)

  // Mid banks: wooded hills following the ridge from below, running down to the water either side of the lake
  const bank = (dir: -1 | 1) => {
    const shore = vx + dir * (half - 40)
    const echo: Pt[] = []
    for (let x = edge(dir); dir * (x - shore - dir * 200 * k) > 0; x -= dir * 70) echo.push([x, Math.min(yAt(SIGNAL, x) + 24 + (rand() - 0.5) * 3, WATER - 8)])
    if (!echo.length) echo.push([edge(dir), WATER - 8])
    const keys: Pt[] = [...echo, [shore + dir * 60 * k, Math.max(WATER - 8, echo[echo.length - 1][1])], [shore - dir * 40 * k, WATER + 14]]
    const line = ridge(dir === -1 ? keys : [...keys].reverse(), [[120, 1.5]], seed ^ (0x4b + dir), 1.5)
    const [x0, x1] = [line[0][0], line[line.length - 1][0]]
    return { line, d: `${polyline(line)}L${pt(x1, FLOOR)}L${pt(x0, FLOOR)}Z` }
  }
  const banksWE = ([-1, 1] as const).filter((d) => d !== open).map((d) => ({ dir: d, ...bank(d) }))
  const banks = banksWE.map((b) => b.d).join('') + banksWE.flatMap(({ line, dir }) => [0.18 + rand() * 0.22, 0.56 + rand() * 0.24].map((f) => {
    const x = line[0][0] + (line[line.length - 1][0] - line[0][0]) * (dir === -1 ? f : 1 - f)
    return grove(line, x, 8 + Math.floor(rand() * 4), (130 + rand() * 40) * k, 15 + rand() * 4, seed ^ Math.round(x * 3))
  })).join('')

  // The near banks frame the lake; on the coast the open side is a low headland at the frame's edge
  const nearBank = (dir: -1 | 1) => {
    const keys: Pt[] = dir === open
      ? [[edge(dir), 238], [edge(dir) - dir * 140 * k, 244], [edge(dir) - dir * 240 * k, 262], [edge(dir) - dir * 300 * k, FLOOR - 20]]
      : [[edge(dir), 222], [vx + dir * (680 + rand() * 160) * k, 214], [vx + dir * (half + (230 + rand() * 60) * k), 220], [vx + dir * (half + 120 * k), 238], [vx + dir * (half + 30 * k), 262], [vx + dir * (half - 20 * k), H + 4]]
    const jittered = keys.map(([x, y], i) => [x, y + (rand() - 0.5) * (i < 2 ? 14 : 3)] as Pt)
    // Keep the keys between the frame's edges and running outward from the lake, whatever the frame
    const clipped = jittered.filter(([x], i) => i === 0 || (dir === -1 ? x > -60 : x < W + 60))
    return ridge(dir === -1 ? clipped : [...clipped].reverse(), [[140, 1.5]], seed ^ (0x77 + dir), 1.5)
  }
  const [NEAR_W, NEAR_E] = [nearBank(-1), nearBank(1)]
  const nearFill = (line: readonly Pt[]) => `${polyline(line)}L${pt(line[line.length - 1][0], FLOOR)}L${pt(line[0][0], FLOOR)}Z`
  const hearthLine = hamletSide === -1 ? NEAR_W : NEAR_E
  const otherBank = banksWE.find((b) => b.dir === -hamletSide) ?? banksWE[0]

  // The houses: the hearth's 2–4 (one cabin in the highlands) close together, and 1–2 solitary farms far from it,
  // a plane further back on the other side. No two light groups within 140 units, none near the trace's brightest.
  type Spot = { line: readonly Pt[]; x: number; far: boolean; hearth: boolean }
  const spots: Spot[] = []
  const hearthCount = archetype === 'highlands' ? 1 : 2 + Math.round(loud * 2)
  for (let q = 0; q < hearthCount; q++) spots.push({ line: hearthLine, x: hearthX + (q - (hearthCount - 1) / 2) * (24 + rand() * 6), far: false, hearth: true })
  const solitary = archetype === 'highlands' ? 1 : 1 + Math.round(width)
  for (let q = 0; q < solitary; q++) {
    let x = vx - hamletSide * (half + (120 + q * 180 + rand() * 120) * k)
    for (let guard = 0; guard < 10 && (spots.some((s) => Math.abs(s.x - x) < 140) || Math.abs(x - brightest) < 100); guard++) x -= hamletSide * 60
    if (x > 30 && x < W - 30) spots.push({ line: otherBank.line, x, far: true, hearth: false })
  }
  let houses = ''
  let roofs = ''
  let smoke: Pt | null = null
  const windows: Window[] = []
  const hamlet: House[] = spots.map(({ line, x, far: isFar, hearth }, i) => {
    const scale = isFar ? 0.6 : 1
    const w = (18 + rand() * 8) * scale
    const h = (10 + rand() * 4) * scale
    const ground = Math.max(yAt(line, x - w / 2), yAt(line, x + w / 2))
    const base = ground + 1.5
    const top = Math.min(yAt(line, x - w / 2), yAt(line, x + w / 2)) - h
    const roof = top - h * 0.65
    const eave = 3 * scale
    let chimney = ''
    if (hearth && i === 0) {
      const cx = x - side * w * 0.25
      chimney = `M${pt(cx - 1.8, top - h * 0.25)}L${pt(cx - 1.8, roof + 2)}L${pt(cx + 1.8, roof + 2)}L${pt(cx + 1.8, top - h * 0.4)}Z`
      smoke = [cx, roof + 1]
    }
    houses += `M${pt(x - w / 2, base)}L${pt(x - w / 2, top)}L${pt(x - w / 2 - eave, top)}L${pt(x, roof)}L${pt(x + w / 2 + eave, top)}L${pt(x + w / 2, top)}L${pt(x + w / 2, base)}Z${chimney}`
    // The roof plane facing the moon, filled rather than stroked (no scratches)
    roofs += `M${pt(x, roof)}L${pt(x + side * (w / 2 + eave), top)}L${pt(x + side * w * 0.12, top)}Z`
    const win: Pt = [x + (i % 2 ? -w * 0.2 : w * 0.15), top + h * 0.45]
    windows.push({ x: win[0], y: win[1], depth: isFar ? 'far' : 'near' })
    return { x, base, ground, window: win, far: isFar }
  })
  const hearth = { x: hearthX, y: yAt(hearthLine, hearthX) }

  // The shore's one tube lamp, at the lake's end away from the hearth, most nights
  const shore: Pt[] = rand() < 0.6 ? [[hamletSide === 1 ? Math.max(lx0, 0) + 40 * k : Math.min(lx1, W) - 40 * k, WATER - 6]] : []

  // Woods on both near banks, kept off the hearth; the framing tree across from it
  const woodsAt = (dir: -1 | 1) => vx + dir * (dir === hamletSide ? half + (300 + rand() * 80) * k : half + (220 + rand() * 200) * k)
  const woods = [
    open === -1 ? '' : grove(NEAR_W, woodsAt(-1), 10 + Math.floor(rand() * 7), (170 + rand() * 100) * k, 24 + rand() * 8, seed ^ 0x2f),
    open === 1 ? '' : grove(NEAR_E, woodsAt(1), 10 + Math.floor(rand() * 7), (170 + rand() * 100) * k, 24 + rand() * 8, seed ^ 0x5e),
  ].join('')
  const tx = Math.max(120, Math.min(W - 120, hamletSide === 1 ? W * 0.1 + rand() * 80 * k : W * 0.9 - rand() * 80 * k))
  const lean = hamletSide
  const crownX = tx + lean * (20 + rand() * 30)
  const crownY = 96 + rand() * 30
  const [crownW, crownH] = [56 + rand() * 30, 26 + rand() * 12]
  const trunk =
    `M${pt(tx - 9, FLOOR)}Q${pt(tx - 4, 220)} ${pt(crownX - 3, crownY + 30)}L${pt(crownX + 3, crownY + 30)}Q${pt(tx + 6, 220)} ${pt(tx + 9, FLOOR)}Z` +
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

  // D3. A place to stand: a knoll in the tree's corner, reeds along the bottom edge, the amp tube on the knoll's crest
  const knollDir = tx < W / 2 ? -1 : 1
  const kx0 = knollDir === -1 ? -60 : W + 60
  const kx1 = tx - knollDir * 260 * Math.max(0.7, k)
  const knollKeys: Pt[] = [[kx0, 262], [tx, 266 + rand() * 4], [(tx + kx1) / 2, 278], [kx1, FLOOR - 10]]
  const KNOLL = ridge(knollDir === -1 ? knollKeys : [...knollKeys].reverse(), [[90, 1]], seed ^ 0x6b, 1)
  const knoll = nearFill(KNOLL)
  const ampX = tx - knollDir * 70 * Math.max(0.7, k)
  const amp: Pt = [ampX, yAt(KNOLL, ampX) + 1]
  let reeds = ''
  for (let x = -20; x < W + 20; x += 9 + rand() * 26) {
    if (rand() < 0.45) continue
    const hgt = 6 + rand() * 12
    const tip = (rand() - 0.5) * 6
    reeds += `M${pt(x - 1, FLOOR - 18)}Q${pt(x, H - hgt * 0.5)} ${pt(x + tip, H - hgt)}Q${pt(x + 0.6, H - hgt * 0.5)} ${pt(x + 1, FLOOR - 18)}Z`
  }

  // Mist: wisps at the cliffs' foot (behind the lake) and a thin one lying on the water
  const mists = {
    back: [
      ribbon(-40, W * 0.45 + rand() * 120 * k, 150 + rand() * 8, 10 + 14 * weather, rand),
      ribbon(W * 0.57 - rand() * 120 * k, W + 40, 152 + rand() * 8, 10 + 14 * weather, rand),
    ],
    front: [ribbon(Math.max(-40, lx0 - 60), Math.min(W + 40, lx1 + 60), WATER + 10, 5 + 8 * weather, rand)],
  }
  const ripples = Array.from({ length: 7 }, (_, q) => {
    const y = WATER + 8 + q * 9
    const [a, b] = [Math.max(0, lx0), Math.min(W, lx1)]
    const len = (60 + rand() * 120) * k
    const x = a + 40 * k + rand() * Math.max(0, b - a - 80 * k - len)
    return `M${pt(x, y)}H${n1(x + len)}`
  }).join('')
  // C5. The lake holds a faint, flipped copy of the cliffs, fading 40 units down
  const [ra, rb] = [Math.max(-40, lx0), Math.min(W + 40, lx1)]
  const reflected = FAR.filter(([x]) => x >= ra && x <= rb).map(([x, y]) => [x, WATER + Math.min(40, Math.max(2, (165 - y) * 0.5))] as Pt)
  const reflection = reflected.length > 1 ? `M${pt(ra, WATER)}${reflected.map(([x, y]) => `L${pt(x, y)}`).join('')}L${pt(rb, WATER)}Z` : ''

  // The low cloud bank lying between the back range and the distant one: something passing behind a mountain
  const lowW = (300 + rand() * 150) * k
  const lowH = lowW * 0.24
  const lowBank = { x: W * (0.2 + rand() * 0.6) - lowW / 2, y: -10 + rand() * 30, w: lowW, h: lowH, d: cumulus(lowW, lowH, rand) }

  // Sky lanterns rise from the hearth, 1–3; or, on a still night, fireflies around the knoll — never both
  const lanterns: Lantern[] = weather < 0.5 ? [] : Array.from({ length: 1 + Math.round(dyn * 2) }, () => ({ x: hearthX + (own() - 0.5) * 240, delay: own() * 70, duration: 46 + own() * 30 }))
  const fireflies: Firefly[] = weather < 0.5 ? Array.from({ length: 3 }, () => ({ x: amp[0] + (own() - 0.5) * 220, y: 250 + own() * 40, delay: own() * 12 })) : []

  // C2. Clouds in three depths: cirrus always, far cumulus (fewer, quieter), one or two near banks
  const moonLeft = (moon.x / W) * 100
  const phone = W < 1000
  const slots = [6, 26, 66, 86].filter((s) => Math.abs(s + 4 - moonLeft) > 14)
  const want = Math.min(slots.length, phone ? 1 : 1 + Math.round(weather * 2))
  const order = [...slots].sort(() => own() - 0.5).slice(0, want).sort((a, b) => a - b)
  const clouds: Cloud[] = order.map((slot) => {
    const w = 160 + rand() * 120
    const h = w * (0.42 + rand() * 0.1)
    const cw = 9 + rand() * 3
    return { left: slot + rand() * (14 - cw), top: 8 + rand() * 14, width: cw, w, h, d: cumulus(w, h, rand), drift: 6 + rand() * 8, near: false }
  })
  for (let q = 0, n = phone ? 1 : weather > 0.6 ? 2 : 1; q < n; q++) {
    const w = 320 + rand() * 160
    const h = w * 0.36
    const cw = 18 + rand() * 8
    // Away from the moon's side, allowed off the edge
    const left = q === 0 ? (side === -1 ? 100 - cw * 0.7 : -cw * 0.3) : 30 + rand() * 30
    clouds.push({ left, top: 26 + rand() * 12, width: cw, w, h, d: cumulus(w, h, rand), drift: 18, near: true })
  }
  const tilt = Math.tan(((own() - 0.5) * 50 * Math.PI) / 180) * 0.4
  const cirrus: Cirrus[] = Array.from({ length: 2 + Math.floor(own() * 3) }, () => ({ left: own() * 70, top: 4 + own() * 22, width: 25 + own() * 20, height: 0.6 + own() * 0.6, angle: (Math.atan(tilt) * 180) / Math.PI, opacity: 0.1 + own() * 0.06 }))

  // Stars: tier counts scale with dynamics, thinning and dimming toward the horizon; 45% warm
  const starRand = rng(hash32(id) ^ 0x55)
  const stars: Star[] = []
  // U4. The song's constellation first: seven bright stars tracing the envelope's seven most prominent turns
  const turns = env.map((v, i) => ({ i, v, p: i === 0 || i === env.length - 1 ? 0 : Math.abs(v - (env[i - 1] + env[i + 1]) / 2) + (v > env[i - 1] === v > env[i + 1] ? 0.3 : 0) }))
  const seven = [...turns].sort((a, b) => b.p - a.p).slice(0, 7).sort((a, b) => a.i - b.i)
  const constellation: (readonly [number, number])[] = []
  const cLeft = 30 + (side === -1 ? 20 : 0) + starRand() * 6
  for (const [n, t] of seven.entries()) {
    const left = n1(cLeft + n * (32 / 6) * (phone ? 1.4 : 1) - (phone ? 6 : 0))
    const top = n1(8 + (1 - t.v) * 18)
    constellation.push([left, top])
    stars.push([left, top, 2.2, n % 3 === 0, false, false])
  }
  for (const [n, size] of [[Math.round(13 * (0.8 + 0.4 * dyn)), 2.2], [Math.round(34 * (0.8 + 0.4 * dyn)), 1.4], [Math.round(54 * (0.8 + 0.4 * dyn)), 0.9]] as const) {
    for (let placed = 0, guard = 0; placed < n && guard < 4000; guard++) {
      const left = 2 + starRand() * 96
      const top = 3 + 62 * starRand() * (0.35 + 0.65 * starRand())
      // Extinction: fewer, smaller stars toward the horizon
      if (top > 40 && starRand() < (top - 40) / 40) continue
      if (Math.hypot((left - moonLeft) * 1.6, top - (moon.y / H) * 100) < 14) continue
      if (stars.some(([l, t]) => Math.abs(l - left) < 3 && Math.abs(t - top) < 3.4)) continue
      const s = top > 45 ? Math.min(size, 1.4) : size
      stars.push([n1(left), n1(top), s, starRand() < 0.45, s > 2 && placed < 3, (s < 1 && placed % 6 === 0) || top > 45])
      placed++
    }
  }
  const [bandX, bandY] = [30 + starRand() * 40, 18 + starRand() * 14]
  const band: (readonly [left: number, top: number, size: number])[] = []
  for (let q = 0; q < 70; q++) {
    const left = 1 + starRand() * 98
    const top = bandY + (left - bandX) * tilt + (starRand() + starRand() + starRand() - 1.5) * 9
    const [l, t] = [n1(left), n1(top)]
    if (t < 2 || t > 60 || Math.hypot((l - moonLeft) * 1.6, t - (moon.y / H) * 100) < 16) continue
    band.push([l, t, n1(0.5 + starRand() * 0.4)])
  }

  // C4. Meteors from one radiant on the moon's far side: short and slow near it, long and fast far from it
  const radiant: Pt = [side === -1 ? 110 + starRand() * 30 : -10 - starRand() * 30, -20 - starRand() * 20]
  const meteor = (depth: Depth, every: number): Meteor => {
    const [left, top] = [15 + starRand() * 70, 4 + starRand() * 24]
    const dist = Math.hypot(left - radiant[0], top - radiant[1])
    const f = Math.min(1, dist / 120)
    return {
      left, top,
      angle: (Math.atan2(top - radiant[1], (left - radiant[0]) * 1.6) * 180) / Math.PI,
      length: 50 + 140 * f,
      depth,
      every,
      delay: 3 + starRand() * 14,
      duration: depth === 'far' ? 1.1 : depth === 'near' ? 0.55 : 0.8,
    }
  }
  const meteors = [meteor(starRand() < 0.5 ? 'far' : 'mid', 18 + starRand() * 14), meteor(starRand() < 0.5 ? 'near' : 'mid', 41 + starRand() * 26)]

  // U5. A pale aurora ribbon, rare: only a very dynamic, wide song gets one
  const aurora = dyn >= 0.8 && width >= 0.6
    ? polygon([...Array.from({ length: 13 }, (_, i) => [(i / 12) * 100, 14 + 6 * Math.sin(i * 0.7 + seed) + i * tilt * 4] as Pt), ...Array.from({ length: 13 }, (_, i) => [((12 - i) / 12) * 100, 22 + 5 * Math.sin((12 - i) * 0.7 + seed) + (12 - i) * tilt * 4] as Pt)])
    : null

  return {
    frame: W,
    archetype,
    land: {
      back: fill(BACK),
      backRim: litEdges(BACK, side),
      backStrata: [litEdges(BACK, side, 5), litEdges(BACK, side, 11)],
      snow,
      distant: fill(DISTANT),
      distantRim: litEdges(DISTANT, side),
      distantStrata: [litEdges(DISTANT, side, 5), litEdges(DISTANT, side, 11)],
      lowBank,
      far,
      farRim: litEdges(FAR, side),
      fall,
      reflection,
      signalFill: fill(SIGNAL),
      signal: polyline(SIGNAL),
      banks,
      banksRim: banksWE.map(({ line }) => litEdges(line, side)).join(''),
      landmark,
      mast,
      beacon: beaconTop,
      lake: { y: WATER, x0: lx0, x1: lx1, moonX: Math.max(Math.max(0, lx0) + 50, Math.min(Math.min(W, lx1) - 50, moon.x)), ripples },
      mists,
      houses,
      roofs,
      hamlet,
      windows,
      hearth,
      smoke,
      shore,
      near: nearFill(NEAR_W) + nearFill(NEAR_E),
      nearRim: litEdges(NEAR_W, side) + litEdges(NEAR_E, side),
      woods,
      tree,
      treeRim,
      treeFoot: [tx, H],
      knoll,
      reeds,
      amp,
      lanterns,
      fireflies,
      glowX: hearthX,
      light,
      weather,
    },
    sky: { moon, stars, band, constellation, clouds, cirrus, meteors, aurora, light },
  }
}
