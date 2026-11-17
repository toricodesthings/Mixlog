// The public meter's hostname serves the meter page and its static files, nothing else: no server function, no /api
// route, no write. Checked in `server.ts` before Start sees the request; `access` still stands behind it.
import { env } from 'cloudflare:workers'

/** Whether this request came to the meter's host (`METER_HOST`; never, while it's empty). */
export const onMeterHost = (url: URL) => !!env.METER_HOST && url.hostname === env.METER_HOST

/** An allowlist, so a route added later never answers here by accident: the page (`/`, `/meter`) and the built files. */
const PAGE = /^\/(meter\/?)?$|^\/(assets|brand)\/|^\/favicon\.ico$/

/** What the meter host does with a request: answer it, serve the page shell as a 404 (the meter's own not-found reads
 *  the address), or refuse it outright. */
export function meterHostAnswer(method: string, pathname: string): 'page' | 'not-found' | 'refuse' {
  if (method !== 'GET' && method !== 'HEAD') return 'refuse'
  if (PAGE.test(pathname)) return 'page'
  return /^\/(_serverFn|api)(\/|$)/.test(pathname) ? 'refuse' : 'not-found'
}
