import { createServerFn } from '@tanstack/react-start'
import { asc, count, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/server/db'
import { Id, Refusal, readWith } from '#/server/input'
import { TRACK_ARTIST_ROLES, artists, releases, trackArtists, tracks } from '#/server/schema'

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
  release_id: string | null
  release_title: string | null
  release_format: 'single' | 'ep' | 'album' | null
  released_at: string | null
  role: TrackArtistRole
}

export type TrackArtistRole = (typeof TRACK_ARTIST_ROLES)[number]
/** An artist on a track, in credit order: main artists first, then featured. */
export type TrackArtist = { track_id: string; id: string; name: string; role: TrackArtistRole; profile_image_url: string | null }

/** Every artist, A to Z, with how many tracks they're on. */
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
      .then((rows) => rows.map(({ profile_image_key, ...row }) => ({ ...row, profile_image_url: profile_image_key ? artistProfileUrl(row.id, profile_image_key) : null }))),
)

/** A link the artist pasted: https only, with the scheme added when it's left off. */
const Link = z
  .string()
  .trim()
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .pipe(z.string().url('That link doesn’t look right.').max(300, 'Links are 300 characters at most.').refine((v) => v.startsWith('https://'), 'Links start with https://.'))

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

export type ArtistProfile = ArtistRow & { links: string[]; tracks: ArtistTrack[] }

export const getArtist = createServerFn()
  .validator(readWith(z.string().uuid('That artist is not available.')))
  .handler(async ({ data: id }) => {
    const [artist] = await db
      .select({
        id: artists.id,
        name: artists.name,
        role: artists.role,
        links: artists.links,
        profile_image_key: artists.profileImageKey,
        track_count: count(trackArtists.trackId),
      })
      .from(artists)
      .leftJoin(trackArtists, eq(trackArtists.artistId, artists.id))
      .where(eq(artists.id, id))
      .groupBy(artists.id, artists.name, artists.role, artists.links, artists.profileImageKey)
    if (!artist) throw new Error('Artist not found.')
    const linkedTracks = await db
      .select({
        id: tracks.id,
        title: tracks.title,
        release_id: releases.id,
        release_title: releases.title,
        release_format: releases.format,
        released_at: releases.releasedAt,
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
      links: profile.links ?? [],
      profile_image_url: profile_image_key ? artistProfileUrl(artist.id, profile_image_key) : null,
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
        links: z.array(Link).max(12, 'Twelve links at most.'),
      }),
    ),
  )
  .handler(async ({ data }) => {
    const updated = await db.update(artists).set({ name: data.name, role: data.role || null, links: [...new Set(data.links)] }).where(eq(artists.id, data.id)).returning({ id: artists.id })
    if (!updated.length) throw new Error('Artist not found.')
  })

/** Where an artist's picture is served, named by its key so a new picture is never the cached old one. */
export const artistProfileUrl = (id: string, key: string) => `/api/artists/${id}/profile?v=${key.slice(-8)}`

/** A track's artists, saved whole (the picker's Done): main artists first, then featured, each in the order
 *  given. One batch, so a track's artists are never half-written. */
export const setTrackArtists = createServerFn({ method: 'POST' })
  .validator(
    readWith(
      z.object({
        trackId: Id('Not a track.'),
        artists: z.array(z.object({ id: Id('That artist is not available.'), role: z.enum(TRACK_ARTIST_ROLES) })).max(50, 'A track has at most 50 artists.'),
      }),
    ),
  )
  .handler(async ({ data }) => {
    const [track] = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, data.trackId))
    if (!track) throw new Refusal('That track is not available.')
    const ordered = [...data.artists.filter((a) => a.role === 'artist'), ...data.artists.filter((a) => a.role === 'featured')]
    if (new Set(ordered.map((a) => a.id)).size !== ordered.length) throw new Refusal('An artist is on a track once.')
    await db.batch([
      db.delete(trackArtists).where(eq(trackArtists.trackId, data.trackId)),
      ...ordered.map((a, i) => db.insert(trackArtists).values({ trackId: data.trackId, artistId: a.id, role: a.role, position: i + 1 })),
    ])
  })
