// `pnpm dev` only: start the local studio over, empty or with sample music. The rail's Developer menu calls these.
// In a build `import.meta.env.DEV` is false: each handler is only its 404, and the rest is shaken out.
import { notFound } from '@tanstack/react-router'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import { db } from '#/server/db'
import { fileKey } from '#/server/files'
import { measureMissing } from '#/server/meter'
import type { Fingerprint } from '#/server/loudness'
import { currentPins, notes, releases, stamp, stampNow, tracks, versions } from '#/server/schema'

/** Every row and every file, gone: local D1 and R2 as on the first day. */
const wipe = createServerOnlyFn(async () => {
  await db.batch([db.delete(notes), db.delete(currentPins), db.delete(versions), db.delete(tracks), db.delete(releases)])
  for (let cursor: string | undefined; ; ) {
    const page = await env.FILES.list({ cursor })
    if (page.objects.length) await env.FILES.delete(page.objects.map((o) => o.key))
    if (!page.truncated) break
    cursor = page.cursor
  }
})

/** A sample file: its lane or stack, what it's made of (a WAV arpeggio, one of the two MP3 test bounces, a PDF), its
 *  note, and how many days ago it landed. `final` pins it as the track's final; `aside` is set aside by the release's move. */
type SampleFile = { kind: 'mix' | 'master' | 'instrumental' | 'acapella' | 'license'; as: 'wav' | 'mix' | 'master' | 'pdf'; note?: string; days: number; final?: true; aside?: true }
/** `scene` is written straight onto the track before the meter runs (the stamp is `WHERE scene IS NULL`), so a sample
 *  can show a landscape the arpeggio would never measure as. */
type SampleTrack = { title: string; notes: number[]; origin?: 'cover' | 'remix'; scene?: Fingerprint; files: SampleFile[] }
/** `cover`: a release's artwork as a PNG gradient from its top colour to its bottom (RGB), so the room's palette is read. */
type Rgb = [number, number, number]
const SAMPLES: { title: string; format: 'single' | 'ep'; releasedOn?: string; cover?: [Rgb, Rgb]; tracks: SampleTrack[] }[] = [
  {
    title: 'Blue Hour',
    format: 'ep',
    tracks: [
      {
        title: 'Glass City',
        notes: [57, 60, 64, 67],
        files: [
          { kind: 'mix', as: 'mix', days: 6 },
          { kind: 'mix', as: 'mix', note: 'hats down', days: 5 },
          { kind: 'master', as: 'master', note: 'louder vocal', days: 3 },
          { kind: 'master', as: 'wav', days: 1, final: true },
          { kind: 'instrumental', as: 'wav', days: 1 },
        ],
      },
      { title: 'Night Bus', notes: [55, 59, 62, 66], files: [{ kind: 'mix', as: 'mix', days: 4 }, { kind: 'master', as: 'master', note: 'first master', days: 2 }] },
      { title: 'Lantern', notes: [53, 57, 60, 64], files: [{ kind: 'mix', as: 'mix', days: 2 }] },
    ],
  },
  {
    title: 'Midnight Train',
    format: 'single',
    tracks: [
      {
        title: 'Midnight Train',
        notes: [50, 54, 57, 61],
        origin: 'cover',
        files: [{ kind: 'mix', as: 'mix', days: 3 }, { kind: 'master', as: 'wav', days: 1 }, { kind: 'license', as: 'pdf', days: 3 }],
      },
    ],
  },
  { title: 'First Light', format: 'single', releasedOn: '2026-06-12', tracks: [{ title: 'First Light', notes: [52, 56, 59, 64], files: [{ kind: 'master', as: 'wav', days: 150, final: true }] }] },
  {
    title: 'Harbour Lights',
    format: 'ep',
    releasedOn: '2026-10-24',
    tracks: [
      {
        title: 'Tide',
        notes: [48, 52, 55, 59],
        files: [
          { kind: 'mix', as: 'mix', days: 16, aside: true },
          { kind: 'master', as: 'wav', days: 12, final: true },
          { kind: 'instrumental', as: 'wav', days: 12 },
          { kind: 'acapella', as: 'wav', days: 12 },
        ],
      },
      { title: 'Lamplight', notes: [46, 50, 53, 57], files: [{ kind: 'master', as: 'master', days: 14, aside: true }, { kind: 'master', as: 'wav', days: 12, final: true }] },
    ],
  },
  // The two landscapes the arpeggio never reaches: a wide mix (coast) and a loud, dynamic one (highlands)
  {
    title: 'Coast test',
    format: 'single',
    cover: [[64, 150, 170], [12, 48, 72]],
    tracks: [{
      title: 'Coast test', notes: [50, 55, 59, 62], files: [{ kind: 'mix', as: 'mix', days: 2 }],
      scene: { v: 1, loud: 0.45, dyn: 0.4, width: 0.85, weather: 0.55, peak: 0.7, length: 0.5, env: [0.3, 0.35, 0.42, 0.5, 0.55, 0.52, 0.6, 0.7, 0.66, 0.62, 0.58, 0.64, 0.72, 0.8, 0.86, 0.9, 1, 0.94, 0.85, 0.7, 0.6, 0.5, 0.4, 0.32] },
    }],
  },
  {
    title: 'Highlands test',
    format: 'single',
    cover: [[176, 96, 140], [44, 24, 52]],
    tracks: [{
      title: 'Highlands test', notes: [45, 52, 57, 60], files: [{ kind: 'mix', as: 'mix', days: 1 }],
      scene: { v: 1, loud: 0.85, dyn: 0.8, width: 0.3, weather: 0.35, peak: 0.35, length: 0.6, env: [0.15, 0.2, 0.45, 0.8, 1, 0.9, 0.5, 0.25, 0.2, 0.3, 0.6, 0.85, 0.95, 0.7, 0.35, 0.2, 0.25, 0.55, 0.9, 0.98, 0.8, 0.45, 0.2, 0.1] },
    }],
  },
]

