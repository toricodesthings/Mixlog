import { describe, expect, it } from 'vitest'

import { licensesOf, stationsOf, versionLabel } from '#/components/releases/stacks'
import type { ReleaseRow, TrackRow, VersionRow } from '#/server/releases'

const v = (id: string, kind: string, number: number, is_final = 0, track_id = 't') => ({ id, kind, number, is_final, track_id }) as VersionRow

it('lists a track’s licenses newest first', () => {
  expect(licensesOf('t', [v('l1', 'license', 1), v('l2', 'license', 2), v('x', 'license', 3, 0, 'other')]).map((r) => r.id)).toEqual(['l2', 'l1'])
})

it('names a version with its number in Upcoming, and without one in Releases', () => {
  expect([versionLabel(v('f', 'master', 4, 1), 'upcoming'), versionLabel(v('m', 'master', 3), 'upcoming'), versionLabel(v('i', 'instrumental', 1), 'released')]).toEqual([
    'Final v4',
    'Master v3',
    'Instrumental',
  ])
})

describe('the signal path', () => {
  const release = (more = {}) => ({ format: 'ep', artwork_id: null, release_date: null, upc: null, ...more }) as ReleaseRow
  const tracks = [{ id: 't', isrc: null }, { id: 'u', isrc: null }] as TrackRow[]
  const rows = [v('x', 'mix', 1), v('m', 'master', 2), v('f', 'master', 3, 1), v('y', 'mix', 1, 0, 'u')].map((r) => ({ ...r, filename: `${r.id}.wav` }))
  const read = (stations: ReturnType<typeof stationsOf>) => stations.map((s) => `${s.label}: ${s.fact}${s.lit ? ' ●' : ''}`)

  it('runs Mixes → Masters → Final → Artwork → Details in Upcoming', () => {
    expect(read(stationsOf('upcoming', release(), tracks, rows))).toEqual(['Mixes: 2 mixes ●', 'Masters: 1 of 2', 'Final: 1 of 2', 'Artwork: No artwork yet', 'Details: No date yet'])
  })

  it('runs Final → Artwork → Details in Releases, and a single’s Final names its file, numbered only in Upcoming', () => {
    expect(read(stationsOf('released', release({ artwork_id: 'a' }), tracks.slice(0, 1), rows))).toEqual(['Final: 1 of 1 ●', 'Artwork: Cover set ●', 'Details: Codes to add'])
    expect(read(stationsOf('upcoming', release({ format: 'single' }), tracks.slice(0, 1), rows))[2]).toBe('Final: v3 · WAV ●')
    expect(read(stationsOf('released', release({ format: 'single' }), tracks.slice(0, 1), rows))[0]).toBe('Final: WAV ●')
    expect(read(stationsOf('upcoming', release({ format: 'single' }), tracks.slice(1), rows))[2]).toBe('Final: Not yet')
  })
})
