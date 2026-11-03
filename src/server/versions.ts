import { env } from 'cloudflare:workers'
import { and, eq, inArray, lt, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

import { isAllowed } from '#/server/access'
import {
  AUDIO_KINDS, MAX_ARTWORK_BYTES, MAX_AUDIO_BYTES, MAX_LICENSE_BYTES, UPLOAD_PART_BYTES,
  artworkProblem, audioProblem, contentRange, fileKey, licenseProblem, startsLike, type AudioKind,
} from '#/server/files'
import { db } from '#/server/db'
import { Id, isId } from '#/server/input'
import { releases, tracks, versions } from '#/server/schema'
import { keepDays } from '#/server/settings'

// Server routes, not server functions: bytes stream through without a JSON round trip, and an <img> or
// <audio> can point at them. They don't get `access` from start.ts, so each checks the token itself.
const allowed = async (request: Request) => import.meta.env.DEV || (await isAllowed(request, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD))
const text = (status: number, body: string) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

/** GET /api/files/$versionId: the file exactly as uploaded, with range requests for playback. `?download` saves it
 *  under its own filename instead. */
export async function serveFile(request: Request, versionId: string): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  if (!isId(versionId)) return text(404, 'Not found')
  const [version] = await db.select({ r2Key: versions.r2Key, contentType: versions.contentType, filename: versions.filename }).from(versions).where(eq(versions.id, versionId))
  if (!version) return text(404, 'Not found')
  const ranged = request.headers.has('range')
  const object = await env.FILES.get(version.r2Key, ranged ? { range: request.headers } : {})
  if (!object) return text(404, 'Not found')

  const headers = new Headers({
    'content-type': version.contentType,
    etag: object.httpEtag,
    'accept-ranges': 'bytes',
    // A version never changes, so the browser can keep it; private, because it's behind Access.
    'cache-control': 'private, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
  })
  if (new URL(request.url).searchParams.has('download')) {
    headers.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(version.filename).replace(/'/g, '%27')}`)
  }
  if (ranged && object.range) {
    headers.set('content-range', contentRange(object.range, object.size))
    return new Response(object.body, { status: 206, headers })
  }
  return new Response(object.body, { headers })
}

/** POST /api/releases/$releaseId/artwork: the body is the image. A release has one artwork: once the new one is
 *  stored and recorded, the old one (row and file) goes. The one place Mixlog replaces a file, by the artist's rule. */
export async function addArtwork(request: Request, releaseId: string): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  if (!isId(releaseId)) return text(404, 'Not found')
  const contentType = request.headers.get('content-type')
  const size = Number(request.headers.get('content-length'))
  const problem = artworkProblem(contentType, size)
  if (problem) return text(size > MAX_ARTWORK_BYTES ? 413 : 400, problem)
  if (!request.body) return text(400, 'No image')

  const [release] = await db.select({ id: releases.id }).from(releases).where(eq(releases.id, releaseId))
  if (!release) return text(404, 'Not found')
  const artworkOf = and(eq(versions.releaseId, releaseId), eq(versions.kind, 'artwork'))
  const [{ next }] = await db.select({ next: sql<number>`COALESCE(MAX(${versions.number}), 0) + 1` }).from(versions).where(artworkOf)
  const id = crypto.randomUUID()
  const filename = (request.headers.get('x-filename') ?? '').slice(0, 255) || 'artwork'
  // The key and metadata carry release, kind and version, so the file can be matched up without D1.
  const key = fileKey({ releaseId }, 'artwork', id)
  await env.FILES.put(key, request.body, {
    httpMetadata: { contentType: contentType! },
    customMetadata: { release: releaseId, kind: 'artwork', version: String(next), filename },
  })
  try {
    await db.insert(versions).values({ id, releaseId, kind: 'artwork', number: next, r2Key: key, filename, contentType: contentType!, size })
  } catch (error) {
    await env.FILES.delete(key) // no file without its row
    throw error
  }
  // Only after the new one is safe. Its pin, if any, goes with the row.
  const old = await db.delete(versions).where(and(artworkOf, ne(versions.id, id))).returning({ r2Key: versions.r2Key })
  if (old.length) await env.FILES.delete(old.map((v) => v.r2Key))
  return Response.json({ id, number: next }, { status: 201 })
}

