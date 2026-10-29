-- The product model from the manifesto: Release, Track, Version, Note, plus Details.
-- Times are ISO-8601 UTC text. IDs are crypto.randomUUID().

CREATE TABLE releases (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  format       TEXT NOT NULL DEFAULT 'single' CHECK (format IN ('single', 'ep', 'album')),
  release_date TEXT,
  upc          TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A track is valid with only a title; everything else is optional.
CREATE TABLE tracks (
  id         TEXT PRIMARY KEY,
  release_id TEXT REFERENCES releases (id) ON DELETE SET NULL,
  position   INTEGER,
  title      TEXT NOT NULL,
  isrc       TEXT,
  lyrics     TEXT,
  credits    TEXT, -- JSON: [{ "role": "Producer", "name": "…" }]
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One immutable file. Belongs to a track, or to a release (artwork, release video).
-- Rows are never updated except released_at; files are never overwritten.
CREATE TABLE versions (
  id           TEXT PRIMARY KEY,
  track_id     TEXT REFERENCES tracks (id) ON DELETE CASCADE,
  release_id   TEXT REFERENCES releases (id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('mix', 'master', 'instrumental', 'acapella', 'stems', 'artwork', 'canvas', 'video', 'other')),
  number       INTEGER NOT NULL, -- per stack: Master v4
  r2_key       TEXT NOT NULL UNIQUE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size         INTEGER NOT NULL,
  duration_ms  INTEGER,
  note         TEXT, -- one line: what changed
  released_at  TEXT, -- the Released stamp
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((track_id IS NULL) <> (release_id IS NULL))
);
CREATE UNIQUE INDEX versions_track_stack ON versions (track_id, kind, number) WHERE track_id IS NOT NULL;
CREATE UNIQUE INDEX versions_release_stack ON versions (release_id, kind, number) WHERE release_id IS NOT NULL;

-- Newest ≠ Current. Current follows newest unless a row here points it elsewhere.
CREATE TABLE current_pins (
  version_id TEXT NOT NULL REFERENCES versions (id) ON DELETE CASCADE,
  track_id   TEXT REFERENCES tracks (id) ON DELETE CASCADE,
  release_id TEXT REFERENCES releases (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  CHECK ((track_id IS NULL) <> (release_id IS NULL))
);
CREATE UNIQUE INDEX current_pins_track ON current_pins (track_id, kind) WHERE track_id IS NOT NULL;
CREATE UNIQUE INDEX current_pins_release ON current_pins (release_id, kind) WHERE release_id IS NOT NULL;

-- A thought about a version, at a moment (at_ms) or about the whole file (NULL).
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES versions (id) ON DELETE CASCADE,
  at_ms      INTEGER,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX notes_version ON notes (version_id, at_ms);
