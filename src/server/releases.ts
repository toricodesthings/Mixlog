import { notFound } from '@tanstack/react-router'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { isZone, todayIn, type Instant, type LocalDate } from '#/lib/time'
import { Format, LocalDay, Title, detailsInput, type ReleaseFormat } from '#/server/details'
import { db } from '#/server/db'
import { idInput, readWith } from '#/server/input'
import { currentPins, releases, stampNow, tracks, versions } from '#/server/schema'

export type { ReleaseFormat }
export type ReleaseRow = {
  id: string
  title: string
  format: ReleaseFormat
  /** The day it goes out (planned, in Upcoming) or went out (in Releases). */
  release_date: LocalDate | null
  /** Bookkeeping: when it was stamped released. Set means it's under Releases. */
  released_at: Instant | null
  /** Bookkeeping: when it was started; Upcoming shows the day it fell on. */
  created_at: Instant
  track_count: number
  /** The current masters' lengths added up; null until a track has a master with a length. */
  duration_ms: number | null
  /** The current artwork version, or null (the UI draws a monogram). */
  artwork_id: string | null
  upc: string | null
}
export type TrackRow = { id: string; title: string; isrc: string | null; duration_ms: number | null }

/** One file in a stack, for the log and the summary. Track versions carry `track_id`; the artwork carries neither. */
export type VersionRow = {
  id: string
  track_id: string | null
  kind: string
  number: number
  filename: string
  content_type: string
  size: number
  duration_ms: number | null
  note: string | null
  released_at: Instant | null
  created_at: Instant
  /** 1 when it's its stack's current version. */
  is_current: number
}

/** A stack's current version: the pin if there is one, else the newest. `column` is the stack's owner column
 *  (`track_id` or `release_id`), `owner` the outer row's ID it must equal. */
const current = (column: 'track_id' | 'release_id', owner: SQL, kind: string) => sql`COALESCE(
  (SELECT p.version_id FROM ${currentPins} p WHERE p.${sql.raw(column)} = ${owner} AND p.kind = ${kind}),
  (SELECT n.id FROM ${versions} n WHERE n.${sql.raw(column)} = ${owner} AND n.kind = ${kind} ORDER BY n.number DESC LIMIT 1))`

const masterLength = (trackId: SQL) => sql`(SELECT v.duration_ms FROM ${versions} v WHERE v.id = ${current('track_id', trackId, 'master')})`

/** An outer row's column, by its full name. Inside a single-table select Drizzle writes a column bare (`"id"`),
 *  which a correlated subquery would read as its own table's: these must always say whose. */
const outer = (table: 'releases' | 'tracks' | 'versions', column: string) => sql.raw(`"${table}"."${column}"`)

/** Every release query selects this, so lists and pages agree: cover, track count, length. */
// Server-only: the browser imports this file for its server functions, and must never pull in `db`.
export const releaseQuery = createServerOnlyFn(() =>
  db
    .select({
      id: releases.id,
      title: releases.title,
      format: releases.format,
      release_date: releases.releaseDate,
      released_at: releases.releasedAt,
      created_at: releases.createdAt,
      upc: releases.upc,
      track_count: sql<number>`(SELECT COUNT(*) FROM ${tracks} t WHERE t.release_id = ${outer('releases', 'id')})`,
      duration_ms: sql<number | null>`(SELECT SUM(${masterLength(sql`t.id`)}) FROM ${tracks} t WHERE t.release_id = ${outer('releases', 'id')})`,
      artwork_id: sql<string | null>`${current('release_id', outer('releases', 'id'), 'artwork')}`,
    })
    .from(releases),
)

/** Upcoming: newest started first. Releases: newest out first. The list page re-sorts on this device. */
export const listUpcoming = createServerFn().handler(
  (): Promise<ReleaseRow[]> => releaseQuery().where(isNull(releases.releasedAt)).orderBy(desc(releases.createdAt)),
)

export const listReleased = createServerFn().handler(
  (): Promise<ReleaseRow[]> => releaseQuery().where(isNotNull(releases.releasedAt)).orderBy(desc(releases.releasedAt)),
)

