import { notFound } from '@tanstack/react-router'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { isZone, todayIn, type Instant, type LocalDate } from '#/lib/time'
import { Format, LocalDay, Title, detailsInput, type ReleaseFormat, type TrackOrigin } from '#/server/details'
import { db } from '#/server/db'
import { AUDIO_KINDS } from '#/server/files'
import { Id, idInput, readWith, Refusal } from '#/server/input'
import { analysisInput, fingerprintOf, isMeasured, type Analysis, type Fingerprint, type Measured } from '#/server/loudness'
import { currentPins, releases, stampNow, tracks, versions } from '#/server/schema'
import { keepDays } from '#/server/settings'
import { LANES, lanesOf, moveProblem } from '#/server/lanes'
import { moveBackWindow, prunedOf, shippedOf } from '#/server/shipping'

export type { ReleaseFormat, TrackOrigin }
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
  /** Each track's length (its final, else newest master, else newest mix) added up; null until one has a length. */
  duration_ms: number | null
  /** The current artwork version, or null (the UI draws a monogram). */
  artwork_id: string | null
  upc: string | null
  /** Its night (1.3.0): its first measured song's fingerprint; null before anything's measured. An EP or album's own. */
  scene: Fingerprint | null
}
export type TrackRow = { id: string; title: string; isrc: string | null; lyrics: string | null; origin: TrackOrigin; duration_ms: number | null; scene: Fingerprint | null }

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
  /** What the meter read; null until it's measured. */
  analysis: Analysis | null
  released_at: Instant | null
  created_at: Instant
  /** 1 when it's its stack's current version. */
  is_current: number
  /** 1 when it's its track's final: the master the artist filed in the Final lane. */
  is_final: number
}

/** A stack's current version: the pin if there is one, else the newest not pruned. `column` is the stack's owner
 *  column (`track_id` or `release_id`), `owner` the outer row's ID it must equal. */
const current = (column: 'track_id' | 'release_id', owner: SQL, kind: string) => sql`COALESCE(
  (SELECT p.version_id FROM ${currentPins} p WHERE p.${sql.raw(column)} = ${owner} AND p.kind = ${kind}),
  (SELECT n.id FROM ${versions} n WHERE n.${sql.raw(column)} = ${owner} AND n.kind = ${kind} AND n.pruned_at IS NULL ORDER BY n.number DESC LIMIT 1))`

/** How long a track plays: what `playOf` plays (lanes.ts), the final, else the newest master, else the newest mix. */
const playLength = (trackId: SQL) => sql`(SELECT v.duration_ms FROM ${versions} v WHERE v.id = COALESCE(
  (SELECT p.version_id FROM ${currentPins} p WHERE p.track_id = ${trackId} AND p.kind = 'master'),
  (SELECT n.id FROM ${versions} n WHERE n.track_id = ${trackId} AND n.kind IN ('master', 'mix') AND n.pruned_at IS NULL
    ORDER BY n.kind = 'master' DESC, n.number DESC LIMIT 1)))`

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
      scene: releases.scene,
      track_count: sql<number>`(SELECT COUNT(*) FROM ${tracks} t WHERE t.release_id = ${outer('releases', 'id')})`,
      duration_ms: sql<number | null>`(SELECT SUM(${playLength(sql`t.id`)}) FROM ${tracks} t WHERE t.release_id = ${outer('releases', 'id')})`,
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

const tracksOf = (releaseId: string) => db.select({ id: tracks.id }).from(tracks).where(eq(tracks.releaseId, releaseId))

/** Every file a release holds that isn't pruned, newest first in each stack: its tracks' versions and its artwork,
 *  each with whether it's its stack's current one. */
const versionsOf = createServerOnlyFn((id: string) =>
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
      analysis: versions.analysis,
      released_at: versions.releasedAt,
      created_at: versions.createdAt,
      is_current: sql<number>`${outer('versions', 'id')} = COALESCE(
        (SELECT p.version_id FROM ${currentPins} p WHERE p.kind = ${outer('versions', 'kind')}
          AND (p.track_id = ${outer('versions', 'track_id')} OR p.release_id = ${outer('versions', 'release_id')})),
        (SELECT n.id FROM ${versions} n WHERE n.kind = ${outer('versions', 'kind')} AND n.pruned_at IS NULL
          AND (n.track_id = ${outer('versions', 'track_id')} OR n.release_id = ${outer('versions', 'release_id')}) ORDER BY n.number DESC LIMIT 1))`,
      is_final: sql<number>`${outer('versions', 'kind')} = 'master' AND EXISTS (SELECT 1 FROM ${currentPins} p WHERE p.version_id = ${outer('versions', 'id')} AND p.kind = 'master')`,
    })
    .from(versions)
    .where(and(or(eq(versions.releaseId, id), inArray(versions.trackId, tracksOf(id))), isNull(versions.prunedAt)))
    .orderBy(versions.kind, desc(versions.number)),
)

