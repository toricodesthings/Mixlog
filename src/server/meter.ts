// The meter in the Worker: measures a stored bounce from R2 (the nightly cron, and seedDev). The browser measures as it
// uploads (lib/meter.ts); this catches what it missed and re-reads what an older meter measured.
import { env } from 'cloudflare:workers'
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm'

import { initSync, measure_seekable, Pump } from '#meter'
import wasm from '../../meter/pkg/mixlog_meter_bg.wasm?module'
import { db } from '#/server/db'
import { AUDIO_KINDS } from '#/server/files'
import { report } from '#/server/log'
import { storeAnalysis } from '#/server/releases'
import { METER, analysisInput, type Analysis } from '#/server/loudness'
import { versions } from '#/server/schema'

/** Up to this, a file is read whole (an M4A keeps its index at the end, so it can't be read forward only); past it,
 *  pumped through in range reads. Every file this big is lossless in practice. */
const WHOLE_BYTES = 64 * 1024 ** 2
const RANGE_BYTES = 8 * 1024 ** 2

let ready = false
const meter = () => {
  if (!ready) initSync({ module: wasm }), (ready = true)
}

/** What the meter reads from bytes `read` hands over, stamped with this meter; `unreadable` when it can't decode them. */
async function reading(size: number, hint: string, read: (at: number, length: number) => Promise<Uint8Array>): Promise<Analysis> {
  meter()
  try {
    let raw: unknown
    if (size <= WHOLE_BYTES) {
      const bytes = await read(0, size)
      raw = measure_seekable(bytes.length, (at: number, length: number) => bytes.subarray(at, at + length), hint)
    } else {
      const pump = new Pump(hint)
      try {
        for (let at = 0; at < size; at += RANGE_BYTES) pump.push(await read(at, Math.min(RANGE_BYTES, size - at)))
      } catch (error) {
        pump.free()
        throw error
      }
      raw = pump.finish()
    }
    return analysisInput.parse({ ...(raw as object), meter: METER, source: 'worker' })
  } catch (error) {
    if (error instanceof Error && error.message === 'unreadable') return { meter: METER, unreadable: true }
    throw error
  }
}

/** Measures one stored version and saves it, unless a reading from this meter is already there. */
export async function measureStored(versionId: string): Promise<void> {
  const [v] = await db.select({ r2Key: versions.r2Key, filename: versions.filename, size: versions.size }).from(versions).where(eq(versions.id, versionId))
  if (!v) return
  const hint = v.filename.split('.').pop()?.toLowerCase() ?? ''
  const analysis = await reading(v.size, hint, async (offset, length) => {
    const object = await env.FILES.get(v.r2Key, { range: { offset, length } })
    if (!object) throw new Error('stored file is missing')
    return new Uint8Array(await object.arrayBuffer())
  })
  await storeAnalysis(versionId, analysis)
}

/** The cron's job: measures up to `limit` audio versions with no reading, or one from an older meter, oldest first.
 *  A failure warns and moves on; it's tried again tomorrow. Returns how many it measured. */
export async function measureMissing(limit = 10): Promise<number> {
  const due = await db
    .select({ id: versions.id })
    .from(versions)
    .where(and(
      isNull(versions.prunedAt), inArray(versions.kind, AUDIO_KINDS),
      or(isNull(versions.analysis), sql`json_extract(${versions.analysis}, '$.meter') < ${METER}`),
    ))
    .orderBy(asc(versions.createdAt))
    .limit(limit)
  let measured = 0
  for (const { id } of due) {
    try {
      await measureStored(id)
      measured++
    } catch (error) {
      report('warn', 'measuring failed', error, { versionId: id })
    }
  }
  return measured
}
