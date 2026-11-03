// `pnpm dev` only: start the local studio over, empty or with sample music. The rail's Developer menu calls these.
// Built into production too (server functions are), so each refuses unless `import.meta.env.DEV`, which a build sets false.
import { notFound } from '@tanstack/react-router'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import { db } from '#/server/db'
import { fileKey } from '#/server/files'
import { currentPins, notes, releases, stampNow, tracks, versions } from '#/server/schema'

const devOnly = () => {
  if (!import.meta.env.DEV) throw notFound()
}

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

type SampleTrack = { title: string; notes: number[]; origin?: 'cover' | 'remix'; mix?: boolean; earlier?: boolean }
const SAMPLES: { title: string; format: 'single' | 'ep'; releasedOn?: string; tracks: SampleTrack[] }[] = [
  {
    title: 'Blue Hour',
    format: 'ep',
    tracks: [
      { title: 'Glass City', notes: [57, 60, 64, 67], mix: true, earlier: true },
      { title: 'Night Bus', notes: [55, 59, 62, 66] },
      { title: 'Lantern', notes: [53, 57, 60, 64] },
    ],
  },
  { title: 'Midnight Train', format: 'single', tracks: [{ title: 'Midnight Train', notes: [50, 54, 57, 61], origin: 'cover' }] },
  { title: 'First Light', format: 'single', releasedOn: '2026-06-12', tracks: [{ title: 'First Light', notes: [52, 56, 59, 64] }] },
]

/** Sample releases with real files: a master WAV on every track (an arpeggio, so playback has something to play),
 *  a mix and an earlier master on one (what Move to Releases prunes), and a PDF license on the cover. Written as uploads write them: the same keys and metadata. */
const seed = createServerOnlyFn(async () => {
  for (const sample of SAMPLES) {
    const releaseId = crypto.randomUUID()
    await db.insert(releases).values({ id: releaseId, title: sample.title, format: sample.format, releaseDate: sample.releasedOn ?? null, releasedAt: sample.releasedOn ? stampNow : null })
    for (const [i, t] of sample.tracks.entries()) {
      const trackId = crypto.randomUUID()
      await db.insert(tracks).values({ id: trackId, releaseId, position: i + 1, title: t.title, origin: t.origin ?? 'original' })
      const files = [
        ...(t.mix ? [{ kind: 'mix' as const, filename: `${t.title} mix.wav`, contentType: 'audio/wav', bytes: arpeggio(t.notes, 0.6) }] : []),
        ...(t.earlier ? [{ kind: 'master' as const, filename: `${t.title} master early.wav`, contentType: 'audio/wav', bytes: arpeggio(t.notes, 0.75) }] : []),
        { kind: 'master' as const, filename: `${t.title} master.wav`, contentType: 'audio/wav', bytes: arpeggio(t.notes, 0.9) },
        ...(t.origin ? [{ kind: 'license' as const, filename: `${t.title} license.pdf`, contentType: 'application/pdf', bytes: licensePdf(t.title) }] : []),
      ]
      for (const [n, f] of files.entries()) {
        const id = crypto.randomUUID()
        const key = fileKey({ releaseId, trackId }, f.kind, id)
        await env.FILES.put(key, f.bytes, { httpMetadata: { contentType: f.contentType }, customMetadata: { release: releaseId, track: trackId, kind: f.kind, filename: f.filename } })
        const durationMs = f.contentType === 'audio/wav' ? Math.round(((f.bytes.byteLength - 44) / 2 / RATE) * 1000) : null
        await db.insert(versions).values({ id, trackId, kind: f.kind, number: files.slice(0, n).filter((o) => o.kind === f.kind).length + 1, r2Key: key, filename: f.filename, contentType: f.contentType, size: f.bytes.byteLength, durationMs })
      }
    }
  }
})

export const wipeDev = createServerFn({ method: 'POST' }).handler(async () => {
  devOnly()
  await wipe()
})

export const seedDev = createServerFn({ method: 'POST' }).handler(async () => {
  devOnly()
  await wipe()
  await seed()
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
