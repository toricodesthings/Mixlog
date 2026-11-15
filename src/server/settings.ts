import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/server/db'
import { Id, readWith } from '#/server/input'
import type { Instant } from '#/lib/time'
import { artists, settings, versions } from '#/server/schema'
import { DEFAULT_KEEP_DAYS, type KeepDays } from '#/server/shipping'

const KEEP = 'keep_after_release'
const DEFAULT_ARTIST = 'default_artist'
const stored = (days: KeepDays) => (days === null ? 'forever' : String(days))
const KeepInput = z.union([z.literal(7), z.literal(14), z.literal(30), z.null()], 'Keep them a week, two weeks, a month, or always.')

/** How long what didn't ship is kept after a release goes out; the default until it's chosen. */
export const keepDays = createServerOnlyFn(async (): Promise<KeepDays> => {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, KEEP))
  const parsed = KeepInput.safeParse(row?.value === 'forever' ? null : Number(row?.value))
  return row && parsed.success ? parsed.data : DEFAULT_KEEP_DAYS
})

/** The settings the Worker keeps, for the Settings dialog, and when each version waiting to be erased was set aside
 *  (Instants), so the Releases tab can say what a shorter window would erase. */
export const getSettings = createServerFn().handler(async () => ({
  keepDays: await keepDays(),
  defaultArtist: await defaultArtist(),
  setAside: (await db.select({ at: versions.prunedAt }).from(versions).where(isNotNull(versions.prunedAt))).map((v) => v.at as Instant),
}))

export const saveKeepDays = createServerFn({ method: 'POST' })
  .validator(readWith(KeepInput))
  .handler(async ({ data }) => {
    await db.insert(settings).values({ key: KEEP, value: stored(data) }).onConflictDoUpdate({ target: settings.key, set: { value: stored(data) } })
  })

/** The artist every new track starts with (Settings › Releases), or null: none chosen, or they've since been removed. */
export const defaultArtist = createServerOnlyFn(async (): Promise<string | null> => {
  const [row] = await db.select({ id: artists.id }).from(settings).innerJoin(artists, eq(artists.id, settings.value)).where(eq(settings.key, DEFAULT_ARTIST))
  return row?.id ?? null
})

export const saveDefaultArtist = createServerFn({ method: 'POST' })
  .validator(readWith(Id('That artist is not available.').nullable()))
  .handler(async ({ data }) => {
    if (data === null) return void (await db.delete(settings).where(eq(settings.key, DEFAULT_ARTIST)))
    await db.insert(settings).values({ key: DEFAULT_ARTIST, value: data }).onConflictDoUpdate({ target: settings.key, set: { value: data } })
  })
