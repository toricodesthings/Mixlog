import { describe, expect, it } from 'vitest'

import { moveBackWindow, prunedOf, shippedOf } from '#/server/shipping'

const v = (id: string, kind: string, number: number, content_type: string, is_current = 0, track_id: string | null = 't', is_final = 0) =>
  ({ id, track_id, kind, number, content_type, is_current, is_final })

describe('what ships', () => {
  const rows = [
    v('m1', 'master', 1, 'audio/wav', 0, 't', 1),
    v('m2', 'master', 2, 'audio/mpeg', 1),
    v('x1', 'mix', 3, 'audio/mpeg', 1),
    v('i1', 'instrumental', 1, 'audio/wav', 1),
    v('l1', 'license', 1, 'application/pdf', 1),
    v('art', 'artwork', 1, 'image/png', 1, null),
  ]

  it('ships the final, not the newest master, and each current alternate; sets the rest aside but licenses and the release’s own', () => {
    expect(shippedOf(rows)).toEqual(['m1', 'i1'])
    expect(prunedOf(rows)).toEqual(['m2', 'x1'])
  })
})

describe('moveBackWindow', () => {
  const out = Date.parse('2026-10-01T12:00:00.000Z')
  it('stays open until the keep window has passed, and always when everything is kept', () => {
    expect(moveBackWindow('2026-10-01T12:00:00.000Z', 7, out + 7 * 86_400_000 - 1)).toEqual({ until: '2026-10-08T12:00:00.000Z' })
    expect(moveBackWindow('2026-10-01T12:00:00.000Z', 7, out + 7 * 86_400_000)).toBeNull()
    expect(moveBackWindow(out, null, out + 1e12)).toEqual({ until: null })
  })
})
