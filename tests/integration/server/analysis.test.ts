import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'

import { reading } from '../../support/analysis'
import '../../support/browser'
import { call } from '../../support/start'
import { uploadAudio } from '#/lib/files'
import { db } from '#/server/db'
import { arpeggio } from '#/server/dev'
import { measureMissing } from '#/server/meter'
import { createRelease, fileVersion, getRelease, moveToReleases, moveToUpcoming, saveAnalysis, stampScenes, updateRelease } from '#/server/releases'
import { tracks, versions } from '#/server/schema'

const { id: releaseId, trackIds: [song] } = await call(createRelease, { title: 'Meters', format: 'single', tracks: [] })
// What the device's meter reads (a Web Worker, which Node hasn't got).
const device = vi.hoisted(() => ({ reading: undefined as unknown }))
vi.mock('#/lib/meter', () => ({ measure: async () => device.reading ?? null }))
const send = (analysis: unknown) => {
  device.reading = analysis
  return uploadAudio({ trackId: song, kind: 'master', file: new File(['bounce'], 'meters.mp3'), contentType: 'audio/mpeg', durationMs: null }, () => {})
}
const analysisOf = async (id: string) => (await call(getRelease, releaseId)).versions.find((v) => v.id === id)?.analysis

describe('a bounce’s analysis', () => {
  it('lands with the version', async () => {
    const { id } = await send(reading())
    expect(await analysisOf(id)).toEqual(reading())
  })

  it('sets the length the meter decoded', async () => {
    const { id } = await send(reading({ ms: 123_456 }))
    expect((await call(getRelease, releaseId)).versions.find((v) => v.id === id)?.duration_ms).toBe(123_456)
  })

  it('is dropped when it isn’t one, and the bounce still lands', async () => {
    const { id } = await send({ meter: 1, lufs: 'loud' })
    expect(await analysisOf(id)).toBeNull()
  })

  it('is filled later once, and replaced only by a newer meter', async () => {
    const { id } = await send(undefined)
    await call(saveAnalysis, { versionId: id, analysis: reading({ lufs: -10 }) })
    expect(await analysisOf(id)).toMatchObject({ lufs: -10 })
    await call(saveAnalysis, { versionId: id, analysis: reading({ lufs: -11 }) })
    expect(await analysisOf(id)).toMatchObject({ lufs: -10 })
    await call(saveAnalysis, { versionId: id, analysis: reading({ meter: 2, lufs: -12 }) })
    expect(await analysisOf(id)).toMatchObject({ meter: 2, lufs: -12 })
  })

  it('is never written to a pruned version', async () => {
    const { id } = await send(undefined)
    await db.update(versions).set({ prunedAt: '2026-01-01T00:00:00.000Z' }).where(eq(versions.id, id))
    await call(saveAnalysis, { versionId: id, analysis: reading() })
    const [row] = await db.select({ analysis: versions.analysis }).from(versions).where(eq(versions.id, id))
    expect(row.analysis).toBeNull()
  })
})

