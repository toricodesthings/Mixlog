import { describe, expect, it } from 'vitest'

import { readFilename, suggestFormat } from '#/components/uploads/suggest'

describe('readFilename', () => {
  it.each([
    ['Blue_Hour_Master_v3.wav', 'Blue Hour', 'master'],
    ['blue hour (mix 2).mp3', 'blue hour', 'mix'],
    ['Night Drive - Instrumental FINAL.wav', 'Night Drive', 'instrumental'],
    ['Night Drive acapella 24bit 48k.wav', 'Night Drive', 'acapella'],
    ['Tides.mp3', 'Tides', 'master'],
    ['final_FINAL_v3 (2).wav', 'final_FINAL_v3 (2)', 'master'],
  ])('%s → %s, %s', (name, title, kind) => {
    expect(readFilename(name)).toEqual({ title, kind })
  })
})

describe('suggestFormat', () => {
  it('counts songs, not files', () => {
    expect(suggestFormat([])).toBe('single')
    expect(suggestFormat(['Tides', 'tides '])).toBe('single')
    expect(suggestFormat(['A', 'B'])).toBe('ep')
    expect(suggestFormat(['1', '2', '3', '4'])).toBe('ep')
    expect(suggestFormat(['1', '2', '3', '4', '5'])).toBe('album')
  })
})
