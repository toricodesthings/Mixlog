import { describe, expect, it } from 'vitest'

import { reading } from '../../support/analysis'
import { PLATFORMS, analysisInput, deltaOf, normalizationOf, previousOf } from '#/server/loudness'

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
