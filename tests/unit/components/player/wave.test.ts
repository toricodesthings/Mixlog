import { describe, expect, it } from 'vitest'

import { heightOf, pool } from '#/components/player/wave'

describe('the loudness waveform', () => {
  it('draws amplitude on one fixed scale, silence a stub', () => {
    expect(heightOf(-3)).toBe(1)
    expect(heightOf(0)).toBe(1)
    expect(heightOf(-9)).toBeCloseTo(0.5, 2)
    expect(heightOf(-15)).toBeCloseTo(0.25, 2)
    expect(heightOf(-70)).toBe(0.04)
  })
  it('keeps the loudest reading of each share', () => {
    expect(pool([-30, -10, -20, -25], 2)).toEqual([-10, -20])
    expect(pool(Array.from({ length: 256 }, (_, i) => -i / 10), 64)).toHaveLength(64)
  })
  it('repeats neighbours when there are more bars than readings', () => expect(pool([-10, -20], 4)).toEqual([-10, -10, -20, -20]))
})
