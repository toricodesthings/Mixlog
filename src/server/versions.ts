import { env } from 'cloudflare:workers'
import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

import { isAllowed } from '#/server/access'
import { MAX_ARTWORK_BYTES, MAX_AUDIO_BYTES, UPLOAD_PART_BYTES, artworkProblem, audioProblem, contentRange, parseUploadKey, uploadKey, type AudioKind } from '#/server/files'
import { db } from '#/server/db'
import { Id, isId } from '#/server/input'
import { releases, tracks, versions } from '#/server/schema'

// Server routes, not server functions: bytes stream through without a JSON round trip, and an <img> or
// <audio> can point at them. They don't get `access` from start.ts, so each checks the token itself.
const allowed = async (request: Request) => import.meta.env.DEV || (await isAllowed(request, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD))
const text = (status: number, body: string) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })

/** GET /api/files/$versionId: the file exactly as uploaded, with range requests for playback. */
export async function serveFile(request: Request, versionId: string): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  if (!isId(versionId)) return text(404, 'Not found')
  const [version] = await db.select({ r2Key: versions.r2Key, contentType: versions.contentType }).from(versions).where(eq(versions.id, versionId))
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
  const key = `releases/${releaseId}/artwork/v${next}-${id}`
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
// The upload's key says which track and stack it's for, so nothing about it is kept in D1 until it's whole.
const json = async <T extends z.ZodType>(request: Request, schema: T) => schema.safeParse(await request.json().catch(() => null))
const Start = z.object({ trackId: Id(), kind: z.unknown(), filename: z.string().optional().catch(undefined), contentType: z.unknown(), size: z.unknown() })
const Finish = z.object({
  key: z.string(),
  uploadId: z.string(),
  parts: z.array(z.object({ partNumber: z.int().min(1).max(10_000), etag: z.string() })).min(1),
  durationMs: z.int().positive().lt(86_400_000).nullish().catch(null),
})
const ongoing = (url: URL) => ({ key: url.searchParams.get('key'), uploadId: url.searchParams.get('uploadId') })

/** POST /api/uploads, JSON { trackId, kind, filename, contentType, size }: starts a bounce's upload. */
export async function startUpload(request: Request): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  const body = await json(request, Start)
  if (!body.success) return text(404, 'Not found')
  const { trackId, kind, filename, contentType, size } = body.data
  const problem = audioProblem(kind, contentType, size)
  if (problem) return text((size as number) > MAX_AUDIO_BYTES ? 413 : 400, problem)
  const [track] = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId))
  if (!track) return text(404, 'Not found')

  const key = uploadKey(trackId, kind as AudioKind, crypto.randomUUID())
  const name = filename?.slice(0, 255) || 'bounce'
  const upload = await env.FILES.createMultipartUpload(key, {
    httpMetadata: { contentType: contentType as string },
    customMetadata: { track: trackId, kind: kind as string, filename: name },
  })
  return Response.json({ key, uploadId: upload.uploadId }, { status: 201 })
}

/** PUT /api/uploads?key=…&uploadId=…&part=N: one part, streamed into R2. */
export async function putUploadPart(request: Request): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  const url = new URL(request.url)
  const { key, uploadId } = ongoing(url)
  const part = Number(url.searchParams.get('part'))
  const size = Number(request.headers.get('content-length'))
  if (!parseUploadKey(key) || !uploadId || !Number.isInteger(part) || part < 1 || part > 10_000) return text(400, 'Not a part of an upload')
  if (!request.body || !(size > 0 && size <= UPLOAD_PART_BYTES)) return text(400, 'A part is 10 MB at most')
  try {
    return Response.json(await env.FILES.resumeMultipartUpload(key!, uploadId).uploadPart(part, request.body))
  } catch {
    return text(404, 'This upload has gone; start it again.')
  }
}

/** POST /api/uploads/complete, JSON { key, uploadId, parts, durationMs }: joins the parts and puts the
 *  file on top of its stack as the next version. Numbered here, so an abandoned upload never leaves a gap. */
export async function completeUpload(request: Request): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  const body = await json(request, Finish)
  const owner = body.success ? parseUploadKey(body.data.key) : null
  if (!body.success || !owner) return text(400, 'Not an upload')
  const { key, uploadId, parts, durationMs: duration } = body.data

  let object: R2Object
  try {
    object = await env.FILES.resumeMultipartUpload(key, uploadId).complete(parts)
  } catch {
    return text(404, 'This upload has gone; start it again.')
  }
  try {
    // One statement takes the next number and claims it, so two finishing at once can't share one.
    const row = await db.get<{ number: number }>(sql`
      INSERT INTO ${versions} (id, track_id, kind, number, r2_key, filename, content_type, size, duration_ms)
      SELECT ${owner.versionId}, ${owner.trackId}, ${owner.kind}, COALESCE(MAX(number), 0) + 1, ${key},
        ${object.customMetadata?.filename ?? 'bounce'}, ${object.httpMetadata?.contentType ?? 'application/octet-stream'}, ${object.size}, ${duration ?? null}
      FROM ${versions} WHERE track_id = ${owner.trackId} AND kind = ${owner.kind}
      RETURNING number`)
    return Response.json({ id: owner.versionId, number: row!.number }, { status: 201 })
  } catch (error) {
    await env.FILES.delete(key) // no file without its row
    throw error
  }
}

/** DELETE /api/uploads?key=…&uploadId=…: drops the parts of an upload that won't finish. */
export async function abortUpload(request: Request): Promise<Response> {
  if (!(await allowed(request))) return text(403, 'Forbidden')
  const { key, uploadId } = ongoing(new URL(request.url))
  if (!parseUploadKey(key) || !uploadId) return text(400, 'Not an upload')
  await env.FILES.resumeMultipartUpload(key!, uploadId).abort().catch(() => {})
  return new Response(null, { status: 204 })
}
