import { createMiddleware, createStart } from '@tanstack/react-start'
import { getRequest, setResponseStatus } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'

import { isAllowed } from '#/server/access'

// Access already blocks strangers at the edge; this re-checks every server function inside the Worker,
// so a misconfigured route or a leaked workers.dev URL can't reach the data. The page shell is public
// code (it's on GitHub) and isn't checked: the build prerenders it with no token. Skipped in `pnpm dev`.
// defaultSsr: false keeps loaders in the browser, as SPA mode intends. /api server routes add `access` to their own `middleware`.
export const access = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  if (import.meta.env.DEV || (await isAllowed(getRequest(), env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD))) return next()
  setResponseStatus(403)
  throw new Error('Forbidden')
})

export const startInstance = createStart(() => ({ defaultSsr: false, functionMiddleware: [access] }))
