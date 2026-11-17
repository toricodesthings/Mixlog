import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import { accessEmail } from '#/server/access'
import { artistPictureUrl, pictureColumns } from '#/server/artists'
import { db } from '#/server/db'
import { Id, readWith } from '#/server/input'
import type { Instant } from '#/lib/time'
import { artists, settings, versions } from '#/server/schema'
import { DEFAULT_KEEP_DAYS, type KeepDays } from '#/server/shipping'

const KEEP = 'keep_after_release'
const DEFAULT_ARTIST = 'default_artist'
const DISPLAY_NAME = 'display_name'
const stored = (days: KeepDays) => (days === null ? 'forever' : String(days))
const KeepInput = z.union([z.literal(7), z.literal(14), z.literal(30), z.null()], 'Keep them a week, two weeks, a month, or always.')

/** The keep window's row, as a query a batch can take (getRelease's, getSettings'); `keepOf` reads it. */
export const keepQuery = createServerOnlyFn(() => db.select({ value: settings.value }).from(settings).where(eq(settings.key, KEEP)))
/** The keep window from its row: the default until it's chosen. */
export const keepOf = ([row]: { value: string }[]): KeepDays => {
  const parsed = KeepInput.safeParse(row?.value === 'forever' ? null : Number(row?.value))
  return row && parsed.success ? parsed.data : DEFAULT_KEEP_DAYS
}

/** How long what didn't ship is kept after a release goes out; the default until it's chosen. */
export const keepDays = createServerOnlyFn(async (): Promise<KeepDays> => keepOf(await keepQuery()))

const defaultArtistQuery = createServerOnlyFn(() =>
  db.select({ id: artists.id }).from(settings).innerJoin(artists, eq(artists.id, settings.value)).where(eq(settings.key, DEFAULT_ARTIST)),
)

/** The settings the Worker keeps, for the Settings dialog, and when each version waiting to be erased was set aside
 *  (Instants), so the Releases tab can say what a shorter window would erase. One round trip. */
export const getSettings = createServerFn().handler(async () => {
  const [keep, [artist], setAside] = await db.batch([keepQuery(), defaultArtistQuery(), db.select({ at: versions.prunedAt }).from(versions).where(isNotNull(versions.prunedAt))])
  return { keepDays: keepOf(keep), defaultArtist: artist?.id ?? null, setAside: setAside.map((v) => v.at as Instant) }
})

/** Who every new track starts with, alone: the new-release dialog needs only this, not the whole of getSettings. */
export const getDefaultArtist = createServerFn().handler(() => defaultArtist())

export const saveKeepDays = createServerFn({ method: 'POST' })
  .validator(readWith(KeepInput))
  .handler(async ({ data }) => {
    await db.insert(settings).values({ key: KEEP, value: stored(data) }).onConflictDoUpdate({ target: settings.key, set: { value: stored(data) } })
  })

/** The artist every new track starts with (Settings › Releases), or null: none chosen, or they've since been removed. */
export const defaultArtist = createServerOnlyFn(async (): Promise<string | null> => {
  const [row] = await defaultArtistQuery()
  return row?.id ?? null
})

export const saveDefaultArtist = createServerFn({ method: 'POST' })
  .validator(readWith(Id('That artist is not available.').nullable()))
  .handler(async ({ data }) => {
    if (data === null) return void (await db.delete(settings).where(eq(settings.key, DEFAULT_ARTIST)))
    await db.insert(settings).values({ key: DEFAULT_ARTIST, value: data }).onConflictDoUpdate({ target: settings.key, set: { value: data } })
  })

/** Who Mixlog is signed in as, for Settings → Profile & Security: the email Access vouched for (never typed here), the
 *  name they gave (null until they do), and the default artist's face, which is the picture beside it. */
export const getProfile = createServerFn().handler(async () => {
  const [[row], [artist]] = await db.batch([
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, DISPLAY_NAME)),
    db.select({ id: artists.id, name: artists.name, ...pictureColumns }).from(settings).innerJoin(artists, eq(artists.id, settings.value)).where(eq(settings.key, DEFAULT_ARTIST)),
  ])
  return {
    name: (row as { value: string } | undefined)?.value ?? null,
    email: await accessEmail(),
    face: artist ? { id: artist.id, name: artist.name, profile_image_url: artistPictureUrl(artist.id, artist) } : null,
  }
})

/** The name shown for them. Blank clears it, back to the default artist's name, or the email's. */
export const saveDisplayName = createServerFn({ method: 'POST' })
  .validator(readWith(z.string().trim().max(100, 'Names are 100 characters at most.')))
  .handler(async ({ data }) => {
    if (!data) return void (await db.delete(settings).where(eq(settings.key, DISPLAY_NAME)))
    await db.insert(settings).values({ key: DISPLAY_NAME, value: data }).onConflictDoUpdate({ target: settings.key, set: { value: data } })
  })
