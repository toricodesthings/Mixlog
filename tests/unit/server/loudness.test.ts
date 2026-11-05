import { describe, expect, it } from 'vitest'

import { reading } from '../../support/analysis'
import { DEFAULT_FINGERPRINT, PLATFORMS, analysisInput, deltaOf, fingerprint, fingerprintOf, normalizationOf, previousOf } from '#/server/loudness'

const platform = (name: string) => PLATFORMS.find((p) => p.name === name)!

describe('analysisInput', () => {
  it('takes a reading and an unreadable stamp', () => {
    expect(analysisInput.parse(reading())).toEqual(reading())
    expect(analysisInput.safeParse({ meter: 1, unreadable: true }).success).toBe(true)
  })
  it('refuses NaN, a short wave and loudness out of range', () => {
    expect(analysisInput.safeParse(reading({ lufs: NaN })).success).toBe(false)
    expect(analysisInput.safeParse(reading({ wave: Array(255).fill(-20) })).success).toBe(false)
    expect(analysisInput.safeParse(reading({ lufs: -90 })).success).toBe(false)
  })
})

describe('normalizationOf', () => {
  it('turns a loud song down to the target', () => expect(normalizationOf(reading(), platform('Spotify'))).toBe(-4.8))
  it('turns a quiet one up only as far as the peak ceiling', () => {
    expect(normalizationOf(reading({ lufs: -18, truePeak: -6 }), platform('Spotify'))).toBe(4)
    expect(normalizationOf(reading({ lufs: -18, truePeak: -3 }), platform('Spotify'))).toBe(2)
  })
  it('leaves a quiet one alone where the platform only turns down', () => expect(normalizationOf(reading({ lufs: -18 }), platform('YouTube'))).toBe(0))
  it('has nothing to say about silence', () => expect(normalizationOf(reading({ lufs: null }), platform('Spotify'))).toBeNull())
})

describe('previousOf', () => {
  const v = (id: string, kind: string, number: number, track_id = 't') => ({ id, kind, number, track_id })
  const all = [v('m1', 'mix', 1), v('m2', 'master', 2), v('m3', 'mix', 3), v('m4', 'master', 4), v('o', 'master', 1, 'other')]
  it('is the highest lower number in the same lane', () => {
    expect(previousOf(all[3], all)?.id).toBe('m2')
    expect(previousOf(all[2], all)?.id).toBe('m1')
  })
  it('moves with a lane move', () => expect(previousOf({ ...all[2], kind: 'master' }, all)?.id).toBe('m2'))
  it('is null for the first in its lane', () => expect(previousOf(all[1], all)).toBeNull())
})

describe('fingerprintOf', () => {
  it('maps the ends and never throws on extremes', () => {
    expect(fingerprintOf(reading({ lufs: -30, plr: 4, correlation: { mean: 1, min: 1, minAtMs: 0 }, lra: 2, loudest: { atMs: 0, lufs: -9 }, ms: 90_000 }))).toMatchObject({
      loud: 0, dyn: 0, width: 0, weather: 0, peak: 0, length: 0,
    })
    expect(
      fingerprintOf(reading({ lufs: -6, plr: 20, correlation: { mean: 0.2, min: 0.2, minAtMs: 0 }, lra: 16, loudest: { atMs: 360_000, lufs: -9 }, ms: 360_000 })),
    ).toMatchObject({ loud: 1, dyn: 1, width: 1, weather: 1, peak: 1, length: 1 })
    expect(() => fingerprintOf(reading({ lufs: 10, plr: 100, lra: 60, ms: 1 }))).not.toThrow()
  })
  it('falls back to the default when a reading is null', () => {
    const fp = fingerprintOf(reading({ lufs: null, plr: null, lra: null, dr: null, correlation: null, loudest: null }))
    expect(fp).toMatchObject({ loud: DEFAULT_FINGERPRINT.loud, dyn: DEFAULT_FINGERPRINT.dyn, width: DEFAULT_FINGERPRINT.width, weather: DEFAULT_FINGERPRINT.weather, peak: DEFAULT_FINGERPRINT.peak })
  })
  it('falls back dyn to lra, then dr, when plr is null', () => {
    expect(fingerprintOf(reading({ plr: null, lra: 9 })).dyn).toBeCloseTo((9 - 2) / 14, 2)
    expect(fingerprintOf(reading({ plr: null, lra: null, dr: 9 })).dyn).toBeCloseTo((9 - 3) / 13, 2)
  })
  it('rounds to 0.01 and normalises env by its own max, so a quiet song keeps its shape', () => {
    const quiet = fingerprintOf(reading({ wave: Array(256).fill(-40) }))
    const loud = fingerprintOf(reading({ wave: Array(256).fill(-10) }))
    expect(quiet.env).toEqual(loud.env)
    expect(Math.max(...quiet.env)).toBe(1)
    for (const v of quiet.env) expect(Math.round(v * 100) / 100).toBe(v)
  })
  it('parses with the fingerprint schema', () => expect(fingerprint.safeParse(fingerprintOf(reading())).success).toBe(true))
})

describe('DEFAULT_FINGERPRINT', () => {
  it('is a valid fingerprint at the midpoints', () => expect(fingerprint.safeParse(DEFAULT_FINGERPRINT).success).toBe(true))
})

describe('deltaOf', () => {
  it('says each headline change, and when it is the same', () => {
    expect(deltaOf(reading({ lufs: -8.2 }), reading())).toMatchObject({ lufs: { by: 1, same: false }, plr: { by: 0, same: true } })
    expect(deltaOf(reading({ correlation: { mean: 0.79, min: 0.3, minAtMs: 0 } }), reading())?.correlation).toEqual({ by: -0.03, same: false })
  })
  it('is null across meters or without a reading', () => {
    expect(deltaOf(reading({ meter: 2 }), reading())).toBeNull()
    expect(deltaOf({ meter: 1, unreadable: true }, reading())).toBeNull()
  })
})
