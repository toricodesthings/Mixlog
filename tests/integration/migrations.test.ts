import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { expect, it } from 'vitest'

// D1 keeps foreign keys on through a migration (`PRAGMA foreign_keys=OFF` does nothing there), so a drizzle-kit table
// rebuild cascades into every table that references it. Run the migrations that way and check nothing was lost.
it('keeps current pins and notes through table rebuilds, as D1 runs them', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  const files = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()
  const apply = (file: string) => db.exec(readFileSync(`migrations/${file}`, 'utf8').replace(/PRAGMA foreign_keys=(ON|OFF);/g, ''))
  const seeded = files.indexOf('0003_track_origin.sql')
  files.slice(0, seeded + 1).forEach(apply)
  db.exec(`
    INSERT INTO releases (id, title) VALUES ('r', 'R');
    INSERT INTO tracks (id, release_id, title) VALUES ('t', 'r', 'T');
    INSERT INTO versions (id, track_id, kind, number, r2_key, filename, content_type, size) VALUES
      ('v1', 't', 'master', 1, 'k1', 'a.wav', 'audio/wav', 1), ('v2', 't', 'master', 2, 'k2', 'b.wav', 'audio/wav', 1);
    INSERT INTO current_pins (version_id, track_id, kind) VALUES ('v1', 't', 'master');
    INSERT INTO notes (id, version_id, at_ms, body) VALUES ('n', 'v1', 72000, 'hi-hat still harsh');
  `)
  files.slice(seeded + 1).forEach(apply)

  expect(db.prepare('SELECT version_id FROM current_pins').all()).toEqual([{ version_id: 'v1' }])
  expect(db.prepare('SELECT body FROM notes').all()).toEqual([{ body: 'hi-hat still harsh' }])
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE '\\_\\_%' ESCAPE '\\'").all()).toEqual([])
})

// 0007 files 1.0.0's stacks into lanes: one number per song, every final that would have shipped pinned, and a released
// release keeping only what shipped.
it('renumbers mixes and masters as one song, pins 1.0.0’s finals, and sets aside what a release didn’t ship', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  const files = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()
  const apply = (file: string) => db.exec(readFileSync(`migrations/${file}`, 'utf8').replace(/PRAGMA foreign_keys=(ON|OFF);/g, ''))
  const at = files.indexOf('0007_final_lanes.sql')
  files.slice(0, at).forEach(apply)
  const row = (id: string, track: string, kind: string, number: number, type: string, day: number, more = 'NULL, NULL') =>
    `('${id}', '${track}', '${kind}', ${number}, 'k-${id}', '${id}', '${type}', 1, '2026-01-0${day}T00:00:00.000Z', ${more})`
  db.exec(`
    INSERT INTO releases (id, title, released_at) VALUES ('up', 'Up', NULL), ('out', 'Out', '2026-02-01T00:00:00.000Z');
    INSERT INTO tracks (id, release_id, title) VALUES ('a', 'up', 'A'), ('b', 'up', 'B'), ('c', 'out', 'C');
    INSERT INTO versions (id, track_id, kind, number, r2_key, filename, content_type, size, created_at, released_at, pruned_at) VALUES
      ${row('ax1', 'a', 'mix', 1, 'audio/mpeg', 1)}, ${row('am1', 'a', 'master', 1, 'audio/mpeg', 2)}, ${row('am2', 'a', 'master', 2, 'audio/wav', 3)},
      ${row('ai1', 'a', 'instrumental', 1, 'audio/wav', 3)},
      ${row('bm1', 'b', 'master', 1, 'audio/wav', 1)}, ${row('bm2', 'b', 'master', 2, 'audio/mpeg', 2)},
      ${row('cx1', 'c', 'mix', 1, 'audio/mpeg', 1)}, ${row('cm1', 'c', 'master', 1, 'audio/wav', 2, "'2026-02-01T00:00:00.000Z', NULL")},
      ${row('cl1', 'c', 'license', 1, 'application/pdf', 1)};
    INSERT INTO current_pins (version_id, track_id, kind) VALUES ('bm2', 'b', 'master'), ('cm1', 'c', 'master');
  `)
  files.slice(at).forEach(apply)

  const all = (query: string) => db.prepare(query).all().map((r) => Object.values(r).join(' '))
  expect(all("SELECT id, number FROM versions WHERE kind IN ('mix', 'master') ORDER BY id")).toEqual(['am1 2', 'am2 3', 'ax1 1', 'bm1 1', 'bm2 2', 'cm1 2', 'cx1 1'])
  expect(all('SELECT version_id FROM current_pins ORDER BY version_id')).toEqual(['am2', 'cm1']) // bm2 was a pinned test
  expect(all('SELECT id FROM versions WHERE pruned_at IS NOT NULL')).toEqual(['cx1'])
  expect(() => db.exec("INSERT INTO versions (id, track_id, kind, number, r2_key, filename, content_type, size) VALUES ('dup', 'a', 'mix', 3, 'k-dup', 'd', 'audio/mpeg', 1)")).toThrow(/UNIQUE/)
})
