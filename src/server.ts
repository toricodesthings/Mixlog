// The Worker's entry: TanStack Start answers every request, and the cron (`triggers` in wrangler.jsonc) erases
// what Move to Releases pruned once its grace window has passed, then measures what the meter hasn't read yet.
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

import { report } from '#/server/log'
import { measureMissing } from '#/server/meter'
import { erasePruned } from '#/server/versions'

export default {
  ...createServerEntry({ fetch: (request, opts) => handler.fetch(request, opts) }),
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
