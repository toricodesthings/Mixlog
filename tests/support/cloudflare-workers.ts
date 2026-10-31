// `cloudflare:workers` for tests in plain Node: `env.DB` is D1's API over an in-memory SQLite (node:sqlite) built
// from `migrations/`, so server queries run for real. Only the calls Drizzle's D1 driver makes are here.
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

export const sqlite = new DatabaseSync(':memory:')
sqlite.exec('PRAGMA foreign_keys = ON')
for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'))

type Value = string | number | bigint | null | Uint8Array
class Statement {
  constructor(readonly query: string, readonly params: Value[] = []) {}
  bind(...params: Value[]) {
    return new Statement(this.query, params)
  }
  async all() {
    return { results: sqlite.prepare(this.query).all(...this.params), success: true, meta: {} }
  }
  async raw() {
    const statement = sqlite.prepare(this.query)
    statement.setReturnArrays(true)
    return statement.all(...this.params)
  }
  async first() {
    return sqlite.prepare(this.query).get(...this.params) ?? null
  }
  async run() {
    sqlite.prepare(this.query).run(...this.params)
    return { results: [], success: true, meta: {} }
  }
}

export const env = {
  DB: {
    prepare: (query: string) => new Statement(query),
    batch: (statements: Statement[]) => Promise.all(statements.map((s) => s.all())),
  },
}
