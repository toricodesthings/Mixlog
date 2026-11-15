import { describe, expect, it } from 'vitest'

import { pickGroups } from '#/components/releases/VersionPicker'
import { partnerOf } from '#/components/releases/stacks'
import type { ReleaseRow, TrackRow, VersionRow } from '#/server/releases'

const v = (id: string, kind: string, number: number, { is_final = 0, is_current = 0, track_id = 't', content_type = 'audio/wav' } = {}) =>
  ({ id, kind, number, is_final, is_current, track_id, content_type }) as VersionRow
const track = (id: string, title: string) => ({ id, title }) as TrackRow
const read = (groups: ReturnType<typeof pickGroups>) => groups.map((g) => [g.section, g.label, g.count, g.items.map((r) => r.version.id).join(' ')])

describe('the version picker', () => {
  const versions = [
    v('mix1', 'mix', 1, { content_type: 'audio/mpeg' }),
    v('m2', 'master', 2),
    v('mix3', 'mix', 3, { content_type: 'audio/mpeg' }),
    v('m4', 'master', 4),
    v('f5', 'master', 5, { is_final: 1 }),
    v('i1', 'instrumental', 1),
    v('i2', 'instrumental', 2, { is_current: 1 }),
    v('s1', 'stems', 1, { content_type: 'application/zip' }),
    v('c1', 'canvas', 1, { content_type: 'video/mp4' }),
  ]

  it('lays a single out in Tracks’ lanes, newest first, counting Masters and Mixes only, with no stems or non-audio', () => {
    const groups = pickGroups({ release: { format: 'single' } as ReleaseRow, tracks: [track('t', 'Midnight Train')], versions })
    expect(read(groups)).toEqual([
      [null, 'Final', undefined, 'f5'],
      [null, 'Masters', 2, 'm4 m2'],
      [null, 'Mixes', 2, 'mix3 mix1'],
      // The current alternate first, then its earlier versions
      [null, 'Alternates', undefined, 'i2 i1'],
    ])
  })

  it('leaves empty lanes out and heads an EP’s lanes with each track’s title', () => {
    const tracks = [track('t', 'Midnight Train'), track('u', 'Night Bus')]
    const groups = pickGroups({ release: { format: 'ep' } as ReleaseRow, tracks, versions: [v('a', 'mix', 1), v('b', 'master', 2, { track_id: 'u' })] })
    expect(read(groups)).toEqual([
      ['Midnight Train', 'Mixes', 1, 'a'],
      ['Night Bus', 'Masters', 1, 'b'],
    ])
  })

  it('marks each track’s newest bounce and the one before it, across mixes and masters, only where there are two', () => {
    const groups = pickGroups({ release: { format: 'single' } as ReleaseRow, tracks: [track('t', 'Midnight Train')], versions })
    const marks = groups.flatMap((g) => g.items.filter((r) => r.mark).map((r) => [r.version.id, r.mark]))
    expect(marks).toEqual([
      ['f5', 'newest'],
      ['m4', 'previous'],
    ])
    const one = pickGroups({ release: { format: 'single' } as ReleaseRow, tracks: [track('t', 'Midnight Train')], versions: [v('a', 'mix', 1)] })
    expect(one[0].items[0].mark).toBeUndefined()
  })
})

describe('what B opens on', () => {
  const versions = [
    v('mix1', 'mix', 1, { content_type: 'audio/mpeg' }),
    v('m2', 'master', 2, { is_final: 1 }),
    v('mix3', 'mix', 3, { content_type: 'audio/mpeg' }),
    v('i1', 'instrumental', 1),
    v('s1', 'stems', 1, { content_type: 'application/zip' }),
  ]
  const of = (id: string, list = versions) => partnerOf(list.find((x) => x.id === id)!, list)?.id ?? null

  it('the bounce before it when it’s the newest, mixes and masters counting as one sequence', () => {
    expect(of('mix3')).toBe('m2')
  })
  it('the newest when something landed since', () => {
    expect(of('m2')).toBe('mix3')
    expect(of('mix1')).toBe('mix3')
  })
  it('the track’s final when its own sequence has nothing else, and nothing when there’s no final either', () => {
    expect(of('i1')).toBe('m2')
    expect(of('a', [v('a', 'mix', 1)])).toBeNull()
  })
})
