import { createServerFn } from '@tanstack/react-start'
import { asc, count, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/server/db'
import { readWith } from '#/server/input'
import { artists, releases, trackArtists, tracks } from '#/server/schema'

export type ArtistRow = {
  id: string
  name: string
  role: string | null
  profile_image_url: string | null
  track_count: number
}

export type ArtistTrack = {
  id: string
  title: string
  release_title: string | null
  role: 'artist' | 'featured'
}

/** Artists are shared across tracks; the management surface is intentionally read-only for now. */
export const listArtists = createServerFn().handler(
  (): Promise<ArtistRow[]> =>
    db
      .select({
        id: artists.id,
        name: artists.name,
        role: artists.role,
        profile_image_key: artists.profileImageKey,
        track_count: count(trackArtists.trackId),
      })
      .from(artists)
      .leftJoin(trackArtists, eq(trackArtists.artistId, artists.id))
      .groupBy(artists.id, artists.name)
      .orderBy(asc(artists.name))
      .then((rows) => rows.map(({ profile_image_key, ...row }) => ({ ...row, profile_image_url: profile_image_key ? artistProfileUrl(row.id) : null }))),
)

const artistInput = readWith(
  z.object({
    name: z.string().trim().min(1, 'Give the artist a name.').max(200, 'Artist names are 200 characters at most.'),
    role: z.string().trim().max(100, 'Roles are 100 characters at most.').nullable(),
  }),
)

export const createArtist = createServerFn({ method: 'POST' })
  .validator(artistInput)
  .handler(async ({ data }) => {
    const id = crypto.randomUUID()
    await db.insert(artists).values({ id, name: data.name, role: data.role || null })
    return { id }
  })

export type ArtistProfile = ArtistRow & { tracks: ArtistTrack[] }

export const getArtist = createServerFn()
  .validator(readWith(z.string().uuid('That artist is not available.')))
  .handler(async ({ data: id }) => {
    const [artist] = await db
      .select({
        id: artists.id,
        name: artists.name,
        role: artists.role,
        profile_image_key: artists.profileImageKey,
        track_count: count(trackArtists.trackId),
      })
      .from(artists)
      .leftJoin(trackArtists, eq(trackArtists.artistId, artists.id))
      .where(eq(artists.id, id))
      .groupBy(artists.id, artists.name, artists.role, artists.profileImageKey)
    if (!artist) throw new Error('Artist not found.')
    const linkedTracks = await db
      .select({
        id: tracks.id,
        title: tracks.title,
        release_title: releases.title,
        role: trackArtists.role,
      })
      .from(trackArtists)
      .innerJoin(tracks, eq(tracks.id, trackArtists.trackId))
      .leftJoin(releases, eq(releases.id, tracks.releaseId))
      .where(eq(trackArtists.artistId, id))
      .orderBy(asc(releases.title), asc(tracks.position), asc(tracks.title))
    const { profile_image_key, ...profile } = artist
    return {
      ...profile,
      profile_image_url: profile_image_key ? artistProfileUrl(artist.id) : null,
      tracks: linkedTracks,
    }
  })

export const updateArtist = createServerFn({ method: 'POST' })
  .validator(
    readWith(
      z.object({
        id: z.string().uuid('That artist is not available.'),
        name: z.string().trim().min(1, 'Give the artist a name.').max(200, 'Artist names are 200 characters at most.'),
        role: z.string().trim().max(100, 'Roles are 100 characters at most.').nullable(),
      }),
    ),
  )
  .handler(async ({ data }) => {
    const updated = await db.update(artists).set({ name: data.name, role: data.role || null }).where(eq(artists.id, data.id)).returning({ id: artists.id })
    if (!updated.length) throw new Error('Artist not found.')
  })

export const artistProfileUrl = (id: string) => `/api/artists/${id}/profile`
