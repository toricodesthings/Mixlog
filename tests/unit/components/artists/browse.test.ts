import { describe, expect, it } from 'vitest'

import { artistSearch, matchArtists } from '#/components/artists/browse'

const roster = [
  { name: 'Zoë Lark', role: 'Producer' },
  { name: 'ana nova', role: null },
  { name: 'Kai', role: 'Artist' },
]

describe('matchArtists', () => {
  it('lists everyone A to Z when the query is empty', () => {
    expect(matchArtists(roster, '  ').map((a) => a.name)).toEqual(['ana nova', 'Kai', 'Zoë Lark'])
  })
  it('matches every word against name and role, accents and case ignored', () => {
    expect(matchArtists(roster, 'zoe producer').map((a) => a.name)).toEqual(['Zoë Lark'])
    expect(matchArtists(roster, 'NOVA')).toHaveLength(1)
    expect(matchArtists(roster, 'nova producer')).toHaveLength(0)
  })
})

describe('artistSearch', () => {
  it('keeps what it reads and drops defaults and junk', () => {
    expect(artistSearch({ q: 'kai', view: 'list' })).toEqual({ q: 'kai', view: 'list' })
    expect(artistSearch({ q: '', view: 'cards', other: 1 })).toEqual({})
  })
})