export const getRelease = createServerFn()
  .validator(idInput)
  .handler(async ({ data: id }) => {
    const [release] = await releaseQuery().where(eq(releases.id, id))
    if (!release) throw notFound()
    const [[trackRows, versionRows, [{ pruned }]], keep] = await Promise.all([
      db.batch([
        db
          .select({ id: tracks.id, title: tracks.title, isrc: tracks.isrc, lyrics: tracks.lyrics, origin: tracks.origin, scene: tracks.scene, duration_ms: sql<number | null>`${playLength(outer('tracks', 'id'))}` })
          .from(tracks)
          .where(eq(tracks.releaseId, id))
          .orderBy(tracks.position, tracks.createdAt),
        versionsOf(id),
        db.select({ pruned: sql<number>`COUNT(*)` }).from(versions).where(and(inArray(versions.trackId, tracksOf(id)), isNotNull(versions.prunedAt))),
      ]),
      keepDays(),
    ])
    // A song measured before 1.3.0 gets its night the first time its release opens, not the next night's cron.
    if (trackRows.some((t) => !t.scene) && (await stampScenes(trackRows.length, id)) > 0) {
      const stamped = await db.select({ id: tracks.id, scene: tracks.scene }).from(tracks).where(eq(tracks.releaseId, id))
      for (const t of trackRows) t.scene = stamped.find((s) => s.id === t.id)?.scene ?? null
      const [own] = await db.select({ scene: releases.scene }).from(releases).where(eq(releases.id, id))
      release.scene = own?.scene ?? null
    }
    return {
      release: release as ReleaseRow,
      tracks: trackRows as TrackRow[],
      versions: versionRows as VersionRow[],
      /** Versions pruned when it moved to Releases, still waiting out the keep window. */
      pruned,
      /** How long what didn't ship is kept after release (Settings → Releases); null keeps everything. */
      keepDays: keep,
    }
  })

type NewRelease = { title: string; format: ReleaseFormat; tracks: string[]; releasedOn: LocalDate | null }


/** A release's title and format, and its tracks' titles in order. A single is its one track, named like it.
 *  `releasedOn` adds one that's already out, straight to Releases: a day no later than today in the artist's `zone`. */
const newReleaseInput: (input: unknown) => NewRelease = readWith(
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

/** Saves a release's Details in one batch: title, format, its day, UPC, and each track's title, ISRC and origin. */
export const updateRelease = createServerFn({ method: 'POST' })
  .validator(detailsInput)
  .handler(async ({ data }) => {
    const [release] = await db.select({ releasedAt: releases.releasedAt }).from(releases).where(eq(releases.id, data.id))
    if (!release) throw notFound()
    if ((release.releasedAt !== null) !== data.released) throw new Refusal('This release moved; reload it.')
    const own = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.releaseId, data.id))
    if (data.tracks.some((t) => !own.some((o) => o.id === t.id))) throw new Refusal('A track here isn’t on this release.')
    if (data.format === 'single' && own.length > 1) throw new Refusal('A single has one track. Make it an EP to keep them all.')
    await db.batch([
      db.update(releases).set({ title: data.title, format: data.format, releaseDate: data.releaseDate, upc: data.upc }).where(eq(releases.id, data.id)),
      ...data.tracks.map((t) => db.update(tracks).set({ title: t.title, isrc: t.isrc, origin: t.origin, updatedAt: stampNow }).where(eq(tracks.id, t.id))),
    ])
  })

/** Files a mix or master in a lane: Mixes, Masters or Final (lanes.ts has the rules, shared with the page). Moving keeps
 *  the file and its number; only `kind` and the final pin change, in one batch. In Releases the one move is giving a
 *  track without a final its final, which ships the track: stamped, pinned, and the rest of it set aside. */
