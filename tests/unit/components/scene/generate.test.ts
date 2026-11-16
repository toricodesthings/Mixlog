import { describe, expect, it } from 'vitest'

import { DEFAULT_FINGERPRINT, fingerprintOf, type Fingerprint } from '#/server/loudness'
import { reading } from '../../../support/analysis'
import { archetypeOf, hash32, sceneOf, TOP, ZONES, type MoonZone } from '#/components/scene/generate'

const ZONE: MoonZone = { x: [0.08, 0.2], y: [0.12, 0.24] }

/** A song measured some other way each time, from a seeded walk over every field. */
function randomSong(n: number): Fingerprint {
  let a = hash32(`song-${n}`)
  const r = () => ((a = Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 4294967296
  return { ...DEFAULT_FINGERPRINT, loud: r(), dyn: r(), width: r(), weather: r(), peak: r(), length: r(), env: DEFAULT_FINGERPRINT.env.map(() => 0.1 + 0.9 * r()) }
}

/** A path's first shape as points, without the corners that close a fill below the band. */
const ridgeOf = (d: string) =>
  [...d.split('Z')[0].matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const).filter(([, y]) => y < 300)

const FINGERPRINTS: Record<string, Fingerprint> = {
  default: DEFAULT_FINGERPRINT,
  quiet: fingerprintOf(reading({ lufs: -22, plr: 6, lra: 4 })),
  loud: fingerprintOf(reading({ lufs: -7, plr: 18, lra: 14 })),
  wide: fingerprintOf(reading({ correlation: { mean: 0.1, min: 0.1, minAtMs: 0 } })),
  mono: fingerprintOf(reading({ correlation: { mean: 1, min: 1, minAtMs: 0 } })),
}

describe('hash32', () => {
  it('is stable for the same id and different for different ones', () => {
    expect(hash32('a-track-id')).toBe(hash32('a-track-id'))
    expect(hash32('a-track-id')).not.toBe(hash32('another-track-id'))
  })
})

describe('sceneOf', () => {
  it('is the same model for the same id and fingerprint', () => {
    const a = sceneOf('track-1', FINGERPRINTS.default, ZONE)
    const b = sceneOf('track-1', FINGERPRINTS.default, ZONE)
    expect(a).toEqual(b)
  })

  it('gives two songs that measure exactly alike the same big shapes but their own small ones and sky', () => {
    const a = sceneOf('track-1', FINGERPRINTS.default, ZONE)
    const b = sceneOf('track-2', FINGERPRINTS.default, ZONE)
    expect(a.land.back).not.toBe(b.land.back)
    expect(a.archetype).toBe(b.archetype)
    expect(a.land.landmark).toBe(b.land.landmark)
    expect(a.land.beacon[0]).toBe(b.land.beacon[0])
    expect(a.sky.stars).not.toEqual(b.sky.stars)
  })

  it('draws the default night for anything that is not a fingerprint', () => {
    const fallback = sceneOf('bad', null, ZONE)
    const { peak: _, ...missing } = FINGERPRINTS.loud
    for (const bad of [missing, { ...FINGERPRINTS.loud, env: FINGERPRINTS.loud.env.slice(0, 22) }, JSON.stringify(FINGERPRINTS.loud)]) {
      expect(sceneOf('bad', bad as unknown as Fingerprint, ZONE).land.back).toBe(fallback.land.back)
    }
  })

  it('never draws a NaN or a collapsed line for 500 songs, at every frame', () => {
    for (const [id, fp, zone] of SWEEP) {
      for (const frame of [1920, 1280, 840]) {
        const { land } = sceneOf(id, fp, zone, frame)
        for (const d of [land.back, land.distant, land.far, land.signal, land.banks, land.near, land.tree, land.knoll]) expect(d).toMatch(/^[MLQHVZAa\d\s,.\-]+$/)
        for (const d of [land.back, land.distant, land.far, land.signal]) expect(ridgeOf(d).length, `${id}@${frame}`).toBeGreaterThanOrEqual(12)
      }
    }
  })

  it('lets the song drive most of the night: a different reading changes at least half of everything drawn', () => {
    const fields = (m: ReturnType<typeof sceneOf>) => ({ ...m.land, ...m.sky }) as Record<string, unknown>
    const songs = Object.values(FINGERPRINTS)
    for (const id of ['s1', 's2', 's3']) {
      for (let i = 0; i < songs.length; i++) {
        for (let j = i + 1; j < songs.length; j++) {
          const [a, b] = [fields(sceneOf(id, songs[i], ZONE)), fields(sceneOf(id, songs[j], ZONE))]
          const changed = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).length
          expect(changed / Object.keys(a).length).toBeGreaterThanOrEqual(0.5)
        }
      }
    }
  })

  it('places the moon by the song: its side where the energy sits, its height by the dynamics', () => {
    const early = { ...FINGERPRINTS.default, env: [1, 1, 1, 1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1] }
    const late = { ...early, env: [...early.env].reverse() }
    expect(sceneOf('m', early, ZONE).sky.moon.side).toBe(-1)
    expect(sceneOf('m', late, ZONE).sky.moon.side).toBe(1)
    const calm = sceneOf('m', { ...early, dyn: 0.1 }, ZONE).sky.moon.y
    const wild = sceneOf('m', { ...early, dyn: 0.9 }, ZONE).sky.moon.y
    expect(wild).toBeLessThan(calm)
  })

  it('differs for a different fingerprint, even with the same id', () => {
    const a = sceneOf('track-1', FINGERPRINTS.quiet, ZONE)
    const b = sceneOf('track-1', FINGERPRINTS.loud, ZONE)
    expect(a.land.distant).not.toBe(b.land.distant)
  })

  it('still gives each song its own sky before anything is measured (fp null): the default land, the id’s stars', () => {
    const a = sceneOf('track-1', null, ZONE)
    const b = sceneOf('track-2', null, ZONE)
    expect(a).not.toEqual(b)
  })

  it('places the moon inside its zone, mirrored to the other side when the seed picks it', () => {
    for (const id of ['x1', 'x2', 'x3', 'x4', 'x5']) {
      const { sky } = sceneOf(id, FINGERPRINTS.default, ZONE)
      const left = sky.moon.side === 1 ? 1 - ZONE.x[1] : ZONE.x[0]
      const right = sky.moon.side === 1 ? 1 - ZONE.x[0] : ZONE.x[1]
      expect(sky.moon.x / 1920).toBeGreaterThanOrEqual(left - 1e-6)
      expect(sky.moon.x / 1920).toBeLessThanOrEqual(right + 1e-6)
      expect(sky.moon.y / 300).toBeGreaterThanOrEqual(ZONE.y[0] - 1e-6)
      expect(sky.moon.y / 300).toBeLessThanOrEqual(ZONE.y[1] + 1e-6)
    }
  })

  it('keeps the beacon inside the phone-safe core (x 760–1160)', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      for (const fp of Object.values(FINGERPRINTS)) {
        const { land } = sceneOf(id, fp, ZONE)
        expect(land.beacon[0]).toBeGreaterThanOrEqual(760)
        expect(land.beacon[0]).toBeLessThanOrEqual(1160)
      }
    }
  })

  it('never produces NaN or non-finite numbers in the land or sky, paths included', () => {
    for (let n = 0; n < 60; n++) {
      for (const fp of Object.values(FINGERPRINTS)) {
        const json = JSON.stringify(sceneOf(`n${n}`, fp, ZONE))
        expect(json).not.toMatch(/NaN|Infinity|undefined/)
      }
    }
  })

  it('stands every cottage on its slope: its base just under the ground, never sunk into it', () => {
    for (let n = 0; n < 40; n++) {
      const { land } = sceneOf(`h${n}`, FINGERPRINTS.default, ZONE)
      expect(land.hamlet.length).toBeGreaterThanOrEqual(3)
      for (const house of land.hamlet) {
        expect(house.base - house.ground).toBeGreaterThanOrEqual(0)
        expect(house.base - house.ground).toBeLessThanOrEqual(2)
        expect(house.window[1]).toBeLessThan(house.ground)
      }
      // A cottage up on a mid bank never stands on a near house's roof (the beacon's hut, last, is on the cliffs)
      const near = land.hamlet.filter((h) => !h.far)
      for (const cottage of land.hamlet.slice(0, -1).filter((h) => h.far)) for (const h of near) expect(Math.abs(cottage.x - h.x)).toBeGreaterThanOrEqual(40)
    }
  })

  it('draws the peaks’ ridge left to right, so it never loops back on itself', () => {
    for (let n = 0; n < 200; n++) {
      const xs = ridgeOf(sceneOf(`r${n}`, randomSong(n), ZONE).land.distant).map(([x]) => x)
      xs.slice(1).forEach((x, i) => expect(x).toBeGreaterThanOrEqual(xs[i] - 0.5))
    }
  })

  it('is pinned for three fixtures, so no change moves a pixel by accident (bump SCENE and these on purpose)', () => {
    const pin = (id: string, fp: Fingerprint | null) => hash32(JSON.stringify(sceneOf(id, fp, ZONES.summaryDesktop)))
    expect([pin('pin-1', null), pin('pin-2', FINGERPRINTS.loud), pin('pin-3', FINGERPRINTS.quiet)]).toEqual([2556180398, 551902231, 1936559744])
  })

  // 500 songs, each measured differently, on every screen's zone
  const SWEEP = Array.from({ length: 500 }, (_, n) => [`sweep-${n}`, randomSong(n), Object.values(ZONES)[n % 4]] as const)

  it('holds the layout bands for 500 songs: peaks clear of the headroom, cliffs, ridge and water in their bands', () => {
    for (const [id, fp, zone] of SWEEP) {
      const { land } = sceneOf(id, fp, zone)
      for (const peaks of [land.back, land.distant]) expect(Math.min(...ridgeOf(peaks).map(([, y]) => y))).toBeGreaterThanOrEqual(TOP + 10)
      const far = ridgeOf(land.far).map(([, y]) => y)
      expect(Math.min(...far)).toBeGreaterThanOrEqual(90)
      expect(Math.max(...far)).toBeLessThanOrEqual(165)
      const signal = ridgeOf(land.signal).map(([, y]) => y)
      expect(Math.min(...signal)).toBeGreaterThanOrEqual(125)
      expect(Math.max(...signal)).toBeLessThanOrEqual(land.lake.y - 8)
      expect(land.beacon[1]).toBeGreaterThanOrEqual(60)
    }
  })

  it('shows a phone the whole story for 500 songs: its own frame holds the beacon, the hearth and a lit window', () => {
    for (const [id, fp, zone] of SWEEP) {
      const { land } = sceneOf(id, fp, zone, 840)
      const inside = (x: number) => x >= 0 && x <= 840
      expect(inside(land.beacon[0]), id).toBe(true)
      expect(inside(land.hearth.x), id).toBe(true)
      expect(land.windows.some((w) => inside(w.x)), id).toBe(true)
    }
  })

  it('keeps the light budget for 500 songs: 5–11 points, the hearth on a third, no two groups within 140 units', () => {
    for (const [id, fp, zone] of SWEEP) {
      const { land } = sceneOf(id, fp, zone)
      const points = land.windows.length + land.shore.length + land.lanterns.length + land.fireflies.length + 1
      expect(points, id).toBeGreaterThanOrEqual(5)
      expect(points, id).toBeLessThanOrEqual(11)
      expect(Math.abs(Math.abs(land.hearth.x / 1920 - 0.5) - 0.14), id).toBeLessThanOrEqual(0.02)
      const groups = land.hamlet.filter((h) => h.far).map((h) => h.x)
      for (const g of groups) expect(Math.abs(g - land.hearth.x), id).toBeGreaterThanOrEqual(140)
      expect(land.lanterns.length && land.fireflies.length).toBe(0)
    }
  })

  it('lets the song pick its archetype and landmark, and every one occurs', () => {
    const nights = SWEEP.map(([id, fp, zone]) => sceneOf(id, fp, zone))
    const count = (a: string) => nights.filter((n) => n.archetype === a).length
    expect(count('valley')).toBeGreaterThan(count('coast'))
    expect(count('valley')).toBeGreaterThan(count('highlands'))
    expect(count('coast')).toBeGreaterThan(0)
    expect(count('highlands')).toBeGreaterThan(0)
    for (const lm of ['mast', 'lighthouse', 'dome', 'windmill', 'bridge']) expect(nights.some((n) => n.land.landmark === lm), lm).toBe(true)
  })

  it('draws the song’s constellation from its envelope: seven stars, left to right', () => {
    const { constellation } = sceneOf('k', FINGERPRINTS.loud, ZONE).sky
    expect(constellation).toHaveLength(7)
    constellation.slice(1).forEach(([l], i) => expect(l).toBeGreaterThan(constellation[i][0]))
  })

  it('never makes two songs the same place: the ranges of 200 songs differ pairwise (U6)', () => {
    const lines = SWEEP.slice(0, 200).map(([id, fp]) => {
      const { land } = sceneOf(id, fp, ZONE)
      const at = (d: string) => {
        const r = ridgeOf(d)
        return Array.from({ length: 64 }, (_, i) => {
          const x = (i / 63) * 1920
          const j = Math.max(1, r.findIndex(([px]) => px >= x))
          return r[Math.min(j, r.length - 1)][1]
        })
      }
      return [...at(land.back), ...at(land.distant)]
    })
    let smallest = Infinity
    for (let i = 0; i < lines.length; i++)
      for (let j = i + 1; j < lines.length; j++) smallest = Math.min(smallest, Math.sqrt(lines[i].reduce((s, v, k) => s + (v - lines[j][k]) ** 2, 0) / lines[i].length))
    expect(smallest).toBeGreaterThan(3)
  })

  it('keeps every ridge under a slope of 0.9 for 500 songs, so no hill reads as a pyramid or a wall', () => {
    for (const [id, fp, zone] of SWEEP) {
      const { land } = sceneOf(id, fp, zone)
      // The banks' and near banks' first two shapes are their ridges; what follows them is woods
      const lines = [land.back, land.distant, land.far, land.signal, ...land.banks.split('Z').slice(0, archetypeOf(fp) === 'coast' ? 1 : 2), ...land.near.split('Z').slice(0, 2)].map(ridgeOf)
      const steepest = Math.max(...lines.flatMap((line) => line.slice(1).map(([x, y], i) => (x - line[i][0] > 0.5 ? Math.abs(y - line[i][1]) / (x - line[i][0]) : 0))))
      expect(steepest, id).toBeLessThanOrEqual(0.9)
    }
  })

  it('lays the nearest banks along the light’s path for 500 songs: a step below the trace, never over it', () => {
    for (const [id, fp, zone] of SWEEP) {
      const { land } = sceneOf(id, fp, zone)
      const signal = ridgeOf(land.signal)
      const yAt = (x: number) => {
        const found = signal.findIndex(([px]) => px >= x)
        const i = found === -1 ? signal.length - 1 : Math.max(1, found)
        const [[ax, ay], [bx, by]] = [signal[i - 1], signal[i]]
        return ay + ((by - ay) * (x - ax)) / (bx - ax || 1)
      }
      // A coast has one mid bank: its water runs off the other edge
      for (const bank of land.banks.split('Z').slice(0, archetypeOf(fp) === 'coast' ? 1 : 2).map(ridgeOf)) {
        // On the band, away from the lake, where the crest runs down to the water
        for (const [x, y] of bank.filter(([x]) => x >= 0 && x <= 1920 && (x < land.lake.x0 - 260 || x > land.lake.x1 + 260))) {
          // 24 below the trace, or the water's edge where the trace runs that low
          expect(Math.abs(y - Math.min(yAt(x) + 24, land.lake.y - 8)), id).toBeLessThanOrEqual(10)
          expect(y, id).toBeGreaterThan(yAt(x))
        }
      }
    }
  })

  it('keeps the whole night under 60 KB for 500 songs (the markup is the model’s strings plus a few tags)', () => {
    for (const [id, fp, zone] of SWEEP) expect(JSON.stringify(sceneOf(id, fp, zone)).length).toBeLessThanOrEqual(60 * 1024)
  })

  it('lays a faint band of stars across the upper sky, clear of the moon', () => {
    for (let n = 0; n < 40; n++) {
      const { band, moon } = sceneOf(`b${n}`, FINGERPRINTS.default, ZONE).sky
      expect(band.length).toBeGreaterThanOrEqual(30)
      for (const [left, top] of band) {
        expect(top).toBeLessThanOrEqual(60)
        expect(Math.hypot((left - (moon.x / 1920) * 100) * 1.6, top - (moon.y / 300) * 100)).toBeGreaterThanOrEqual(16)
      }
    }
  })

  it('never lets two clouds touch, even at the ends of their drift', () => {
    for (let n = 0; n < 60; n++) {
      // Far cumulus only: the near banks are a depth of their own, meant to pass in front
      const clouds = sceneOf(`c${n}`, FINGERPRINTS.loud, ZONE).sky.clouds.filter((c) => !c.near)
      expect(clouds.length).toBeGreaterThanOrEqual(1)
      clouds.forEach((a, i) =>
        clouds.slice(i + 1).forEach((b) => {
          // Slots are 20% apart and a cloud stays in its first 14%, so a few px of drift can't close the 6% gap
          expect(a.left + a.width + 5 < b.left || b.left + b.width + 5 < a.left).toBe(true)
        }),
      )
    }
  })

  it('lets the song lay out the valley: the lake, the village’s bank, the tree and the lamps move from song to song', () => {
    const nights = SWEEP.slice(0, 60).map(([id, fp, zone]) => sceneOf(id, fp, zone).land)
    const distinct = (f: (l: (typeof nights)[number]) => unknown) => new Set(nights.map((l) => JSON.stringify(f(l)))).size
    expect(distinct((l) => Math.sign(l.glowX - (l.lake.x0 + l.lake.x1) / 2))).toBe(2)
    expect(distinct((l) => Math.round((l.lake.x0 + l.lake.x1) / 40))).toBeGreaterThanOrEqual(6)
    expect(distinct((l) => l.hamlet.length)).toBeGreaterThanOrEqual(3)
    expect(distinct((l) => l.shore.length)).toBeGreaterThanOrEqual(2)
  })

  it('keeps the hamlet’s heart inside a phone’s crop of the valley', () => {
    for (let n = 0; n < 40; n++) {
      const { land } = sceneOf(`p${n}`, FINGERPRINTS.default, ZONE)
      expect(Math.abs(land.glowX - 960)).toBeLessThanOrEqual(480)
    }
  })

  it('keeps the moon inside A/B’s pair zone', () => {
    const zone = ZONES.roomPair
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      const { sky } = sceneOf(id, FINGERPRINTS.default, zone)
      const [left, right] = sky.moon.side === 1 ? [1 - zone.x[1], 1 - zone.x[0]] : zone.x
      expect(sky.moon.x / 1920).toBeGreaterThanOrEqual(left - 1e-6)
      expect(sky.moon.x / 1920).toBeLessThanOrEqual(right + 1e-6)
      expect(sky.moon.y / 300).toBeGreaterThanOrEqual(zone.y[0] - 1e-6)
      expect(sky.moon.y / 300).toBeLessThanOrEqual(zone.y[1] + 1e-6)
    }
  })
})
