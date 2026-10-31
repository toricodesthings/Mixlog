import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Plain Node: keeps the Cloudflare and Start plugins in vite.config.ts out of unit tests. `cloudflare:workers`
// becomes an in-memory D1 over node:sqlite, so server queries run for real.
export default defineConfig({
  resolve: { alias: { 'cloudflare:workers': fileURLToPath(new URL('./tests/support/cloudflare-workers.ts', import.meta.url)) } },
  test: { include: ['tests/**/*.test.ts'] },
})
