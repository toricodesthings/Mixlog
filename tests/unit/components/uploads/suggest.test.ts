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

describe('suggestFinals', () => {
  it('suggests each song’s newest lossless master as its final, and nothing else', async () => {
    const { suggestFinals } = await import('#/components/uploads/suggest')
    const f = (song: number, kind: 'master' | 'mix', lossless: boolean, modified: number) => ({ song, kind, lossless, modified })
    expect([...suggestFinals([f(0, 'master', true, 1), f(0, 'master', true, 3), f(0, 'mix', true, 9), f(0, 'master', false, 5), f(1, 'master', false, 1)])]).toEqual([1])
  })
})
