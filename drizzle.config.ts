import { defineConfig } from 'drizzle-kit'

// Generates D1 migrations into `migrations/`, which `wrangler d1 migrations apply` runs (locally and remotely).
// 0001 and 0002 were hand-written before Drizzle; `migrations/meta` starts from the schema they left.
export default defineConfig({
  schema: './src/server/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
})
