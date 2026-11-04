import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Plain Node: keeps the Cloudflare and Start plugins in vite.config.ts out of unit tests. `cloudflare:workers`
// becomes an in-memory D1 over node:sqlite and R2 in memory, so server queries run for real; tests/support/start.ts
// runs server functions the way Start's compiler would.
export default defineConfig({
  resolve: {
    alias: [
      { find: 'cloudflare:workers', replacement: fileURLToPath(new URL('./tests/support/cloudflare-workers.ts', import.meta.url)) },
      // The Worker imports the meter's .wasm as a compiled module (the Cloudflare plugin's `?module`); Node compiles it here.
      { find: /^.*mixlog_meter_bg\.wasm\?module$/, replacement: fileURLToPath(new URL('./tests/support/meter-module.ts', import.meta.url)) },
    ],
  },
  test: { include: ['tests/**/*.test.ts'], setupFiles: ['tests/support/start.ts'] },
})
