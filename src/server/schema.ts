// The D1 schema, the source of truth: tables, checks and indexes. `pnpm db:generate` writes the migration from a change
// here; never hand-write one. The product model from the manifesto: Release, Track, Version, Note, plus Details.
// Times are ISO-8601 UTC text, days `YYYY-MM-DD` (see lib/time.ts). IDs are crypto.randomUUID().
import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** Now, as the bookkeeping Instant D1 writes (ISO 8601 UTC): for defaults, and for a stamp set in a write. */
export const stampNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
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

// A track is valid with only a title; everything else is optional.
export const tracks = sqliteTable('tracks', {
  id: text('id').primaryKey(),
  releaseId: text('release_id').references(() => releases.id, { onDelete: 'set null' }),
  position: integer('position'),
  title: text('title').notNull(),
  isrc: text('isrc'),
  lyrics: text('lyrics'),
  credits: text('credits'), // JSON: [{ "role": "Producer", "name": "…" }]
  createdAt: createdAt(),
  updatedAt: text('updated_at').notNull().default(stampNow),
})

export const VERSION_KINDS = ['mix', 'master', 'instrumental', 'acapella', 'stems', 'artwork', 'canvas', 'video', 'other'] as const

// One immutable file. Belongs to a track, or to a release (artwork, release video).
// Rows are never updated except released_at; files are never overwritten.
export const versions = sqliteTable(
  'versions',
  {
    id: text('id').primaryKey(),
    trackId: text('track_id').references(() => tracks.id, { onDelete: 'cascade' }),
    releaseId: text('release_id').references(() => releases.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: VERSION_KINDS }).notNull(),
    number: integer('number').notNull(), // per stack: Master v4
    r2Key: text('r2_key').notNull().unique(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    durationMs: integer('duration_ms'),
    note: text('note'), // one line: what changed
    releasedAt: text('released_at'), // the Released stamp
    createdAt: createdAt(),
  },
  (t) => [
    check('versions_kind', sql`${t.kind} IN ('mix', 'master', 'instrumental', 'acapella', 'stems', 'artwork', 'canvas', 'video', 'other')`),
    check('versions_owner', sql`(${t.trackId} IS NULL) <> (${t.releaseId} IS NULL)`),
    uniqueIndex('versions_track_stack').on(t.trackId, t.kind, t.number).where(sql`${t.trackId} IS NOT NULL`),
    uniqueIndex('versions_release_stack').on(t.releaseId, t.kind, t.number).where(sql`${t.releaseId} IS NOT NULL`),
  ],
)

// Newest ≠ Current. Current follows newest unless a row here points it elsewhere.
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
