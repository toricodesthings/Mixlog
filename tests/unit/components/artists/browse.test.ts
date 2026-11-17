import { describe, expect, it } from 'vitest'

import { artistSearch, matchArtists } from '#/components/artists/browse'

const roster = [
  { name: 'Zoë Lark', role: 'Producer', track_count: 2 },
  { name: 'ana nova', role: null, track_count: 5 },
  { name: 'Kai', role: 'Artist', track_count: 2 },
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
  it('orders by most tracks or by role (no role last), ties A to Z', () => {
    expect(matchArtists(roster, '', 'tracks').map((a) => a.name)).toEqual(['ana nova', 'Kai', 'Zoë Lark'])
    expect(matchArtists(roster, '', 'role').map((a) => a.name)).toEqual(['Kai', 'Zoë Lark', 'ana nova'])
  })
})

describe('artistSearch', () => {
  it('keeps what it reads and drops defaults and junk', () => {
    expect(artistSearch({ q: 'kai', sort: 'tracks', view: 'list' })).toEqual({ q: 'kai', sort: 'tracks', view: 'list' })
    expect(artistSearch({ q: '', sort: 'name', view: 'cards', other: 1 })).toEqual({})
  })
})