describe('a song’s night (1.3.0)', () => {
  it('stamps the track and the release from the first measured mix or master, once', async () => {
    const { id: relId, trackIds: [trackId] } = await call(createRelease, { title: 'Night', format: 'single', tracks: [] })
    device.reading = undefined
    const v1 = await uploadAudio({ trackId, kind: 'mix', file: new File(['x'], 'v1.mp3'), contentType: 'audio/mpeg', durationMs: null }, () => {})
    await call(saveAnalysis, { versionId: v1.id, analysis: reading({ lufs: -9 }) })
    const first = await call(getRelease, relId)
    expect(first.release.scene).not.toBeNull()
    expect(first.tracks[0].scene).toEqual(first.release.scene)

    // A second bounce, a re-measure with a newer meter, a rename, and a move to Releases and back: all unchanged.
    const v2 = await uploadAudio({ trackId, kind: 'mix', file: new File(['y'], 'v2.mp3'), contentType: 'audio/mpeg', durationMs: null }, () => {})
    await call(saveAnalysis, { versionId: v2.id, analysis: reading({ lufs: -3 }) })
    await call(saveAnalysis, { versionId: v1.id, analysis: reading({ meter: 99, lufs: -3 }) })
    await call(updateRelease, { id: relId, title: 'Renamed', format: 'single', releaseDate: '', upc: '', tracks: [{ id: trackId, title: 'Renamed' }], released: false, zone: 'UTC' })
    const wav = await uploadAudio({ trackId, kind: 'master', file: new File(['z'], 'final.wav'), contentType: 'audio/wav', durationMs: null }, () => {})
    await call(saveAnalysis, { versionId: wav.id, analysis: reading() })
    await call(fileVersion, { versionId: wav.id, to: 'final' })
    await call(moveToReleases, { id: relId, releasedOn: '2026-01-01', zone: 'UTC' })
    await call(moveToUpcoming, relId)

    const after = await call(getRelease, relId)
    expect(after.release.scene).toEqual(first.release.scene)
    expect(after.tracks[0].scene).toEqual(first.tracks[0].scene)
  })

  it('never stamps from an instrumental', async () => {
    const { id: relId, trackIds: [trackId] } = await call(createRelease, { title: 'Alt', format: 'single', tracks: [] })
    device.reading = undefined
    const inst = await uploadAudio({ trackId, kind: 'instrumental', file: new File(['x'], 'i.mp3'), contentType: 'audio/mpeg', durationMs: null }, () => {})
    await call(saveAnalysis, { versionId: inst.id, analysis: reading() })
    expect((await call(getRelease, relId)).tracks[0].scene).toBeNull()
  })

  it('backfills from the oldest measured mix or master still in D1, pruned included', async () => {
    const { id: relId, trackIds: [trackId] } = await call(createRelease, { title: 'Old', format: 'single', tracks: [] })
    await db.insert(versions).values([
      { id: 'old-pruned', trackId, kind: 'mix', number: 1, r2Key: 'old-k1', filename: 'a.mp3', contentType: 'audio/mpeg', size: 1, createdAt: '2020-01-01T00:00:00.000Z', prunedAt: '2020-02-01T00:00:00.000Z', analysis: reading({ lufs: -20 }) },
      { id: 'old-newer', trackId, kind: 'master', number: 2, r2Key: 'old-k2', filename: 'b.wav', contentType: 'audio/wav', size: 1, createdAt: '2021-01-01T00:00:00.000Z', analysis: reading({ lufs: -5 }) },
    ])
    expect(await stampScenes()).toBeGreaterThanOrEqual(1)
    const after = await call(getRelease, relId)
    expect(after.tracks[0].scene).not.toBeNull()
    expect(after.release.scene).toEqual(after.tracks[0].scene)
    // From the oldest (−20 LUFS), not the newer (−5): loud = (−20 − −30) / 24
    expect(after.tracks[0].scene?.loud).toBeCloseTo((-20 + 30) / 24, 2)
    // Running again is a no-op: already stamped.
    await db.update(tracks).set({ title: 'Old' }).where(eq(tracks.id, trackId))
    expect(await stampScenes()).toBe(0)
  })

  it('stamps a release’s unstamped songs the first time it opens, without waiting for the cron', async () => {
    const { id: relId, trackIds: [trackId] } = await call(createRelease, { title: 'Opened', format: 'single', tracks: [] })
    await db.insert(versions).values({ id: 'open-1', trackId, kind: 'mix', number: 1, r2Key: 'open-k1', filename: 'a.mp3', contentType: 'audio/mpeg', size: 1, analysis: reading({ lufs: -18 }) })
    const opened = await call(getRelease, relId)
    expect(opened.tracks[0].scene?.loud).toBeCloseTo((-18 + 30) / 24, 2)
    expect(opened.release.scene).toEqual(opened.tracks[0].scene)
  })
})

describe('the nightly meter', () => {
  it('measures what has no reading in the Worker, and stamps what it can’t read so it isn’t retried', async () => {
    await db.update(versions).set({ analysis: reading() }) // everything earlier counts as measured
    device.reading = undefined
    const wav = await uploadAudio({ trackId: song, kind: 'mix', file: new File([arpeggio([60, 64, 67], 0.5)], 'arp.wav'), contentType: 'audio/wav', durationMs: null }, () => {})
    const junk = await uploadAudio({ trackId: song, kind: 'mix', file: new File([new Uint8Array(5000).fill(7)], 'junk.ogg'), contentType: 'audio/ogg', durationMs: null }, () => {})

    expect(await measureMissing()).toBe(2)
    expect(await analysisOf(wav.id)).toMatchObject({ meter: 1, source: 'worker', format: { codec: 'pcm', rate: 22_050, channels: 1 }, ms: 8000, correlation: null })
    expect(await analysisOf(junk.id)).toEqual({ meter: 1, unreadable: true })
    expect(await measureMissing()).toBe(0)
  })
})
