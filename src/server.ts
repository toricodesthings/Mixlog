// The Worker's entry: TanStack Start answers every request, and the cron (`triggers` in wrangler.jsonc) erases
// what Move to Releases pruned once its grace window has passed.
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

import { erasePruned } from '#/server/versions'

export default {
  ...createServerEntry({ fetch: (request, opts) => handler.fetch(request, opts) }),
  scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(erasePruned().then((erased) => console.log(`cleanup: erased ${erased} pruned versions`)))
  },
}