export const getRelease = createServerFn()
  .validator(idInput)
  .handler(async ({ data: id }) => {
    const [release] = await releaseQuery().where(eq(releases.id, id))
    if (!release) throw notFound()
    const ofRelease = db.select({ id: tracks.id }).from(tracks).where(eq(tracks.releaseId, id))
    const [trackRows, versionRows] = await db.batch([
      db
        .select({ id: tracks.id, title: tracks.title, isrc: tracks.isrc, duration_ms: sql<number | null>`${masterLength(outer('tracks', 'id'))}` })
        .from(tracks)
        .where(eq(tracks.releaseId, id))
        .orderBy(tracks.position, tracks.createdAt),
      // Every file the release holds, newest first in each stack: its tracks' versions and its artwork.
      db
        .select({
          id: versions.id,
          track_id: versions.trackId,
          kind: versions.kind,
          number: versions.number,
          filename: versions.filename,
          content_type: versions.contentType,
          size: versions.size,
          duration_ms: versions.durationMs,
          note: versions.note,
          released_at: versions.releasedAt,
          created_at: versions.createdAt,
          is_current: sql<number>`${outer('versions', 'id')} = COALESCE(
            (SELECT p.version_id FROM ${currentPins} p WHERE p.kind = ${outer('versions', 'kind')}
              AND (p.track_id = ${outer('versions', 'track_id')} OR p.release_id = ${outer('versions', 'release_id')})),
            (SELECT n.id FROM ${versions} n WHERE n.kind = ${outer('versions', 'kind')}
              AND (n.track_id = ${outer('versions', 'track_id')} OR n.release_id = ${outer('versions', 'release_id')}) ORDER BY n.number DESC LIMIT 1))`,
        })
        .from(versions)
        .where(or(eq(versions.releaseId, id), inArray(versions.trackId, ofRelease)))
        .orderBy(versions.kind, desc(versions.number)),
    ])
    return { release: release as ReleaseRow, tracks: trackRows as TrackRow[], versions: versionRows as VersionRow[] }
  })

export type NewRelease = { title: string; format: ReleaseFormat; tracks: string[]; releasedOn: LocalDate | null }


/** A release's title and format, and its tracks' titles in order. A single is its one track, named like it.
 *  `releasedOn` adds one that's already out, straight to Releases: a day no later than today in the artist's `zone`. */
export const newReleaseInput: (input: unknown) => NewRelease = readWith(
  z
    .object({ title: Title, format: Format, tracks: z.array(Title).max(100, 'A release has at most 100 tracks.'), releasedOn: LocalDay.nullish(), zone: z.string().optional() })
    .refine((r) => r.releasedOn == null || (isZone(r.zone) && r.releasedOn <= todayIn(r.zone)), 'The release day is a day that has come.')
    .transform((r) => ({ title: r.title, format: r.format, tracks: r.format === 'single' ? [r.title] : r.tracks, releasedOn: r.releasedOn ?? null })),
)

/** Starts a release with its tracks, all in one batch: it's there whole or not at all. Upcoming, unless it's already out. */
export const createRelease = createServerFn({ method: 'POST' })
  .validator(newReleaseInput)
  .handler(async ({ data }) => {
    const id = crypto.randomUUID()
    const trackIds = data.tracks.map(() => crypto.randomUUID())
    // Already out: its day is the release day, and it's stamped released now.
    await db.batch([
      db.insert(releases).values({ id, title: data.title, format: data.format, releaseDate: data.releasedOn, releasedAt: data.releasedOn ? stampNow : null }),
      ...data.tracks.map((title, i) => db.insert(tracks).values({ id: trackIds[i], releaseId: id, position: i + 1, title })),
    ])
    return { id, trackIds }
  })

/** Saves a release's Details in one batch: title, format, its day, UPC, and each track's title and ISRC. */
export const updateRelease = createServerFn({ method: 'POST' })
  .validator(detailsInput)
  .handler(async ({ data }) => {
    const [release] = await db.select({ releasedAt: releases.releasedAt }).from(releases).where(eq(releases.id, data.id))
    if (!release) throw notFound()
    if ((release.releasedAt !== null) !== data.released) throw new Error('This release moved; reload it.')
    const own = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.releaseId, data.id))
    if (data.tracks.some((t) => !own.some((o) => o.id === t.id))) throw new Error('A track here isn’t on this release.')
    if (data.format === 'single' && own.length > 1) throw new Error('A single has one track. Make it an EP to keep them all.')
    await db.batch([
      db.update(releases).set({ title: data.title, format: data.format, releaseDate: data.releaseDate, upc: data.upc }).where(eq(releases.id, data.id)),
      ...data.tracks.map((t) => db.update(tracks).set({ title: t.title, isrc: t.isrc, updatedAt: stampNow }).where(eq(tracks.id, t.id))),
    ])
  })
