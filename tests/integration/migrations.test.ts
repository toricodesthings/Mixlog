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
