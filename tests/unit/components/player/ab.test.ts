import { describe, expect, it } from 'vitest'

import { DRIFT, clampTo, driftedOf, gainOf, putOf, releaseOf } from '#/components/player/ab'

describe('A/B', () => {
  it('latches a tap and goes back after a hold, unless hold is off', () => {
    expect(releaseOf(0, 299, true)).toBe('stay')
    expect(releaseOf(0, 301, true)).toBe('back')
    expect(releaseOf(0, 5000, false)).toBe('stay')
  })

  it('lines two decks up in seconds, each held inside its own length', () => {
    expect(clampTo(42, 200)).toBe(42)
    expect(clampTo(210, 200)).toBe(200)
    expect(clampTo(-3, 200)).toBe(0)
    expect(clampTo(42, NaN)).toBe(42)
  })

  it('pulls the silent deck back only past the drift, and only inside its length', () => {
    expect(driftedOf(10, 10 + DRIFT / 2, 200)).toBe(false)
    expect(driftedOf(10, 10 + DRIFT * 2, 200)).toBe(true)
    expect(driftedOf(201, 150, 200)).toBe(false)
  })

  it('puts a version on a side: same, swap, refuse or load', () => {
    expect(putOf({ a: 'v2', b: 'v3' }, 'a', 'v2')).toBe('same')
    // Picking the other side's version swaps the two
    expect(putOf({ a: 'v2', b: 'v3' }, 'a', 'v3')).toBe('swap')
    expect(putOf({ a: 'v2', b: 'v3' }, 'b', 'v2')).toBe('swap')
    // B still empty: A's own version there would compare nothing
    expect(putOf({ a: 'v2', b: null }, 'b', 'v2')).toBe('refuse')
    expect(putOf({ a: 'v2', b: null }, 'b', 'v4')).toBe('load')
    expect(putOf({ a: 'v2', b: 'v3' }, 'b', 'v4')).toBe('load')
  })

  it('turns a trim into a gain', () => {
    expect(gainOf(0)).toBe(1)
    expect(gainOf(-6)).toBeCloseTo(0.501, 3)
  })
})