export const fileVersion = createServerFn({ method: 'POST' })
  .validator(readWith(z.object({ versionId: Id(), to: z.enum(LANES, 'That isn’t a lane.') })))
  .handler(async ({ data: { versionId, to } }) => {
    const [version] = await db
      .select({ trackId: versions.trackId, kind: versions.kind, content_type: versions.contentType, released: releases.releasedAt, is_final: finalOf(versions.id) })
      .from(versions)
      .innerJoin(tracks, eq(tracks.id, versions.trackId))
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .where(and(eq(versions.id, versionId), isNull(versions.prunedAt)))
    if (!version) throw notFound()
    const problem = moveProblem(version, to, version.released ? 'released' : 'upcoming')
    if (problem) throw new Refusal(problem)
    const trackId = version.trackId!
    const kind = to === 'mix' ? 'mix' : 'master'
    if (version.released) {
      if (await hasFinal(trackId)) throw new Refusal('This track has its final. Replace it instead.')
      return void (await db.batch([db.update(versions).set({ kind, releasedAt: stampNow }).where(eq(versions.id, versionId)), ...pin(trackId, 'master', versionId), setAsideRest(trackId, versionId)]))
    }
    await db.batch([
      db.update(versions).set({ kind }).where(eq(versions.id, versionId)),
      ...(to === 'final' ? pin(trackId, 'master', versionId) : [db.delete(currentPins).where(eq(currentPins.versionId, versionId))]),
    ])
  })

/** 1 when a version is pinned as its track's final. */
const finalOf = (id: SQL | typeof versions.id) => sql<number>`EXISTS (SELECT 1 FROM ${currentPins} p WHERE p.version_id = ${id} AND p.kind = 'master')`

/** Whether a track has its final. */
export const hasFinal = createServerOnlyFn(async (trackId: string) =>
  Boolean((await db.select({ id: currentPins.versionId }).from(currentPins).where(and(eq(currentPins.trackId, trackId), eq(currentPins.kind, 'master'))))[0]),
)

/** Pins `versionId` as its track's `kind` (a master pin is the final), unpinning whatever held it. */
export const pin = createServerOnlyFn((trackId: string, kind: string, versionId: string) =>
  [unpin({ trackId, releaseId: null, kind }), db.insert(currentPins).values({ versionId, trackId, kind })] as const,
)

/** Sets aside everything on a released track that didn't ship but `versionId` (which is shipping now). */
export const setAsideRest = createServerOnlyFn((trackId: string, versionId: string) =>
  db
    .update(versions)
    .set({ prunedAt: stampNow })
    .where(and(eq(versions.trackId, trackId), ne(versions.id, versionId), isNull(versions.releasedAt), isNull(versions.prunedAt), ne(versions.kind, 'license'))),
)

const unpin = (stack: { trackId: string | null; releaseId: string | null; kind: string }) =>
  db.delete(currentPins).where(and(stack.trackId ? eq(currentPins.trackId, stack.trackId) : eq(currentPins.releaseId, stack.releaseId!), eq(currentPins.kind, stack.kind)))

/** D1 binds at most 100 values a statement: long ID lists go in slices. */
const slices = (ids: string[]) => Array.from({ length: Math.ceil(ids.length / 90) }, (_, i) => ids.slice(i * 90, i * 90 + 90))

/** Stamps a release out: its day, and the Released stamp on the release and on what shipped (each track's final and
 *  the current version of its other stacks, each pinned so it stays current). Everything else on its tracks (other
 *  masters, every mix) is set aside: hidden now, so Releases shows only what shipped, and erased by the cleanup cron
 *  after the keep window (never, when Settings keeps everything). One batch. */
export const shipRelease = createServerOnlyFn(async (id: string, releasedOn: LocalDate) => {
  const [release] = await db.select({ releasedAt: releases.releasedAt }).from(releases).where(eq(releases.id, id))
  if (!release) throw notFound()
  if (release.releasedAt) throw new Refusal('This release is already out.')
  const [trackRows, rows] = await db.batch([tracksOf(id).orderBy(tracks.position), versionsOf(id)])
  const missing = trackRows.find((t) => !lanesOf(t.id, rows as VersionRow[]).final)
  if (missing) throw new Refusal('Every track needs its final, a WAV, AIFF or FLAC, before it goes out.')
  const shipped = rows.filter((v) => shippedOf(rows as VersionRow[]).includes(v.id))
  const pruned = prunedOf(rows as VersionRow[])
  await db.batch([
    db.update(releases).set({ releasedAt: stampNow, releaseDate: releasedOn }).where(eq(releases.id, id)),
    ...slices(shipped.map((v) => v.id)).map((ids) => db.update(versions).set({ releasedAt: stampNow }).where(inArray(versions.id, ids))),
    ...slices(pruned).map((ids) => db.update(versions).set({ prunedAt: stampNow }).where(inArray(versions.id, ids))),
    ...shipped.flatMap((v) => [unpin({ trackId: v.track_id, releaseId: null, kind: v.kind }), db.insert(currentPins).values({ versionId: v.id, trackId: v.track_id, kind: v.kind })]),
  ])
})