/** The two MP3 test bounces (`fixtures/`, encoded once from `arpeggio`), loaded only when seeding. */
async function testBounce(as: 'mix' | 'master'): Promise<Uint8Array<ArrayBuffer>> {
  const { default: url } = as === 'mix' ? await import('./fixtures/test-mix.mp3?inline') : await import('./fixtures/test-master.mp3?inline')
  return Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0))
}

const bounce = (kind: string) => kind === 'mix' || kind === 'master'
const EXTENSION = { wav: 'wav', mix: 'mp3', master: 'mp3', pdf: 'pdf' }
const TYPE = { wav: 'audio/wav', mix: 'audio/mpeg', master: 'audio/mpeg', pdf: 'application/pdf' }

/** Sample releases with real files, written as uploads write them: the same keys, metadata and numbering (mixes and
 *  masters count together), each final pinned, and a released release's shipped files stamped and pinned. Every lane
 *  has something: tests waiting for their WAV, a lossless master waiting to be picked, alternates, a license, and
 *  versions set aside in Releases. */
const seed = createServerOnlyFn(async () => {
  for (const sample of SAMPLES) {
    const releaseId = crypto.randomUUID()
    const out = Boolean(sample.releasedOn)
    await db.insert(releases).values({ id: releaseId, title: sample.title, format: sample.format, releaseDate: sample.releasedOn ?? null, releasedAt: out ? stampNow : null, createdAt: stamp(20) })
    if (sample.cover) {
      // Stored as addArtwork stores one; its preview is made the first time it's served.
      const id = crypto.randomUUID()
      const key = fileKey({ releaseId }, 'artwork', id)
      const bytes = await gradientPng(...sample.cover)
      const filename = `${sample.title}.png`
      await env.FILES.put(key, bytes, { httpMetadata: { contentType: 'image/png' }, customMetadata: { release: releaseId, kind: 'artwork', version: '1', filename } })
      await db.insert(versions).values({ id, releaseId, kind: 'artwork', number: 1, r2Key: key, filename, contentType: 'image/png', size: bytes.byteLength })
    }
    for (const [i, t] of sample.tracks.entries()) {
      const trackId = crypto.randomUUID()
      await db.insert(tracks).values({ id: trackId, releaseId, position: i + 1, title: t.title, origin: t.origin ?? 'original', scene: t.scene ?? null })
      for (const [n, f] of t.files.entries()) {
        const id = crypto.randomUUID()
        const key = fileKey({ releaseId, trackId }, f.kind, id)
        const bytes = f.as === 'wav' ? arpeggio(t.notes, 0.9) : f.as === 'pdf' ? licensePdf(t.title) : await testBounce(f.as)
        const number = t.files.slice(0, n).filter((o) => (bounce(f.kind) ? bounce(o.kind) : o.kind === f.kind)).length + 1
        const filename = `${t.title} ${f.kind}${number > 1 && !f.final ? ` ${number}` : ''}.${EXTENSION[f.as]}`
        const durationMs = f.as === 'wav' ? Math.round(((bytes.byteLength - 44) / 2 / RATE) * 1000) : f.as === 'pdf' ? null : 8_000
        await env.FILES.put(key, bytes, { httpMetadata: { contentType: TYPE[f.as] }, customMetadata: { release: releaseId, track: trackId, kind: f.kind, filename } })
        const ships = out && !f.aside && f.kind !== 'license'
        await db.insert(versions).values({
          id, trackId, kind: f.kind, number, r2Key: key, filename, contentType: TYPE[f.as], size: bytes.byteLength, durationMs, note: f.note ?? null,
          createdAt: stamp(f.days), releasedAt: ships ? stampNow : null, prunedAt: f.aside ? stampNow : null,
        })
        // The final, and in Releases each shipped alternate, as Move to Releases pins them.
        if (f.final || (ships && f.kind !== 'master')) await db.insert(currentPins).values({ versionId: id, trackId, kind: f.kind })
      }
    }
  }
})

