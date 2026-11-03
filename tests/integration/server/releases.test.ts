import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { sqlite } from '../../support/cloudflare-workers'
import { call } from '../../support/start'
import { createRelease, fileVersion, getRelease, listReleased, listUpcoming, moveToReleases, releaseQuery, updateRelease } from '#/server/releases'
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

// Managing releases through their server functions, validators included, on their own rows.
const details = (id: string, tracks: { id: string; title: string; isrc?: string }[], more = {}) =>
  ({ id, title: 'Night Drive', format: 'ep', releaseDate: '', upc: '', tracks, released: false, zone: 'UTC', ...more })

describe('starting a release', () => {
  it('starts an EP in Upcoming with its tracks in order', async () => {
    const { id, trackIds } = await call(createRelease, { title: ' Night Drive ', format: 'ep', tracks: ['Intro', 'Night Drive'] })
    expect((await call(listUpcoming)).find((r) => r.id === id)).toMatchObject({ title: 'Night Drive', format: 'ep', track_count: 2, released_at: null })
    expect((await call(getRelease, id)).tracks.map((t) => [t.id, t.title])).toEqual([[trackIds[0], 'Intro'], [trackIds[1], 'Night Drive']])
  })

  it('names a single’s one track after it, whatever was sent', async () => {
    const { id } = await call(createRelease, { title: 'Lantern', format: 'single', tracks: ['a', 'b'] })
    expect((await call(getRelease, id)).tracks.map((t) => t.title)).toEqual(['Lantern'])
  })

  it('adds one already out straight to Releases, on a day that has come', async () => {
    const { id } = await call(createRelease, { title: 'Old Song', format: 'single', tracks: [], releasedOn: '2025-03-01', zone: 'UTC' })
    expect((await call(listReleased)).find((r) => r.id === id)).toMatchObject({ release_date: '2025-03-01' })
    expect((await call(listUpcoming)).some((r) => r.id === id)).toBe(false)
    await expect(call(createRelease, { title: 'Later', format: 'single', tracks: [], releasedOn: '2999-01-01', zone: 'UTC' })).rejects.toThrow(/come/)
    await expect(call(createRelease, { title: '', format: 'ep', tracks: [] })).rejects.toThrow()
  })

  it('finds nothing for an unknown or malformed ID', async () => {
    await expect(call(getRelease, crypto.randomUUID())).rejects.toMatchObject({ isNotFound: true })
    await expect(call(getRelease, '../x')).rejects.toMatchObject({ isNotFound: true })
  })
})

describe('saving Details', () => {
  it('saves the release and its tracks together', async () => {
    const { id, trackIds: [a, b] } = await call(createRelease, { title: 'Draft', format: 'ep', tracks: ['A', 'B'] })
    await call(updateRelease, details(id, [{ id: a, title: 'Intro', isrc: 'us-s1z-26-00001' }, { id: b, title: 'Night Drive' }], { upc: '4006381333931', releaseDate: '2026-12-01' }))
    const saved = await call(getRelease, id)
    expect(saved.release).toMatchObject({ title: 'Night Drive', upc: '4006381333931', release_date: '2026-12-01' })
    expect(saved.tracks.map((t) => [t.title, t.isrc])).toEqual([['Intro', 'USS1Z2600001'], ['Night Drive', null]])
  })

  it('refuses another release’s track, a single of two, and a page that’s out of date', async () => {
    const { id, trackIds: [a, b] } = await call(createRelease, { title: 'Two', format: 'ep', tracks: ['A', 'B'] })
    const other = await call(createRelease, { title: 'Other', format: 'single', tracks: [] })
    await expect(call(updateRelease, details(id, [{ id: other.trackIds[0], title: 'X' }]))).rejects.toThrow(/isn’t on this release/)
    await expect(call(updateRelease, details(id, [{ id: a, title: 'A' }], { format: 'single' }))).rejects.toThrow(/single has one track/)
    await expect(call(updateRelease, details(id, [{ id: b, title: 'B' }], { released: true, releaseDate: '2026-01-01' }))).rejects.toThrow(/moved/)
    expect((await call(getRelease, id)).tracks.map((t) => t.title)).toEqual(['A', 'B'])
  })
})

const { id: lanes, trackIds: [t] } = await call(createRelease, { title: 'Lanes', format: 'single', tracks: [] })
describe('moving a version between lanes', () => {
  const add = (vid: string, kind: string, n: number, type = 'audio/wav') =>
    sqlite.exec(`INSERT INTO versions (id, track_id, kind, number, r2_key, filename, content_type, size) VALUES ('${vid}', '${t}', '${kind}', ${n}, 'k-${vid}', '${vid}', '${type}', 1)`)
  add('x1', 'mix', 1, 'audio/mpeg')
  add('x2', 'mix', 2)
  add('m3', 'master', 3, 'audio/mpeg')
  add('m4', 'master', 4)
  const filed = async () =>
    (await call(getRelease, lanes)).versions.map((v) => `${v.is_final ? 'final' : v.kind} v${v.number}`).sort()
  const move = (versionId: string, to: string) => call(fileVersion, { versionId, to })

  it('moves every way, keeping each number: mix → master → final → master → mix, and final → mix', async () => {
    await move('x2', 'master')
    expect(await filed()).toEqual(['master v2', 'master v3', 'master v4', 'mix v1'])
    await move('x2', 'final')
    expect(await filed()).toEqual(['final v2', 'master v3', 'master v4', 'mix v1'])
    await move('m4', 'final') // the old final drops back into Masters
    expect(await filed()).toEqual(['final v4', 'master v2', 'master v3', 'mix v1'])
    await move('m4', 'master')
    expect(await filed()).toEqual(['master v2', 'master v3', 'master v4', 'mix v1'])
    await move('x2', 'final')
    await move('x2', 'mix')
    expect(await filed()).toEqual(['master v3', 'master v4', 'mix v1', 'mix v2'])
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM current_pins WHERE track_id = ?`).get(t)).toEqual({ n: 0 })
  })

  it('refuses a test as the final, and finds nothing for an unknown version or lane', async () => {
    await expect(move('x1', 'final')).rejects.toThrow(/test can’t be the final/)
    await expect(move('m3', 'final')).rejects.toThrow(/test can’t be the final/)
    await expect(move(crypto.randomUUID(), 'final')).rejects.toMatchObject({ isNotFound: true })
    await expect(move('x1', 'stems')).rejects.toThrow(/lane/)
  })

  it('in Releases, only gives a track without a final its final, which ships it and sets the rest aside', async () => {
    await move('m4', 'final')
    await call(moveToReleases, { id: lanes, releasedOn: '2026-10-01', zone: 'UTC' })
    expect(await filed()).toEqual(['final v4'])
    await expect(move('m4', 'master')).rejects.toThrow(/one file per slot/)
    // A track left without one (1.0.0 data): its final ships the track.
    sqlite.exec(`DELETE FROM current_pins WHERE track_id = '${t}'; UPDATE versions SET pruned_at = NULL, released_at = NULL WHERE id = 'x2'`)
    await expect(move('x2', 'mix')).rejects.toThrow(/one file per slot/)
    await move('x2', 'final')
    expect(await filed()).toEqual(['final v2', 'master v4'])
    await expect(move('m4', 'final')).rejects.toThrow(/has its final/)
    expect(sqlite.prepare(`SELECT released_at IS NOT NULL AS stamped FROM versions WHERE id = 'x2'`).get()).toEqual({ stamped: 1 })
  })
})