/** Back to Upcoming, inside the keep window only: the stamps come off and every pruned version is back. */
export const unshipRelease = createServerOnlyFn(async (id: string, now = Date.now()) => {
  const [release] = await db.select({ releasedAt: releases.releasedAt }).from(releases).where(eq(releases.id, id))
  if (!release) throw notFound()
  if (!release.releasedAt) throw new Refusal('This release is already in Upcoming.')
  if (!moveBackWindow(release.releasedAt, await keepDays(), now)) throw new Refusal('Its older versions are erased now, so it stays in Releases.')
  await db.batch([
    db.update(releases).set({ releasedAt: null }).where(eq(releases.id, id)),
    db.update(versions).set({ releasedAt: null, prunedAt: null }).where(or(eq(versions.releaseId, id), inArray(versions.trackId, tracksOf(id)))),
  ])
})

/** A song's first measured mix or master stamps its track's and its release's night (1.3.0), each `WHERE scene IS
 *  NULL` so a later bounce, a meter bump or a move never redraws it. One batch; a no-op once both are set. */
const stampScene = (trackId: string, analysis: Measured) => {
  const fp = fingerprintOf(analysis)
  return [
    db.update(tracks).set({ scene: fp }).where(and(eq(tracks.id, trackId), isNull(tracks.scene))),
    db.update(releases).set({ scene: fp }).where(and(isNull(releases.scene), sql`${releases.id} = (SELECT ${tracks.releaseId} FROM ${tracks} WHERE ${tracks.id} = ${trackId})`)),
  ] as const
}

/** Writes a version's analysis when it has none, or only one from an older meter: a late upload result, Measure, the
 *  cron. Never on a pruned version or one that isn't audio. A measured mix or master also stamps its scene (above).
 *  True when it wrote. */
export const storeAnalysis = createServerOnlyFn(async (versionId: string, analysis: Analysis): Promise<boolean> => {
  const written = await db
    .update(versions)
    .set({ analysis })
    .where(and(
      eq(versions.id, versionId), isNull(versions.prunedAt), inArray(versions.kind, AUDIO_KINDS),
      sql`(${versions.analysis} IS NULL OR json_extract(${versions.analysis}, '$.meter') < ${analysis.meter})`,
    ))
    .returning({ id: versions.id, trackId: versions.trackId, kind: versions.kind })
  const row = written[0]
  if (row?.trackId && isMeasured(analysis) && (row.kind === 'mix' || row.kind === 'master')) await db.batch([...stampScene(row.trackId, analysis)])
  return written.length > 0
})

export const saveAnalysis = createServerFn({ method: 'POST' })
  .validator(readWith(z.object({ versionId: Id(), analysis: analysisInput })))
  .handler(async ({ data }) => {
    await storeAnalysis(data.versionId, data.analysis)
  })

/** Backfills nights for tracks from before 1.3.0 (the cron, after measuring): for each with no scene yet but a
 *  measured mix or master, stamps it (and its release) from the oldest one still in D1 — pruned included, since
 *  those keep their `analysis` until erased. Same rule as `storeAnalysis`, just later. Up to `limit` tracks a run, or
 *  only `releaseId`'s (opening a release stamps its own, so nobody waits for the night); returns how many it stamped. */
export const stampScenes = createServerOnlyFn(async (limit = 20, releaseId?: string): Promise<number> => {
  const due = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(and(
      isNull(tracks.scene),
      releaseId ? eq(tracks.releaseId, releaseId) : undefined,
      sql`EXISTS (SELECT 1 FROM ${versions} v WHERE v.track_id = ${tracks.id} AND v.kind IN ('mix', 'master') AND v.analysis IS NOT NULL)`,
    ))
    .orderBy(asc(tracks.createdAt))
    .limit(limit)
  let stamped = 0
  for (const { id } of due) {
    const [oldest] = await db
      .select({ analysis: versions.analysis })
      .from(versions)
      .where(and(eq(versions.trackId, id), inArray(versions.kind, ['mix', 'master']), isNotNull(versions.analysis)))
      .orderBy(asc(versions.createdAt))
      .limit(1)
    if (oldest?.analysis && isMeasured(oldest.analysis)) {
      await db.batch([...stampScene(id, oldest.analysis)])
      stamped++
    }
  }
  return stamped
})

/** Move to Releases, from the release's Move dialog: the day it went out, no later than today in the artist's `zone`. */
export const moveToReleases = createServerFn({ method: 'POST' })
  .validator(
    readWith(
      z
        .object({ id: Id(), releasedOn: LocalDay, zone: z.string() })
        .refine((r) => isZone(r.zone) && r.releasedOn <= todayIn(r.zone), 'The release day is a day that has come.'),
    ),
  )
  .handler(({ data }) => shipRelease(data.id, data.releasedOn))

/** Move back to Upcoming, while the keep window is open. */
export const moveToUpcoming = createServerFn({ method: 'POST' })
  .validator(idInput)
  .handler(({ data: id }) => unshipRelease(id))
