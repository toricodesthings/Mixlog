import { describe, expect, it } from 'vitest'

import { browse, listSearch, formatLength, releaseDay, releaseFacts, sortOf } from '#/components/releases/browse'

const Z = 'America/Toronto'
import type { ReleaseRow } from '#/server/releases'

const release = (over: Partial<ReleaseRow>): ReleaseRow => ({
  id: 'x',
  title: 'X',
  format: 'single',
  release_date: null,
  released_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  track_count: 1,
  duration_ms: null,
  artwork_id: null,
  upc: null,
  ...over,
})

const rows = [
  release({ id: 'a', title: 'Blue Hour EP', format: 'ep', created_at: '2026-03-01T00:00:00Z', released_at: '2026-06-01T00:00:00Z' }),
  release({ id: 'b', title: 'untitled sketch 7', created_at: '2026-05-01T00:00:00Z', release_date: '2026-12-01' }),
  release({ id: 'c', title: 'Afterglow', format: 'album', created_at: '2026-01-01T00:00:00Z', released_at: '2026-11-02T03:00:00Z', release_date: '2026-11-01' }),
]
const ids = (r: ReleaseRow[]) => r.map((x) => x.id)

describe('browse', () => {
  it('searches titles by every word, in any order and case', () => {
    expect(ids(browse('upcoming', rows, { query: 'HOUR blue', format: 'all', sort: 'newest', zone: Z }))).toEqual(['a'])
    expect(ids(browse('upcoming', rows, { query: '  ', format: 'all', sort: 'newest', zone: Z }))).toHaveLength(3)
  })

  it('filters by format', () => {
    expect(ids(browse('upcoming', rows, { query: '', format: 'single', sort: 'newest', zone: Z }))).toEqual(['b'])
  })

  it('orders Upcoming by the day it was started and Releases by the day it went out', () => {
    expect(ids(browse('upcoming', rows, { query: '', format: 'all', sort: 'newest', zone: Z }))).toEqual(['b', 'a', 'c'])
    const out = rows.filter((r) => r.released_at)
    expect(ids(browse('released', out, { query: '', format: 'all', sort: 'newest', zone: Z }))).toEqual(['c', 'a'])
    expect(ids(browse('released', out, { query: '', format: 'all', sort: 'oldest', zone: Z }))).toEqual(['a', 'c'])
  })

  it('puts planned dates first, soonest on top, then the undated', () => {
    expect(ids(browse('upcoming', rows, { query: '', format: 'all', sort: 'planned', zone: Z }))).toEqual(['c', 'b', 'a'])
  })

  it('sorts titles ignoring case', () => {
    expect(ids(browse('upcoming', rows, { query: '', format: 'all', sort: 'title', zone: Z }))).toEqual(['c', 'a', 'b'])
  })

  it('never reorders what it was given', () => {
    browse('upcoming', rows, { query: '', format: 'all', sort: 'title', zone: Z })
    expect(ids(rows)).toEqual(['a', 'b', 'c'])
  })
})

describe('sortOf', () => {
  it('falls back to newest for an order this section does not offer', () => {
    expect(sortOf('released', 'planned')).toBe('newest')
    expect(sortOf('upcoming', 'planned')).toBe('planned')
    expect(sortOf('upcoming', null)).toBe('newest')
  })
})

describe('formatting', () => {
  it('shows lengths as a player does', () => {
    expect(formatLength(221_000)).toBe('3:41')
    expect(formatLength(3_729_000)).toBe('1:02:09')
  })

  it('dates Upcoming by the day it was started in the artist’s zone, Releases by its release day', () => {
    const late = release({ created_at: '2026-08-01T02:00:00Z', released_at: '2026-08-01T02:00:00Z' })
    expect(releaseDay('upcoming', late, 'America/Toronto')).toBe('2026-07-31')
    expect(releaseDay('upcoming', late, 'Europe/Paris')).toBe('2026-08-01')
    expect(releaseDay('released', { ...late, release_date: '2026-08-01' }, 'Pacific/Pago_Pago')).toBe('2026-08-01')
    expect(releaseDay('released', late, 'America/Toronto')).toBe('2026-07-31')
  })

  it('lists a release’s facts, skipping what is not known', () => {
    expect(releaseFacts(release({ format: 'ep', track_count: 4, duration_ms: 872_000 }), 'EP')).toEqual(['EP', '4 tracks', '14:32'])
    expect(releaseFacts(release({}), 'Single')).toEqual(['Single'])
  })

  it('reads the list’s URL, dropping defaults and anything unreadable', () => {
    expect(listSearch({ q: 'night', sort: 'title', view: 'panels', upload: true, format: 'ep' })).toEqual({ q: 'night', sort: 'title', view: 'panels', upload: true, format: 'ep' })
    expect(listSearch({ q: '', sort: 'newest', view: 'list', format: 'mixtape', settings: 'appearance' })).toEqual({})
  })
})
