import { describe, expect, it } from 'vitest'

import { deletedKeys, sqlite } from '../../support/cloudflare-workers'
import { shipRelease, unshipRelease } from '#/server/releases'
import { erasePruned } from '#/server/versions'

// An EP of two tracks. A: masters v1 MP3, v2 WAV (the final), v3 MP3 (newest test); a mix; two instrumentals; a license.
// B: one WAV master (its final) and a Canvas. The release's artwork. And a single whose only master is an MP3.
sqlite.exec(`
  INSERT INTO releases (id, title, format) VALUES ('ep', 'Blue Hour', 'ep'), ('one', 'Test Only', 'single');
  INSERT INTO tracks (id, release_id, position, title) VALUES ('a', 'ep', 1, 'A'), ('b', 'ep', 2, 'B'), ('t', 'one', 1, 'Test Only');
  INSERT INTO versions (id, track_id, release_id, kind, number, r2_key, filename, content_type, size) VALUES
    ('m1', 'a', NULL, 'master', 1, 'k-m1', 'a.mp3', 'audio/mpeg', 1),
    ('m2', 'a', NULL, 'master', 2, 'k-m2', 'a.wav', 'audio/wav', 1),
    ('m3', 'a', NULL, 'master', 3, 'k-m3', 'a2.mp3', 'audio/mpeg', 1),
    ('x1', 'a', NULL, 'mix', 4, 'k-x1', 'a mix.mp3', 'audio/mpeg', 1),
    ('i1', 'a', NULL, 'instrumental', 1, 'k-i1', 'a inst.mp3', 'audio/mpeg', 1),
    ('i2', 'a', NULL, 'instrumental', 2, 'k-i2', 'a inst.wav', 'audio/wav', 1),
    ('l1', 'a', NULL, 'license', 1, 'k-l1', 'license.pdf', 'application/pdf', 1),
    ('bm', 'b', NULL, 'master', 1, 'k-bm', 'b.wav', 'audio/wav', 1),
    ('c1', 'b', NULL, 'canvas', 1, 'k-c1', 'b.mp4', 'video/mp4', 1),
    ('art', NULL, 'ep', 'artwork', 1, 'k-art', 'cover.png', 'image/png', 1),
    ('t1', 't', NULL, 'master', 1, 'k-t1', 't.mp3', 'audio/mpeg', 1);
  INSERT INTO current_pins (version_id, track_id, kind) VALUES ('m2', 'a', 'master'), ('bm', 'b', 'master');
`)

const column = (column: 'pruned_at' | 'released_at') =>
  (sqlite.prepare(`SELECT id FROM versions WHERE ${column} IS NOT NULL ORDER BY id`).all() as { id: string }[]).map((r) => r.id)
const pins = () => sqlite.prepare("SELECT version_id, kind FROM current_pins WHERE track_id IN ('a', 'b') ORDER BY version_id").all()

describe('moving a release to Releases', () => {
  it('waits for a final on every track', async () => {
    await expect(shipRelease('one', '2026-10-01')).rejects.toThrow(/needs its final/)
    expect(sqlite.prepare("SELECT released_at FROM releases WHERE id = 'one'").get()).toEqual({ released_at: null })
  })

  it('ships each stack’s current version, pins it, and prunes the rest; licenses and artwork stay', async () => {
    await shipRelease('ep', '2026-10-01')
    expect(sqlite.prepare("SELECT release_date FROM releases WHERE id = 'ep' AND released_at IS NOT NULL").get()).toEqual({ release_date: '2026-10-01' })
    expect(column('pruned_at')).toEqual(['i1', 'm1', 'm3', 'x1'])
    expect(column('released_at')).toEqual(['bm', 'c1', 'i2', 'm2'])
    expect(pins()).toEqual([
      { version_id: 'bm', kind: 'master' },
      { version_id: 'c1', kind: 'canvas' },
      { version_id: 'i2', kind: 'instrumental' },
      { version_id: 'm2', kind: 'master' },
    ])
  })

  it('moves back inside the grace window with everything restored, and not after it', async () => {
    await expect(unshipRelease('ep', Date.now() + 15 * 86_400_000)).rejects.toThrow(/erased/)
    await unshipRelease('ep')
    expect(column('pruned_at')).toEqual([])
    expect(column('released_at')).toEqual([])
    expect(sqlite.prepare("SELECT released_at FROM releases WHERE id = 'ep'").get()).toEqual({ released_at: null })
  })

  it('erases only what was pruned more than two weeks ago: files first, then rows', async () => {
    await shipRelease('ep', '2026-10-01')
    sqlite.exec("UPDATE versions SET pruned_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 days') WHERE id IN ('m1', 'x1')")
    expect(await erasePruned()).toBe(2)
    expect(deletedKeys.sort()).toEqual(['k-m1', 'k-x1'])
    expect(sqlite.prepare("SELECT id FROM versions WHERE id IN ('m1', 'x1')").all()).toEqual([])
    expect(column('pruned_at')).toEqual(['i1', 'm3'])
  })
})

describe('Settings → Releases', () => {
  sqlite.exec(`
    INSERT INTO releases (id, title, format) VALUES ('keep', 'Kept', 'single');
    INSERT INTO tracks (id, release_id, position, title) VALUES ('k', 'keep', 1, 'Kept');
    INSERT INTO versions (id, track_id, release_id, kind, number, r2_key, filename, content_type, size) VALUES
      ('k1', 'k', NULL, 'master', 1, 'k-k1', 'k.mp3', 'audio/mpeg', 1),
      ('k2', 'k', NULL, 'master', 2, 'k-k2', 'k.wav', 'audio/wav', 1),
      ('kx', 'k', NULL, 'mix', 3, 'k-kx', 'k mix.mp3', 'audio/mpeg', 1);
    INSERT INTO current_pins (version_id, track_id, kind) VALUES ('k2', 'k', 'master');
  `)
  const keep = (value: string) => sqlite.exec(`INSERT OR REPLACE INTO settings (key, value) VALUES ('keep_after_release', '${value}')`)
  const prunedOn = (track: string) => (sqlite.prepare(`SELECT id FROM versions WHERE track_id = ? AND pruned_at IS NOT NULL ORDER BY id`).all(track) as { id: string }[]).map((r) => r.id)

  it('keeping everything still sets aside what didn’t ship, erases none of it, and can always move back', async () => {
    keep('forever')
    await shipRelease('keep', '2026-10-01')
    expect(prunedOn('k')).toEqual(['k1', 'kx'])
    expect(await erasePruned()).toBe(0)
    await unshipRelease('keep', Date.now() + 400 * 86_400_000)
    expect(sqlite.prepare("SELECT released_at FROM releases WHERE id = 'keep'").get()).toEqual({ released_at: null })
  })

  it('a week erases what was pruned more than a week ago, and closes moving back with it', async () => {
    keep('7')
    await shipRelease('keep', '2026-10-01')
    expect(prunedOn('k')).toEqual(['k1', 'kx'])
    await expect(unshipRelease('keep', Date.now() + 8 * 86_400_000)).rejects.toThrow(/erased/)
    sqlite.exec("UPDATE versions SET pruned_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-8 days') WHERE track_id = 'k' AND pruned_at IS NOT NULL")
    expect(await erasePruned()).toBe(2)
    expect(prunedOn('k')).toEqual([])
  })
})