// Audio goes up in parts, through the Worker into R2 multipart: start, then one PUT per part, then finish.
// The browser holds the upload as its track, stack and version ID; the Worker rebuilds the R2 key from those, so
// nothing about it is kept in D1 until it's whole, and no storage key reaches the browser.
const json = async (request: Request) => request.json().catch(() => null)
const Start = z.object({ trackId: Id(), kind: z.unknown(), filename: z.string().optional().catch(undefined), contentType: z.unknown(), size: z.unknown() })
const Upload = z.object({ trackId: Id(), kind: z.enum(AUDIO_KINDS), id: Id(), uploadId: z.string().min(1) })
const Finish = Upload.extend({
  parts: z.array(z.object({ partNumber: z.int().min(1).max(10_000), etag: z.string() })).min(1),
  durationMs: z.int().positive().lt(86_400_000).nullish().catch(null),
  /** One line on what changed ("Final of v3"). */
  note: z.string().trim().max(200).nullish().catch(null),
})

/** The R2 key of a track's file, under its release; null when the track is gone. */
async function keyFor(trackId: string, kind: AudioKind, versionId: string) {
  const [track] = await db.select({ releaseId: tracks.releaseId }).from(tracks).where(eq(tracks.id, trackId))
  return track?.releaseId ? fileKey({ releaseId: track.releaseId, trackId }, kind, versionId) : null
}

/** An upload in flight, from what the browser sent (JSON or a query string), with its R2 key; null when it isn't one. */
async function ongoing<T extends typeof Upload>(input: unknown, schema: T = Upload as T) {
  const upload = schema.safeParse(input)
  if (!upload.success) return null
  const key = await keyFor(upload.data.trackId, upload.data.kind, upload.data.id)
  return key ? { ...(upload.data as z.output<T>), key } : null
}
const query = (request: Request) => Object.fromEntries(new URL(request.url).searchParams)

/** POST /api/uploads, JSON { trackId, kind, filename, contentType, size }: starts a bounce's upload. */
export async function startUpload(request: Request): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  const body = Start.safeParse(await json(request))
  if (!body.success) return text(404, 'Not found')
  const { trackId, kind, filename, contentType, size } = body.data
  const problem = audioProblem(kind, contentType, size)
  if (problem) return text((size as number) > MAX_AUDIO_BYTES ? 413 : 400, problem)
  const [track] = await db.select({ releaseId: tracks.releaseId }).from(tracks).where(eq(tracks.id, trackId))
  if (!track?.releaseId) return text(404, 'Not found')

  const id = crypto.randomUUID()
  const name = filename?.slice(0, 255) || 'bounce'
  const upload = await env.FILES.createMultipartUpload(fileKey({ releaseId: track.releaseId, trackId }, kind as AudioKind, id), {
    httpMetadata: { contentType: contentType as string },
    customMetadata: { release: track.releaseId, track: trackId, kind: kind as string, filename: name },
  })
  return Response.json({ id, uploadId: upload.uploadId }, { status: 201 })
}

/** PUT /api/uploads?trackId=…&kind=…&id=…&uploadId=…&part=N: one part, streamed into R2. */
export async function putUploadPart(request: Request): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  const params = query(request)
  const upload = await ongoing(params)
  const part = Number(params.part)
  const size = Number(request.headers.get('content-length'))
  if (!upload || !Number.isInteger(part) || part < 1 || part > 10_000) return text(400, 'Not a part of an upload')
  if (!request.body || !(size > 0 && size <= UPLOAD_PART_BYTES)) return text(400, 'A part is 10 MB at most')
  try {
    return Response.json(await env.FILES.resumeMultipartUpload(upload.key, upload.uploadId).uploadPart(part, request.body))
  } catch {
    return text(404, 'This upload has gone; start it again.')
  }
}

/** POST /api/uploads/complete, JSON { trackId, kind, id, uploadId, parts, durationMs, note? }: joins the parts and puts the
 *  file on top of its stack as the next version. Numbered here, so an abandoned upload never leaves a gap. */
