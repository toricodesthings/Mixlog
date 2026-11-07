import { describe, expect, it } from 'vitest'

import { paletteOf } from '#/components/scene/palette'

/** An image of `colours`, each covering `share` of its 100 pixels. */
const image = (...colours: [number[], number][]) =>
  new Uint8ClampedArray(colours.flatMap(([rgb, share]) => Array.from({ length: share }, () => [...rgb, 255]).flat()))

const num = (palette: Record<string, string>, name: string) => Number(palette[name])

describe('paletteOf', () => {
  it('takes the dominant hue for the accent and a second strong one for the sky', () => {
    const palette = paletteOf(image([[30, 70, 220], 70], [[220, 40, 40], 30]))
    expect(num(palette, '--art-h')).toBeGreaterThan(250)
    expect(num(palette, '--art-h')).toBeLessThan(275)
    expect(num(palette, '--art-h2')).toBeLessThan(40)
  })

  it('gives a two-tone cover a mixed night: its second hue lights the lamps and deepens the hills', () => {
    const palette = paletteOf(image([[200, 40, 40], 55], [[40, 170, 60], 45]))
    expect(num(palette, '--art-h')).toBeLessThan(40)
    expect(num(palette, '--art-mix')).toBeGreaterThanOrEqual(0.5)
    expect(num(palette, '--art-light-h')).toBeGreaterThan(120)
    expect(num(palette, '--art-light-h')).toBeLessThan(160)
  })

  it('keeps a cover with one colour and a faint second unmixed, its lights in the first', () => {
    const faint = paletteOf(image([[30, 70, 220], 92], [[220, 40, 40], 8]))
    expect(faint['--art-light-h']).toBeUndefined()
    expect(paletteOf(image([[200, 30, 30], 100]))['--art-mix']).toBeUndefined()
  })

  /** How far apart two hues are, the short way round. */
  const arc = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

  it('gives a three-tone cover’s sky the tone nearest the accent and its lamps the farthest', () => {
    const palette = paletteOf(image([[210, 40, 40], 45], [[220, 130, 30], 30], [[40, 80, 220], 25]))
    const h = num(palette, '--art-h')
    expect(arc(h, 29)).toBeLessThan(20)
    expect(arc(num(palette, '--art-h2'), h)).toBeLessThan(arc(num(palette, '--art-light-h'), h))
    expect(arc(num(palette, '--art-light-h'), 265)).toBeLessThan(25)
  })

  it('reads five even swatches as five tones, not a rainbow: every role filled, the hills drifting from the accent', () => {
    const swatches: [number[], number][] = [[[210, 40, 40], 20], [[220, 200, 40], 20], [[40, 170, 60], 20], [[40, 80, 220], 20], [[200, 50, 200], 20]]
    const palette = paletteOf(image(...swatches))
    const h = num(palette, '--art-h')
    for (const name of ['--art-h2', '--art-h3', '--art-light-h', '--art-beacon-h']) expect(palette[name]).toBeDefined()
    const reach = ['--art-h2', '--art-h3', '--art-beacon-h', '--art-light-h'].map((name) => arc(num(palette, name), h))
    expect(reach).toEqual([...reach].sort((a, b) => a - b))
  })

  it('reads a blue cover with a red stripe as blue, not purple', () => {
    const palette = paletteOf(image([[30, 70, 220], 90], [[220, 40, 40], 10]))
    expect(num(palette, '--art-h')).toBeGreaterThan(250)
    expect(num(palette, '--art-h2')).toBeGreaterThan(200)
  })

  it('a pure grey image gives k ≤ 0.05 and no borrowed hue', () => {
    const palette = paletteOf(image([[128, 128, 128], 100]))
    expect(num(palette, '--art-k')).toBeLessThanOrEqual(0.05)
  })

  it('a grey image with 0.3% red gives no spot', () => {
    const palette = paletteOf(image([[128, 128, 128], 997], [[220, 30, 30], 3]))
    expect(palette['--art-spot-h']).toBeUndefined()
  })

  it('a grey image with 2% saturated red gives a spot near red', () => {
    const palette = paletteOf(image([[128, 128, 128], 980], [[220, 30, 30], 20]))
    expect(num(palette, '--art-spot-h')).toBeGreaterThan(-30)
    expect(num(palette, '--art-spot-h')).toBeLessThan(40)
    expect(num(palette, '--art-spot-k')).toBe(0.75)
  })

  it('a sepia cast gives a moderate k at a warm hue', () => {
    const palette = paletteOf(image([[112, 92, 60], 70], [[150, 128, 90], 30]))
    expect(num(palette, '--art-k')).toBeGreaterThan(0.1)
    expect(num(palette, '--art-h')).toBeGreaterThan(40)
    expect(num(palette, '--art-h')).toBeLessThan(100)
  })

  it('a little colour on an otherwise grey cover scales k down by coverage', () => {
    const little = paletteOf(image([[128, 128, 128], 90], [[30, 70, 220], 10]))
    const plenty = paletteOf(image([[128, 128, 128], 40], [[30, 70, 220], 60]))
    expect(num(little, '--art-k')).toBeLessThan(num(plenty, '--art-k'))
  })

  it('keeps nothing (the id’s hue stands in, at full colour) for a cover with no dominant hue', () => {
    const rainbow = Array.from({ length: 24 }, (_, i) => {
      const t = (i / 24) * Math.PI * 2
      return [[128 + 100 * Math.cos(t), 128 + 100 * Math.cos(t - 2.1), 128 + 100 * Math.cos(t + 2.1)].map(Math.round), 4] as [number[], number]
    })
    expect(paletteOf(image(...rainbow))).toEqual({})
  })

  it('ignores transparent pixels', () => {
    const pixels = image([[220, 40, 40], 50], [[30, 70, 220], 50])
    for (let i = 3; i < 200; i += 4) pixels[i] = 0
    expect(num(paletteOf(pixels), '--art-h')).toBeGreaterThan(250)
  })
})
