import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { network, sent } from '../../support/browser'
import { deletedKeys, multiparts, objects } from '../../support/cloudflare-workers'
import { call } from '../../support/start'
import { downloadUrl, fileUrl, readFile, uploadArtwork, uploadAudio, uploadLicense } from '#/lib/files'
import { UPLOAD_PART_BYTES, audioTypeOf, type AudioKind } from '#/server/files'
import { createRelease, getRelease } from '#/server/releases'

// The browser's own upload code (lib/files.ts) → the /api routes → R2 and D1 → what the release page reads back.
const { id: releaseId, trackIds: [intro, song] } = await call(createRelease, { title: 'Night Drive', format: 'ep', tracks: ['Intro', 'Night Drive'] })
const release = () => call(getRelease, releaseId)
const stack = async (trackId: string, kind: string) => (await release()).versions.filter((v) => v.track_id === trackId && v.kind === kind)

const MB = 1024 ** 2
/** A bounce whose every 10 MB part is filled with its own number, so a part out of place or missing shows. */
function bounce(name: string, size: number) {
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i += UPLOAD_PART_BYTES) bytes.fill(i / UPLOAD_PART_BYTES + 1, i, i + UPLOAD_PART_BYTES)
  return new File([bytes], name)
}
const upload = (file: File, { trackId = song, kind = 'master' as AudioKind, durationMs = null as number | null, note = undefined as string | undefined, final = false, replaces = undefined as string | undefined } = {}) =>
  uploadAudio({ trackId, kind, file, contentType: audioTypeOf(file.name, file.type)!, durationMs, note, final, replaces }, () => {})
const sameBytes = async (a: Uint8Array | undefined, b: Blob) => !!a && Buffer.from(a).equals(Buffer.from(await b.arrayBuffer()))

beforeEach(() => {
  network.intercept = undefined
  sent.length = 0
})

