// The D1 schema, the source of truth: tables, checks and indexes. `pnpm db:generate` writes the migration from a change
// here; never hand-write one. The product model from the manifesto: Release, Track, Version, Note, plus Details.
// Times are ISO-8601 UTC text, days `YYYY-MM-DD` (see lib/time.ts). IDs are crypto.randomUUID().
import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** The one way an Instant is written (ISO 8601 UTC with milliseconds, `2026-11-03T02:14:09.512Z`): now, or `days`
 *  before it. Every stamp, default and cutoff goes through here, so `lib/time.ts` reads one format everywhere. */
export const stamp = (days = 0) => (days ? sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ${`-${days} days`}))` : sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
/** Now, as an Instant: for defaults, and for a stamp set in a write. */
export const stampNow = stamp()
const createdAt = () => text('created_at').notNull().default(stampNow)

export const releases = sqliteTable(
  'releases',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    format: text('format', { enum: ['single', 'ep', 'album'] }).notNull().default('single'),
    releaseDate: text('release_date'),
    upc: text('upc'),
    createdAt: createdAt(),
    // Released is a stamp: set when a release goes out, it moves from Upcoming to Releases.
    releasedAt: text('released_at'),
  },
  (t) => [check('releases_format', sql`${t.format} IN ('single', 'ep', 'album')`)],
)

export const TRACK_ORIGINS = ['original', 'cover', 'remix'] as const

// A track is valid with only a title; everything else is optional.
export const tracks = sqliteTable('tracks', {
  id: text('id').primaryKey(),
  releaseId: text('release_id').references(() => releases.id, { onDelete: 'set null' }),
  position: integer('position'),
  title: text('title').notNull(),
  isrc: text('isrc'),
  lyrics: text('lyrics'),
  // Whose song it is: the artist's own, a cover of someone's, or a remix of one. A cover or remix carries its license.
  origin: text('origin', { enum: TRACK_ORIGINS }).notNull().default('original'),
  credits: text('credits'), // JSON: [{ "role": "Producer", "name": "…" }]
  createdAt: createdAt(),
  updatedAt: text('updated_at').notNull().default(stampNow),
})

export const VERSION_KINDS = ['mix', 'master', 'instrumental', 'acapella', 'stems', 'artwork', 'canvas', 'video', 'license', 'other'] as const

// One immutable file. Belongs to a track (bounces, its license), or to a release (artwork, release video).
// Rows are never updated except released_at, pruned_at, and kind between mix and master (moving a bounce between
// lanes); files are never overwritten. A track's mixes and masters share one number sequence, so a move keeps it.
export const versions = sqliteTable(
  'versions',
  {
    id: text('id').primaryKey(),
    trackId: text('track_id').references(() => tracks.id, { onDelete: 'cascade' }),
    releaseId: text('release_id').references(() => releases.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: VERSION_KINDS }).notNull(),
    number: integer('number').notNull(), // per song for mixes and masters (Mix v2, Master v3), else per stack
    r2Key: text('r2_key').notNull().unique(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    durationMs: integer('duration_ms'),
    note: text('note'), // one line: what changed
    releasedAt: text('released_at'), // the Released stamp
    // Moving a release to Releases prunes what didn't ship: hidden at once, erased by the cleanup cron after the grace
    // window (shipping.ts), and unstamped if the release moves back to Upcoming before then.
    prunedAt: text('pruned_at'),
    createdAt: createdAt(),
  },
  (t) => [
    check('versions_kind', sql`${t.kind} IN ('mix', 'master', 'instrumental', 'acapella', 'stems', 'artwork', 'canvas', 'video', 'license', 'other')`),
    check('versions_owner', sql`(${t.trackId} IS NULL) <> (${t.releaseId} IS NULL)`),
    uniqueIndex('versions_track_bounce').on(t.trackId, t.number).where(sql`${t.trackId} IS NOT NULL AND ${t.kind} IN ('mix', 'master')`),
    uniqueIndex('versions_track_stack').on(t.trackId, t.kind, t.number).where(sql`${t.trackId} IS NOT NULL AND ${t.kind} NOT IN ('mix', 'master')`),
    uniqueIndex('versions_release_stack').on(t.releaseId, t.kind, t.number).where(sql`${t.releaseId} IS NOT NULL`),
  ],
)

// Newest ≠ Current. Current follows newest unless a row here points it elsewhere. A track's master pin is its final:
// lossless, and set only by the artist (filing a version in the Final lane).
export const currentPins = sqliteTable(
  'current_pins',
  {
    versionId: text('version_id').notNull().references(() => versions.id, { onDelete: 'cascade' }),
    trackId: text('track_id').references(() => tracks.id, { onDelete: 'cascade' }),
    releaseId: text('release_id').references(() => releases.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
  },
  (t) => [
    check('current_pins_owner', sql`(${t.trackId} IS NULL) <> (${t.releaseId} IS NULL)`),
    uniqueIndex('current_pins_track').on(t.trackId, t.kind).where(sql`${t.trackId} IS NOT NULL`),
    uniqueIndex('current_pins_release').on(t.releaseId, t.kind).where(sql`${t.releaseId} IS NOT NULL`),
  ],
)

// A thought about a version, at a moment (at_ms) or about the whole file (NULL).
export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    versionId: text('version_id').notNull().references(() => versions.id, { onDelete: 'cascade' }),
    atMs: integer('at_ms'),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('notes_version').on(t.versionId, t.atMs)],
)

// The artist's choices the Worker itself must know (the cleanup cron reads them), one row each. Per-device ones
// (theme, motion) stay in the browser. A missing row is the default.
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
