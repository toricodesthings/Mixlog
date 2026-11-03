import { createMiddleware, createStart } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { allowed } from '#/server/access'
import { Refusal } from '#/server/input'
import { isAnswer, report, SERVER_FAILED } from '#/server/log'

// Access already blocks strangers at the edge; this re-checks every server function inside the Worker,
// so a misconfigured route or a leaked workers.dev URL can't reach the data. The page shell is public
// code (it's on GitHub) and isn't checked: the build prerenders it with no token. Skipped in `pnpm dev`.
// defaultSsr: false keeps loaders in the browser, as SPA mode intends. /api server routes check `isAllowed` themselves (server/versions.ts).
export const access = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  if (await allowed(getRequest())) return next()
  throw new Refusal('Forbidden', 403)
})

// A server function's failure nobody planned for is logged with the function and its input, and the artist gets a plain
// sentence instead of its message (which can hold SQL). The status keeps Start from logging it a second time, raw.
export const failures = createMiddleware({ type: 'function' }).server(async ({ next, data, serverFnMeta }) => {
  try {
    return await next()
  } catch (error) {
    if (isAnswer(error)) throw error
    report('error', `${serverFnMeta.name} failed`, error, { fn: serverFnMeta.filename, data })
    throw Object.assign(new Error(SERVER_FAILED), { status: 500 })
  }
})

// The same for the /api routes (file bytes), which don't get function middleware.
const routeFailures = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next()
  } catch (error) {
    if (isAnswer(error) || error instanceof Response) throw error
    report('error', `${request.method} ${new URL(request.url).pathname} failed`, error)
    return new Response(SERVER_FAILED, { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }
})

export const startInstance = createStart(() => ({ defaultSsr: false, requestMiddleware: [routeFailures], functionMiddleware: [access, failures] }))
