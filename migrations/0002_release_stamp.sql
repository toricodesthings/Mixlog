-- Released is a stamp: set when a release goes out, it moves from Upcoming to Releases.
ALTER TABLE releases ADD COLUMN released_at TEXT;
