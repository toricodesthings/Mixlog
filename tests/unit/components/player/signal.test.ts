import { describe, expect, it } from 'vitest'

import { follow, levelsOf } from '#/components/player/signal'

// 48 kHz, fftSize 2048: 1024 bins of ~23 Hz
const binHz = 48_000 / 2048
const spectrum = (at: (hz: number) => number) => Uint8Array.from({ length: 1024 }, (_, i) => at(i * binHz))

describe('signal', () => {
  it('rests the meters at silence and lights the band that sounds', () => {
    const silent = levelsOf(new Uint8Array(1024), binHz)
    expect(silent.bands).toEqual([0.15, 0.15, 0.15, 0.15, 0.15])
    expect(silent.bass).toBe(0)
    const kick = levelsOf(spectrum((hz) => (hz < 150 ? 255 : 0)), binHz)
    expect(kick.bass).toBeGreaterThan(0.9)
    expect(kick.bands[0]).toBeGreaterThan(0.9)
    expect(kick.bands[4]).toBe(0.15)
  })

  it('jumps on a hit, then lets it go', () => {
    let feel = { bass: 0, kick: 0, average: 0 }
    feel = follow(feel, 0.8)
    expect(feel.bass).toBe(0.8)
    expect(feel.kick).toBe(1)
    for (let i = 0; i < 30; i++) feel = follow(feel, 0)
    expect(feel.bass).toBeLessThan(0.15)
    expect(feel.kick).toBeLessThan(0.02)
  })

  it('a steady drone is bass, not a kick', () => {
    let feel = { bass: 0, kick: 0, average: 0 }
    for (let i = 0; i < 400; i++) feel = follow(feel, 0.6)
    expect(feel.bass).toBeCloseTo(0.6)
    expect(feel.kick).toBeLessThan(0.05)
  })
})