describe('a bounce, from the browser to its stack', () => {
  it('goes up in 10 MB parts and lands whole as Master v1, foldered under its track', async () => {
    const wav = bounce('Night Drive Master.wav', 25 * MB)
    const progress: number[] = []
    const { id, number } = await uploadAudio({ trackId: song, kind: 'master', file: wav, contentType: 'audio/wav', durationMs: 214_000, note: 'First pass' }, (p) => progress.push(p))

    expect(number).toBe(1)
    expect(sent).toEqual(['POST /api/uploads', 'PUT /api/uploads part 1', 'PUT /api/uploads part 2', 'PUT /api/uploads part 3', 'POST /api/uploads/complete'])
    expect(progress.at(-1)).toBe(1)
    expect(await stack(song, 'master')).toMatchObject([{ id, number: 1, filename: 'Night Drive Master.wav', content_type: 'audio/wav', size: wav.size, duration_ms: 214_000, note: 'First pass', is_current: 1 }])
    const stored = objects.get(`releases/${releaseId}/tracks/${song}/master/${id}`)
    expect(await sameBytes(stored?.bytes, wav)).toBe(true)
    expect(stored?.customMetadata).toMatchObject({ release: releaseId, track: song, kind: 'master' })
  })

  it('never overwrites: the next bounce is v2 on top, and v1 still plays exactly as it was', async () => {
    const [v1] = await stack(song, 'master')
    expect(await upload(new File(['test bounce'], 'night drive v2.mp3'))).toMatchObject({ number: 2 })
    expect((await stack(song, 'master')).map((v) => [v.number, v.is_current])).toEqual([[2, 1], [1, 0]])
    const played = await fetch(fileUrl(v1.id))
    expect(await sameBytes(new Uint8Array(await played.arrayBuffer()), bounce('', 25 * MB))).toBe(true)
  })

  it('numbers mixes and masters as one song, each track on its own', async () => {
    expect(await upload(new File(['mix'], 'night drive mix.mp3'), { kind: 'mix' })).toMatchObject({ number: 3 })
    expect(await upload(new File(['intro'], 'intro.wav'), { trackId: intro })).toMatchObject({ number: 1 })
  })

  it('rides out a dropped connection: the part is sent again and the bounce lands whole', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    let dropped = false
    network.intercept = (request) => {
      if (!dropped && new URL(request.url).searchParams.get('part') === '2') throw ((dropped = true), new Error('offline'))
    }
    const mix = bounce('night drive mix 2.mp3', 15 * MB)
    const landing = upload(mix, { kind: 'mix' })
    await vi.waitUntil(() => vi.getTimerCount() > 0)
    vi.advanceTimersByTime(1000)
    const { id, number } = await landing
    vi.useRealTimers()

    expect(number).toBe(4)
    expect(sent.filter((s) => s.startsWith('PUT'))).toEqual(['PUT /api/uploads part 1', 'PUT /api/uploads part 2', 'PUT /api/uploads part 2'])
    expect(await sameBytes(objects.get(`releases/${releaseId}/tracks/${song}/mix/${id}`)?.bytes, mix)).toBe(true)
  })

  it('leaves nothing behind when a part is refused, and the next bounce takes the next number', async () => {
    network.intercept = (request) => (request.method === 'PUT' ? new Response('The bucket is full.', { status: 400 }) : undefined)
    await expect(upload(new File(['nope'], 'night drive v3.mp3'))).rejects.toThrow('The bucket is full.')
    expect(sent.filter((s) => s.startsWith('PUT'))).toHaveLength(1) // refused, not retried
    await vi.waitUntil(() => sent.includes('DELETE /api/uploads') && multiparts.size === 0)
    expect(await stack(song, 'master')).toHaveLength(2)

    network.intercept = undefined
    expect(await upload(new File(['v5'], 'night drive v5.mp3'))).toMatchObject({ number: 5 })
  })

  it('refuses what isn’t a bounce before a byte is sent', async () => {
    await expect(upload(new File(['x'], 'cover.png'), { kind: 'artwork' as AudioKind })).rejects.toThrow(/stack/)
    await expect(uploadAudio({ trackId: song, kind: 'master', file: new File(['x'], 'a.png'), contentType: 'image/png', durationMs: null }, () => {})).rejects.toThrow(/MP3, WAV/)
    await expect(upload(new File(['x'], 'a.wav'), { trackId: crypto.randomUUID() })).rejects.toThrow('Not found')
    const huge = await fetch('/api/uploads', { method: 'POST', body: JSON.stringify({ trackId: song, kind: 'master', contentType: 'audio/wav', size: 5 * 1024 ** 3 }) })
    expect(huge.status).toBe(413)
    expect(sent.every((s) => s === 'POST /api/uploads')).toBe(true)
  })

  it('refuses an oversized part, or one sent for another track’s upload', async () => {
    const started = await fetch('/api/uploads', { method: 'POST', body: JSON.stringify({ trackId: song, kind: 'master', filename: 'a.wav', contentType: 'audio/wav', size: 4 }) })
    const { id, uploadId } = (await started.json()) as { id: string; uploadId: string }
    const big = new Blob([new Uint8Array(UPLOAD_PART_BYTES + 1)])
    const oversized = await fetch(`/api/uploads?${new URLSearchParams({ trackId: song, kind: 'master', id, uploadId, part: '1' })}`, { method: 'PUT', body: big, headers: { 'content-length': String(big.size) } })
    expect([oversized.status, multiparts.get(uploadId)?.parts.size]).toEqual([400, 0])
    const forged = await fetch(`/api/uploads?${new URLSearchParams({ trackId: intro, kind: 'master', id, uploadId, part: '1' })}`, { method: 'PUT', body: 'abcd', headers: { 'content-length': '4' } })
    expect([forged.status, await forged.text()]).toEqual([404, 'This upload has gone; start it again.'])
    const done = await fetch('/api/uploads/complete', { method: 'POST', body: JSON.stringify({ trackId: intro, kind: 'master', id, uploadId, parts: [{ partNumber: 1, etag: 'x' }] }) })
    expect(done.status).toBe(404)
    expect(await stack(intro, 'master')).toHaveLength(1)
  })
})

