import { describe, expect, it } from 'vitest'

import { sqlite } from '../../support/cloudflare-workers'
import { call } from '../../support/start'
import { createRelease, moveToUpcoming, shipRelease, unshipRelease } from '#/server/releases'
import { getSettings, saveKeepDays } from '#/server/settings'
import { erasePruned } from '#/server/versions'

// How long what didn't ship is kept, from Settings through Move to Releases, Move back and the cleanup cron.
async function releaseWithTwoMasters() {
  const { id, trackIds: [t] } = await call(createRelease, { title: crypto.randomUUID(), format: 'single', tracks: [] })
  sqlite.exec(`INSERT INTO versions (id, track_id, kind, number, r2_key, filename, content_type, size) VALUES
    ('${t}-1', '${t}', 'master', 1, 'k-${t}-1', 'a.mp3', 'audio/mpeg', 1), ('${t}-2', '${t}', 'master', 2, 'k-${t}-2', 'a.wav', 'audio/wav', 1)`)
  return { id, old: `${t}-1` }
}
const pruned = (id: string) => sqlite.prepare('SELECT pruned_at FROM versions WHERE id = ?').get(id) as { pruned_at: string | null } | undefined
const age = (id: string, days: number) => sqlite.exec(`UPDATE versions SET pruned_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${days} days') WHERE id = '${id}'`)
const DAY = 86_400_000

describe('keep after release', () => {
  it('is two weeks until chosen, and takes only the offered choices', async () => {
    expect(await call(getSettings)).toEqual({ keepDays: 14 })
    await expect(call(saveKeepDays, 3)).rejects.toThrow(/a week, two weeks, a month, or always/)
    await call(saveKeepDays, 30)
    expect(await call(getSettings)).toEqual({ keepDays: 30 })
  })

  it('a week: pruned versions are erased after it, and the release can’t move back', async () => {
    await call(saveKeepDays, 7)
    const { id, old } = await releaseWithTwoMasters()
    await shipRelease(id, '2026-10-01')
    age(old, 6)
    expect(await erasePruned()).toBe(0)
    age(old, 8)
    expect(await erasePruned()).toBe(1)
    expect(pruned(old)).toBeUndefined()
    await expect(unshipRelease(id, Date.now() + 8 * DAY)).rejects.toThrow(/erased/)
  })

  it('always: nothing is pruned or erased, and it can move back any time', async () => {
    await call(saveKeepDays, null)
    const { id, old } = await releaseWithTwoMasters()
    await shipRelease(id, '2026-10-01')
    expect(pruned(old)).toEqual({ pruned_at: null })
    expect(await erasePruned()).toBe(0)
    await unshipRelease(id, Date.now() + 365 * DAY)
    await expect(call(moveToUpcoming, id)).rejects.toThrow(/already in Upcoming/)
  })
})
