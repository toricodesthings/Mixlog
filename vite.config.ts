import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { readFileSync } from 'node:fs'
import pkg from './package.json' with { type: 'json' }
import { parseChangelog } from './src/lib/changelog'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __CHANGELOG__: JSON.stringify(parseChangelog(readFileSync('CHANGELOG.md', 'utf8'))),
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    // SPA mode: the browser renders every page; the Worker still runs server functions and server routes.
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
  ],
})
