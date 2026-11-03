import { describe, expect, it } from 'vitest'

import { finalMasterOf, mastersOf, moveBackWindow, prunedOf, shippedOf } from '#/server/shipping'

const v = (id: string, kind: string, number: number, content_type: string, is_current = 0, track_id: string | null = 't') => ({ id, track_id, kind, number, content_type, is_current })

describe('what ships', () => {
  const rows = [
    v('m1', 'master', 1, 'audio/wav'),
    v('m2', 'master', 2, 'audio/mpeg', 1),
    v('x1', 'mix', 1, 'audio/mpeg', 1),
    v('i1', 'instrumental', 1, 'audio/wav', 1),
    v('l1', 'license', 1, 'application/pdf', 1),
    v('art', 'artwork', 1, 'image/png', 1, null),
  ]

  it('needs the current master to be lossless: a WAV underneath isn’t the final', () => {
    expect(finalMasterOf('t', rows)).toBeNull()
    expect(finalMasterOf('t', rows.map((r) => (r.id === 'm1' ? { ...r, is_current: 1 } : r.id === 'm2' ? { ...r, is_current: 0 } : r)))?.id).toBe('m1')
    expect(mastersOf('t', rows).map((r) => r.id)).toEqual(['m2', 'm1'])
  })

  it('ships each current stack but the mix; prunes the rest; keeps licenses and the release’s own', () => {
    expect(shippedOf(rows)).toEqual(['m2', 'i1'])
    expect(prunedOf(rows)).toEqual(['m1', 'x1'])
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
