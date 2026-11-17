// The Worker's entry: TanStack Start answers every request, and the cron (`triggers` in wrangler.jsonc) erases
// what Move to Releases pruned once its grace window has passed, then measures what the meter hasn't read yet.
// On the public meter's host (`METER_HOST`), only the page and its files answer; everything else is a 404 first.
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

import { withSecurityHeaders } from '#/server/headers'
import { report } from '#/server/log'
import { measureMissing } from '#/server/meter'
import { meterHostAnswer, onMeterHost } from '#/server/meter-host'
import { erasePruned } from '#/server/versions'

export default {
  ...createServerEntry({
    fetch: async (request, opts) => {
      const url = new URL(request.url)
      if (!onMeterHost(url)) return handler.fetch(request, opts)
      const answer = meterHostAnswer(request.method, url.pathname)
      if (answer === 'refuse') return withSecurityHeaders(new Response('Not found', { status: 404 }))
      // Any other address gets the page shell (never its own route), as a 404; the meter's not-found reads the address.
      const page = await handler.fetch(answer === 'page' ? request : new Request(new URL('/', url), request), opts)
      const response = new Response(page.body, { status: answer === 'page' ? page.status : 404, headers: page.headers })
      // A public tool, meant to be found: every other header stays.
      response.headers.delete('x-robots-tag')
      return response
    },
  }),
  scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    // What it erased already left in place; only a failure is worth a line (tomorrow's run retries it).
    ctx.waitUntil(
      erasePruned()
        .catch((error) => report('error', 'cleanup failed', error))
        .then(() => measureMissing())
        .catch((error) => report('warn', 'measuring failed', error)),
    )
  },
}
