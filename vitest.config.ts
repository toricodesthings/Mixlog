import { defineConfig } from 'vitest/config'

// Plain Node: keeps the Cloudflare and Start plugins in vite.config.ts out of unit tests.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } })
