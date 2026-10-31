import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { sqlite } from '../../support/cloudflare-workers'
import { releaseQuery } from '#/server/releases'
import { releases } from '#/server/schema'

sqlite.exec(`
  INSERT INTO releases (id, title, format) VALUES ('ep', 'Blue Hour EP', 'ep'), ('one', 'Lantern Song', 'single');
  INSERT INTO tracks (id, release_id, position, title) VALUES ('a', 'ep', 1, 'A'), ('b', 'ep', 2, 'B'), ('c', 'one', 1, 'Lantern Song');
  INSERT INTO versions (id, track_id, release_id, kind, number, r2_key, filename, content_type, size, duration_ms) VALUES
    ('a1', 'a', NULL, 'master', 1, 'k1', 'a.mp3', 'audio/mpeg', 1, 60000),
    ('a2', 'a', NULL, 'master', 2, 'k2', 'a.wav', 'audio/wav', 1, 61000),
    ('b1', 'b', NULL, 'master', 1, 'k3', 'b.wav', 'audio/wav', 1, 90000),
    ('c1', 'c', NULL, 'master', 1, 'k4', 'c.wav', 'audio/wav', 1, 150000),
    ('art', NULL, 'ep', 'artwork', 1, 'k5', 'cover.png', 'image/png', 1, NULL);
  INSERT INTO current_pins (version_id, track_id, kind) VALUES ('a1', 'a', 'master');
`)

const row = async (id: string) => (await releaseQuery().where(eq(releases.id, id)))[0]

describe('release rows', () => {
  // Each count, length and cover is a subquery on the outer release: one bound to the wrong table reads other rows.
  it('counts only its own tracks', async () => {
    expect((await row('ep')).track_count).toBe(2)
    expect((await row('one')).track_count).toBe(1)
  })

  it('adds up the current masters: a pin wins over the newest', async () => {
    expect((await row('ep')).duration_ms).toBe(60000 + 90000)
    expect((await row('one')).duration_ms).toBe(150000)
  })

  it('wears only its own artwork', async () => {
    expect((await row('ep')).artwork_id).toBe('art')
    expect((await row('one')).artwork_id).toBeNull()
  })
})