export async function completeUpload(request: Request): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  const upload = await ongoing(await json(request), Finish)
  if (!upload) return text(400, 'Not an upload')
  const { trackId, kind, id, key, uploadId, parts, durationMs: duration, note } = upload

  let object: R2Object
  try {
    object = await env.FILES.resumeMultipartUpload(key, uploadId).complete(parts)
  } catch {
    return text(404, 'This upload has gone; start it again.')
  }
  const number = await stack({
    id, trackId, kind, key, size: object.size, durationMs: duration ?? null, note: note || null,
    filename: object.customMetadata?.filename ?? 'bounce', contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
  })
  return Response.json({ id, number }, { status: 201 })
}

/** Puts a stored file on top of its track's stack and returns its number. One statement takes the next number and
 *  claims it, so two landing at once can't share one; if the row fails, the file goes too: never a half-version. */
async function stack(v: { id: string; trackId: string; kind: string; key: string; filename: string; contentType: string; size: number; durationMs: number | null; note?: string | null }) {
  try {
    const row = await db.get<{ number: number }>(sql`
      INSERT INTO ${versions} (id, track_id, kind, number, r2_key, filename, content_type, size, duration_ms, note)
      SELECT ${v.id}, ${v.trackId}, ${v.kind}, COALESCE(MAX(number), 0) + 1, ${v.key}, ${v.filename}, ${v.contentType}, ${v.size}, ${v.durationMs}, ${v.note ?? null}
      FROM ${versions} WHERE track_id = ${v.trackId} AND kind = ${v.kind}
      RETURNING number`)
    return row!.number
  } catch (error) {
    await env.FILES.delete(v.key)
    throw error
  }
}

/** POST /api/tracks/$trackId/license: the body is a PDF or Word document, the track's next license. A license is a
 *  stack like any other: a new one goes on top and every earlier one is kept. */
export async function addLicense(request: Request, trackId: string): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  if (!isId(trackId)) return text(404, 'Not found')
  const contentType = request.headers.get('content-type')
  const size = Number(request.headers.get('content-length'))
  const problem = licenseProblem(contentType, size)
  if (problem) return text(size > MAX_LICENSE_BYTES ? 413 : 400, problem)
  const [track] = await db.select({ releaseId: tracks.releaseId }).from(tracks).where(eq(tracks.id, trackId))
  if (!track?.releaseId) return text(404, 'Not found')

  // Read whole (20 MB at most, checked above) so its first bytes can be checked against the type it claims.
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength !== size || !startsLike(contentType!, bytes)) return text(400, 'That file isn’t the PDF or Word document its name says.')
  const id = crypto.randomUUID()
  const filename = (request.headers.get('x-filename') ?? '').slice(0, 255) || 'license'
  const key = fileKey({ releaseId: track.releaseId, trackId }, 'license', id)
  await env.FILES.put(key, bytes, {
    httpMetadata: { contentType: contentType! },
    customMetadata: { release: track.releaseId, track: trackId, kind: 'license', filename },
  })
  const number = await stack({ id, trackId, kind: 'license', key, filename, contentType: contentType!, size, durationMs: null })
  return Response.json({ id, number }, { status: 201 })
}

/** DELETE /api/uploads?trackId=…&kind=…&id=…&uploadId=…: drops the parts of an upload that won't finish. */
export async function abortUpload(request: Request): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  const upload = await ongoing(query(request))
  if (!upload) return text(400, 'Not an upload')
  await env.FILES.resumeMultipartUpload(upload.key, upload.uploadId).abort().catch(() => {})
  return new Response(null, { status: 204 })
}

/** The cleanup cron's job (server.ts): erases what was pruned longer ago than Settings keeps it (never, when it keeps
 *  everything). Files first, then their rows, so a failure part way leaves a row to retry, never a file nothing points
 *  at. Returns how many it erased. */
export async function erasePruned(): Promise<number> {
  const days = await keepDays()
  if (days === null) return 0
  const before = sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ${`-${days} days`})`
  let erased = 0
  for (;;) {
    const due = await db.select({ id: versions.id, r2Key: versions.r2Key }).from(versions).where(lt(versions.prunedAt, before)).limit(90)
    if (!due.length) return erased
    await env.FILES.delete(due.map((v) => v.r2Key))
    await db.delete(versions).where(inArray(versions.id, due.map((v) => v.id)))
    erased += due.length
  }
}