// Each guard is inline, not a helper: a build reads `import.meta.env.DEV` as false and drops everything after it,
// samples and fixtures included, so none of this ships in the production Worker.
export const wipeDev = createServerFn({ method: 'POST' }).handler(async () => {
  if (!import.meta.env.DEV) throw notFound()
  await wipe()
})

export const seedDev = createServerFn({ method: 'POST' }).handler(async () => {
  if (!import.meta.env.DEV) throw notFound()
  await wipe()
  await seed()
  // Through the Worker runner, so the samples have readings and every seed exercises it.
  await measureMissing(1000)
})

const RATE = 22_050

/** Eight seconds of a soft arpeggio over `notes` (MIDI numbers) as a 16-bit mono WAV, at `gain` of full scale. */
export function arpeggio(notes: number[], gain: number): Uint8Array<ArrayBuffer> {
  const seconds = 8
  const samples = RATE * seconds
  const out = new DataView(new ArrayBuffer(44 + samples * 2))
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)))
  ascii(0, 'RIFF'), out.setUint32(4, 36 + samples * 2, true), ascii(8, 'WAVEfmt ')
  out.setUint32(16, 16, true), out.setUint16(20, 1, true), out.setUint16(22, 1, true)
  out.setUint32(24, RATE, true), out.setUint32(28, RATE * 2, true), out.setUint16(32, 2, true), out.setUint16(34, 16, true)
  ascii(36, 'data'), out.setUint32(40, samples * 2, true)
  const step = RATE / 4 // sixteenths at 60 bpm
  for (let i = 0; i < samples; i++) {
    const note = notes[Math.floor(i / step) % notes.length]
    const t = (i % step) / RATE
    const wave = Math.sin(2 * Math.PI * 440 * 2 ** ((note - 69) / 12) * (i / RATE))
    out.setInt16(44 + i * 2, Math.round(wave * Math.exp(-t * 6) * gain * 0x7fff), true)
  }
  return new Uint8Array(out.buffer)
}

/** A 512 px square PNG, a vertical gradient from `top` to `bottom` (RGB): the smallest real cover. The platform's
 *  `deflate` stream is PNG's zlib; the chunks only need their CRC. */
export async function gradientPng(top: Rgb, bottom: Rgb, size = 512): Promise<Uint8Array<ArrayBuffer>> {
  const raw = new Uint8Array(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3) // each row starts with filter byte 0
    const rgb = top.map((c, i) => Math.round(c + ((bottom[i] - c) * y) / (size - 1)))
    for (let x = 0; x < size; x++) raw.set(rgb, row + 1 + x * 3)
  }
  const idat = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer())
  const ihdr = new Uint8Array(13)
  new DataView(ihdr.buffer).setUint32(0, size), new DataView(ihdr.buffer).setUint32(4, size)
  ihdr.set([8, 2, 0, 0, 0], 8) // 8-bit RGB, no interlace
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length)
    const view = new DataView(out.buffer)
    view.setUint32(0, data.length)
    out.set(new TextEncoder().encode(type), 4)
    out.set(data, 8)
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
    return out
  }
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array())]
  return new Uint8Array(await new Blob(parts).arrayBuffer())
}

function crc32(bytes: Uint8Array) {
  let c = ~0
  for (const b of bytes) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

/** A one-page PDF license, the smallest a reader opens: a catalog, a page, Helvetica, the text. */
export function licensePdf(title: string): Uint8Array<ArrayBuffer> {
  const lines = [`Mechanical license: ${title}`, '', 'Sample license for local development.', 'Licensor: Example Publishing', 'Territory: World', 'Term: Perpetual']
  const text = lines.map((line, i) => `BT /F1 ${i ? 12 : 18} Tf 72 ${720 - i * 24} Td (${line.replace(/[\\()]/g, '\\$&')}) Tj ET`).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, i) => {
    const at = pdf.length
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
    return at
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf) as Uint8Array<ArrayBuffer>
}
