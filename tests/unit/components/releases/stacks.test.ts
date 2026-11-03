import { expect, it } from 'vitest'

import { licensesOf, stacksOf } from '#/components/releases/stacks'
import type { TrackRow, VersionRow } from '#/server/releases'

const track = { id: 't' } as TrackRow
const v = (id: string, kind: string, number: number, is_current = 0, track_id = 't') => ({ id, kind, number, is_current, track_id }) as VersionRow

it('reads a track’s stacks in shipping order, newest first, with the pin as current', () => {
  const rows = [v('x1', 'mix', 1), v('m1', 'master', 1, 1), v('m2', 'master', 2), v('l1', 'license', 1), v('o1', 'master', 9, 0, 'other')]
  expect(stacksOf(track, rows).map((s) => [s.kind, s.versions.map((r) => r.id), s.current.id])).toEqual([
    ['master', ['m2', 'm1'], 'm1'],
    ['mix', ['x1'], 'x1'], // no pin: the newest
  ])
  expect(licensesOf('t', [...rows, v('l2', 'license', 2)]).map((r) => r.id)).toEqual(['l2', 'l1'])
})
