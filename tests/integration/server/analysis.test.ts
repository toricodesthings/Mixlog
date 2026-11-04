import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'

import { reading } from '../../support/analysis'
import '../../support/browser'
import { call } from '../../support/start'
import { uploadAudio } from '#/lib/files'
import { db } from '#/server/db'
import { arpeggio } from '#/server/dev'
import { measureMissing } from '#/server/meter'
import { createRelease, getRelease, saveAnalysis } from '#/server/releases'
import { versions } from '#/server/schema'

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