const { id: out, trackIds: [single] } = await call(createRelease, { title: 'Out Already', format: 'single', tracks: [], releasedOn: '2026-01-02', zone: 'UTC' })
describe('filing an upload', () => {
  const own = async (releaseId: string) => (await call(getRelease, releaseId)).versions.map((v) => [v.filename, v.is_final ? 'final' : v.kind])

  it('lands a final straight in the Final lane, and the next one takes its place', async () => {
    await upload(new File(['wav'], 'intro final.wav'), { trackId: intro, final: true })
    await upload(new File(['wav'], 'intro final 2.wav'), { trackId: intro, final: true })
    expect((await stack(intro, 'master')).map((v) => [v.number, v.filename, v.is_final])).toEqual([[3, 'intro final 2.wav', 1], [2, 'intro final.wav', 0], [1, 'intro.wav', 0]])
    await expect(upload(new File(['mp3'], 'intro test.mp3'), { trackId: intro, final: true })).rejects.toThrow(/final is a WAV/)
    await expect(upload(new File(['wav'], 'intro mix.wav'), { trackId: intro, kind: 'mix', final: true })).rejects.toThrow(/final is a WAV/)
  })

  it('in Upcoming never replaces', async () => {
    const [top] = await stack(intro, 'master')
    await expect(upload(new File(['wav'], 'again.wav'), { trackId: intro, replaces: top.id })).rejects.toThrow(/never|nothing is replaced/)
  })

  it('in Releases takes a final for a track without one, which ships it, and nothing else', async () => {
    await expect(upload(new File(['mp3'], 'out.mp3'), { trackId: single })).rejects.toThrow(/one file per slot/)
    await upload(new File(['wav'], 'out.wav'), { trackId: single, final: true })
    expect(await own(out)).toEqual([['out.wav', 'final']])
    expect((await call(getRelease, out)).versions[0].released_at).not.toBeNull()
    await expect(upload(new File(['wav'], 'out 2.wav'), { trackId: single, final: true })).rejects.toThrow(/has its final/)
  })

  it('replaces a wrong final: the new one is stored and pinned before the old row and file go', async () => {
    const [old] = (await call(getRelease, out)).versions
    const oldKey = `releases/${out}/tracks/${single}/master/${old.id}`
    await upload(new File(['wav'], 'out fixed.wav'), { trackId: single, final: true, replaces: old.id })
    const [now] = (await call(getRelease, out)).versions
    expect([now.filename, now.is_final, now.released_at !== null, now.number]).toEqual(['out fixed.wav', 1, true, 2])
    expect([objects.has(oldKey), deletedKeys.includes(oldKey), objects.has(`releases/${out}/tracks/${single}/master/${now.id}`)]).toEqual([false, true, true])
  })

  it('refuses a replacement that doesn’t fit its slot, and keeps the old file when a send fails', async () => {
    const [final] = (await call(getRelease, out)).versions
    await expect(upload(new File(['wav'], 'inst.wav'), { trackId: single, kind: 'instrumental', replaces: final.id })).rejects.toThrow(/isn’t this slot’s/)
    await expect(upload(new File(['wav'], 'x.wav'), { trackId: intro, final: true, replaces: final.id })).rejects.toThrow(/nothing is replaced/)
    await expect(upload(new File(['mp3'], 'x.mp3'), { trackId: single, final: true, replaces: final.id })).rejects.toThrow(/final is a WAV/)
    network.intercept = (request) => (request.method === 'PUT' ? new Response('Gone', { status: 400 }) : undefined)
    await expect(upload(new File(['wav'], 'x.wav'), { trackId: single, final: true, replaces: final.id })).rejects.toThrow('Gone')
    expect((await call(getRelease, out)).versions.map((v) => v.id)).toEqual([final.id])
  })
})

describe('playing a version', () => {
  it('serves the bytes as uploaded, seeks by range, and downloads under its own name', async () => {
    const file = new File(['RIFF0123WAVEfmt '], 'intro’s master.wav')
    const { id } = await upload(file, { trackId: intro })
    const played = await fetch(fileUrl(id))
    expect([played.status, played.headers.get('content-type'), played.headers.get('x-content-type-options'), await played.text()]).toEqual([200, 'audio/wav', 'nosniff', await file.text()])

    const seek = await fetch(fileUrl(id), { headers: { range: 'bytes=4-7' } })
    expect([seek.status, seek.headers.get('content-range'), await seek.text()]).toEqual([206, `bytes 4-7/${file.size}`, '0123'])
    expect((await fetch(downloadUrl(id))).headers.get('content-disposition')).toBe(`attachment; filename*=UTF-8''${encodeURIComponent('intro’s master.wav')}`)
  })

  it('knows nothing it doesn’t hold', async () => {
    expect((await fetch(fileUrl(crypto.randomUUID()))).status).toBe(404)
    expect((await fetch('/api/files/..%2F..%2Fsecrets')).status).toBe(404)
  })
})

