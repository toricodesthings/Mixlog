import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { sqlite } from '../../support/cloudflare-workers'
import { call } from '../../support/start'
import { createRelease, getRelease, listReleased, listUpcoming, makeCurrent, moveToReleases, releaseQuery, updateRelease } from '#/server/releases'
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

const { id: pins, trackIds: [t] } = await call(createRelease, { title: 'Pins', format: 'single', tracks: [] })
describe('Make current', () => {
  const id = pins
  const add = (vid: string, n: number) =>
    sqlite.exec(`INSERT INTO versions (id, track_id, kind, number, r2_key, filename, content_type, size) VALUES ('${vid}', '${t}', 'master', ${n}, 'k-${vid}', '${vid}.wav', 'audio/wav', 1)`)
  const current = async () => (await call(getRelease, id)).versions.filter((v) => v.is_current).map((v) => v.id)
  add('p1', 1)
  add('p2', 2)

  it('pins an older version, and it stays current when a newer one lands on top', async () => {
    expect(await current()).toEqual(['p2'])
    await call(makeCurrent, { versionId: 'p1' })
    add('p3', 3)
    expect(await current()).toEqual(['p1'])
    await call(makeCurrent, { versionId: 'p3' })
    expect(await current()).toEqual(['p3'])
  })

  it('never moves what shipped, and finds nothing for an unknown version', async () => {
    await call(moveToReleases, { id, releasedOn: '2026-10-01', zone: 'UTC' })
    await expect(call(makeCurrent, { versionId: 'p3' })).rejects.toThrow(/what shipped stays/)
    await expect(call(makeCurrent, { versionId: crypto.randomUUID() })).rejects.toMatchObject({ isNotFound: true })
    await expect(call(moveToReleases, { id, releasedOn: '2999-01-01', zone: 'UTC' })).rejects.toThrow(/come/)
  })
})
