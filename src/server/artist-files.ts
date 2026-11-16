import { env } from 'cloudflare:workers'
import { notFound } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { allowed } from '#/server/access'
import { artworkProblem, artistProfileKey } from '#/server/files'
import { db } from '#/server/db'
import { isId } from '#/server/input'
import { artists } from '#/server/schema'

export async function addArtistProfile(request: Request, artistId: string): Promise<Response> {
  if (!(await allowed(request))) return new Response('Forbidden', { status: 403 })
  if (!isId(artistId)) return new Response('Not found', { status: 404 })
  const contentType = request.headers.get('content-type')
  const size = Number(request.headers.get('content-length'))
  const problem = artworkProblem(contentType, size)
  if (problem) return new Response(problem, { status: 400 })
  if (!request.body) return new Response('No image', { status: 400 })
  const [artist] = await db.select({ id: artists.id, oldKey: artists.profileImageKey }).from(artists).where(eq(artists.id, artistId))
  if (!artist) return new Response('Not found', { status: 404 })
  const key = artistProfileKey(artistId, crypto.randomUUID())
  await env.FILES.put(key, request.body, { httpMetadata: { contentType: contentType! } })
  try {
    await db.update(artists).set({ profileImageKey: key, profileImageType: contentType, profileImageSize: size }).where(eq(artists.id, artistId))
  } catch (error) {
    await env.FILES.delete(key)
    throw error
  }
  if (artist.oldKey) await env.FILES.delete(artist.oldKey)
  return Response.json({ url: `/api/artists/${artistId}/profile` }, { status: 201 })
}

export async function serveArtistProfile(request: Request, artistId: string): Promise<Response> {
  if (!(await allowed(request))) return new Response('Forbidden', { status: 403 })
  if (!isId(artistId)) return new Response('Not found', { status: 404 })
  const [artist] = await db.select({ key: artists.profileImageKey, type: artists.profileImageType }).from(artists).where(eq(artists.id, artistId))
  if (!artist?.key) throw notFound()
  const object = await env.FILES.get(artist.key)
  if (!object) throw notFound()
  return new Response(object.body, { headers: { 'content-type': artist.type ?? object.httpMetadata?.contentType ?? 'application/octet-stream', 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } })
}
