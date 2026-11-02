import { describe, expect, it } from 'vitest'

import { paletteOf } from '#/components/scene/palette'

/** An image of `colours`, each covering `share` of its 100 pixels. */
const image = (...colours: [number[], number][]) =>
  new Uint8ClampedArray(colours.flatMap(([rgb, share]) => Array.from({ length: share }, () => [...rgb, 255]).flat()))

const hue = (palette: Record<string, string>, name: string) => Number(palette[name])

describe('paletteOf', () => {
  it('takes the dominant hue for the accent and a second strong one for the sky', () => {
    const palette = paletteOf(image([[30, 70, 220], 70], [[220, 40, 40], 30]))
    expect(hue(palette, '--art-h')).toBeGreaterThan(250)
    expect(hue(palette, '--art-h')).toBeLessThan(275)
    expect(hue(palette, '--art-h2')).toBeLessThan(40)
  })

  it('reads a blue cover with a red stripe as blue, not purple', () => {
    const palette = paletteOf(image([[30, 70, 220], 90], [[220, 40, 40], 10]))
    expect(hue(palette, '--art-h')).toBeGreaterThan(250)
    expect(hue(palette, '--art-h2')).toBeGreaterThan(200)
  })

  it('keeps the title’s hue, faintly, for a grey cover', () => {
    expect(paletteOf(image([[90, 90, 90], 60], [[200, 200, 200], 40]))).toEqual({ '--art-k': '0.3' })
  })

  it('keeps the title’s colours for a cover with no dominant hue', () => {
    const rainbow = Array.from({ length: 24 }, (_, i) => {
      const t = (i / 24) * Math.PI * 2
      return [[128 + 100 * Math.cos(t), 128 + 100 * Math.cos(t - 2.1), 128 + 100 * Math.cos(t + 2.1)].map(Math.round), 4] as [number[], number]
    })
    expect(paletteOf(image(...rainbow))).toEqual({})
  })

  it('ignores transparent pixels', () => {
    const pixels = image([[220, 40, 40], 50], [[30, 70, 220], 50])
    for (let i = 3; i < 200; i += 4) pixels[i] = 0
    expect(hue(paletteOf(pixels), '--art-h')).toBeGreaterThan(250)
  })
})