describe('artwork', () => {
  const png = (name: string) => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' })

  it('replaces the cover: the new one is stored before the old one goes', async () => {
    await uploadArtwork(releaseId, png('cover.png'))
    const first = (await release()).release.artwork_id
    await uploadArtwork(releaseId, png('cover v2.png'))

    const { release: now, versions } = await release()
    expect(versions.filter((v) => v.kind === 'artwork')).toMatchObject([{ id: now.artwork_id, number: 2, filename: 'cover v2.png' }])
    expect(deletedKeys).toContain(`releases/${releaseId}/artwork/${first}`)
    expect(objects.has(`releases/${releaseId}/artwork/${now.artwork_id}`)).toBe(true)
  })

  it('takes only a PNG or JPG, and keeps the cover it has', async () => {
    const before = (await release()).release.artwork_id
    await expect(uploadArtwork(releaseId, new File(['<svg onload=alert(1)/>'], 'cover.svg', { type: 'image/svg+xml' }))).rejects.toThrow(/PNG or JPG/)
    await expect(uploadArtwork(crypto.randomUUID(), png('cover.png'))).rejects.toThrow('Not found')
    expect((await release()).release.artwork_id).toBe(before)
  })
})

describe('licenses', () => {
  const pdf = (name: string) => new File(['%PDF-1.7\n%clearance'], name)
  const licenses = async () => (await release()).versions.filter((v) => v.track_id === song && v.kind === 'license')

  it('stacks each new license on top and keeps the earlier ones', async () => {
    expect(await uploadLicense(song, pdf('clearance.pdf'))).toMatchObject({ number: 1 })
    expect(await uploadLicense(song, pdf('clearance signed.pdf'))).toMatchObject({ number: 2 })
    expect((await licenses()).map((v) => [v.number, v.content_type])).toEqual([[2, 'application/pdf'], [1, 'application/pdf']])
  })

  it('refuses a page renamed .pdf, and stores nothing', async () => {
    const keys = objects.size
    await expect(uploadLicense(song, new File(['<html><script>'], 'license.pdf'))).rejects.toThrow(/isn’t the PDF/)
    await expect(uploadLicense(song, new File(['x'], 'license.html'))).rejects.toThrow(/PDF or a Word/)
    expect(await licenses()).toHaveLength(2)
    expect(objects.size).toBe(keys)
  })

  it('reads back exactly as uploaded, saying how much has arrived on the way', async () => {
    const [top] = await licenses()
    const arrived: number[] = []
    const bytes = await readFile(top.id, top.size, (share) => arrived.push(share))
    expect(await sameBytes(new Uint8Array(bytes), pdf('x'))).toBe(true)
    expect(arrived.at(-1)).toBe(1)
    expect(arrived).toEqual([...arrived].sort((a, b) => a - b))
  })
})

describe('outside pnpm dev', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('every file route is Forbidden without an Access token, and nothing is stored', async () => {
    const [{ id }] = await stack(song, 'master')
    vi.stubEnv('DEV', false)
    const keys = objects.size
    const answers = await Promise.all([
      fetch(fileUrl(id)),
      fetch('/api/uploads', { method: 'POST', body: JSON.stringify({ trackId: song, kind: 'master', contentType: 'audio/wav', size: 4 }) }),
      fetch('/api/uploads?part=1', { method: 'PUT', body: 'abcd' }),
      fetch('/api/uploads', { method: 'DELETE' }),
      fetch('/api/uploads/complete', { method: 'POST', body: '{}' }),
      fetch(`/api/releases/${releaseId}/artwork`, { method: 'POST', body: 'x', headers: { 'content-type': 'image/png', 'content-length': '1' } }),
      fetch(`/api/tracks/${song}/license`, { method: 'POST', body: '%PDF-', headers: { 'content-type': 'application/pdf', 'content-length': '5' } }),
    ])
    expect(answers.map((r) => r.status)).toEqual(Array(7).fill(403))
    expect(objects.size).toBe(keys)
  })
})
