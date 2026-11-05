import { describe, expect, it } from 'vitest'

import { DEFAULT_FINGERPRINT, fingerprintOf, type Fingerprint } from '#/server/loudness'
import { reading } from '../../../support/analysis'
import { hash32, sceneOf, TOP, ZONES, type MoonZone } from '#/components/scene/generate'

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

  it('gives two songs that measure exactly alike the same land but each its own sky', () => {
    const a = sceneOf('track-1', FINGERPRINTS.default, ZONE)
    const b = sceneOf('track-2', FINGERPRINTS.default, ZONE)
    // The sky lanterns ride on the land but are the id's, like the stars
    expect({ ...a.land, lanterns: [] }).toEqual({ ...b.land, lanterns: [] })
    expect(a.sky.stars).not.toEqual(b.sky.stars)
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
    expect([pin('pin-1', null), pin('pin-2', FINGERPRINTS.loud), pin('pin-3', FINGERPRINTS.quiet)]).toEqual([547468855, 1270851311, 2421181133])
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

  it('shows a phone the story for 500 songs: the beacon, a lit window and a sky lantern inside the core (x 760–1160)', () => {
    const core = (x: number) => x >= 760 && x <= 1160
    for (const [id, fp, zone] of SWEEP) {
      const { land } = sceneOf(id, fp, zone)
      expect(core(land.beacon[0])).toBe(true)
      expect(land.hamlet.some((h) => core(h.window[0]))).toBe(true)
      expect(land.lanterns.some((l) => core(l.x))).toBe(true)
    }
  })

  it('keeps every ridge under a slope of 0.9 for 500 songs, so no hill reads as a pyramid or a wall', () => {
    for (const [id, fp, zone] of SWEEP) {
      const { land } = sceneOf(id, fp, zone)
      // The banks' and near banks' first two shapes are their ridges; what follows them is woods
      const lines = [land.back, land.distant, land.far, land.signal, ...land.banks.split('Z').slice(0, 2), ...land.near.split('Z').slice(0, 2)].map(ridgeOf)
      const steepest = Math.max(...lines.flatMap((line) => line.slice(1).map(([x, y], i) => (x - line[i][0] > 0.5 ? Math.abs(y - line[i][1]) / (x - line[i][0]) : 0))))
      expect(steepest, id).toBeLessThanOrEqual(0.9)
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
      const { clouds } = sceneOf(`c${n}`, FINGERPRINTS.loud, ZONE).sky
      expect(clouds.length).toBeGreaterThanOrEqual(1)
      clouds.forEach((a, i) =>
        clouds.slice(i + 1).forEach((b) => {
          // Slots are 20% apart and a cloud stays in its first 14%, so a few px of drift can't close the 6% gap
          expect(a.left + a.width + 5 < b.left || b.left + b.width + 5 < a.left).toBe(true)
        }),
      )
    }
  })

  it('keeps the hamlet’s heart inside a phone’s crop of the valley', () => {
    for (let n = 0; n < 40; n++) {
      const { land } = sceneOf(`p${n}`, FINGERPRINTS.default, ZONE)
      expect(Math.abs(land.glowX - 960)).toBeLessThanOrEqual(480)
    }
  })
})
