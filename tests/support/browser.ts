// The browser's side of the /api routes, for tests that drive `lib/files.ts` end to end: `fetch` and
// `XMLHttpRequest` go straight into the route files' handlers, as the Worker would route them. `sent` logs each
// request; `network.intercept` can answer (or drop, by throwing) one before it reaches the Worker.
import { vi } from 'vitest'

import { Route as artwork } from '#/routes/api/releases.$releaseId.artwork'
import { Route as files } from '#/routes/api/files.$versionId'
import { Route as license } from '#/routes/api/tracks.$trackId.license'
import { Route as complete } from '#/routes/api/uploads.complete'
import { Route as uploads } from '#/routes/api/uploads'

type Handler = (ctx: { request: Request; params: Record<string, string> }) => Response | Promise<Response>
const routes: [string, { options: unknown }][] = [
  ['/api/uploads', uploads],
  ['/api/uploads/complete', complete],
  ['/api/files/$versionId', files],
  ['/api/releases/$releaseId/artwork', artwork],
  ['/api/tracks/$trackId/license', license],
]

export const sent: string[] = []
export const network: { intercept?: (request: Request) => Response | undefined } = {}

async function worker(request: Request): Promise<Response> {
  const { pathname, searchParams } = new URL(request.url)
  const part = searchParams.get('part')
  sent.push(`${request.method} ${pathname}${part ? ` part ${part}` : ''}`)
  const answer = network.intercept?.(request)
  if (answer) return answer
  for (const [path, route] of routes) {
    const matched = pathname.match(new RegExp(`^${path.replace(/\$(\w+)/g, '(?<$1>[^/]+)')}$`))
    if (!matched) continue
    const handler = (route.options as { server: { handlers: Record<string, Handler> } }).server.handlers[request.method]
    return handler ? handler({ request, params: { ...matched.groups } }) : new Response(null, { status: 405 })
  }
  return new Response('Not found', { status: 404 })
}

const toRequest = (url: string | URL, init?: RequestInit) => new Request(new URL(url, 'https://mixlog.test'), init)

class XHR {
  status = 0
  responseText = ''
  upload: { onprogress?: (event: { loaded: number }) => void } = {}
  onload?: () => void
  onerror?: () => void
  ontimeout?: () => void
  private request?: { method: string; url: string; headers: Record<string, string> }
  open(method: string, url: string) {
    this.request = { method, url, headers: {} }
  }
  setRequestHeader(name: string, value: string) {
    this.request!.headers[name] = value
  }
  send(body: Blob) {
    const { method, url, headers } = this.request!
    // A browser sets the length itself; the Worker reads it.
    worker(toRequest(url, { method, body, headers: { ...headers, 'content-length': String(body.size) } })).then(
      async (response) => {
        this.upload.onprogress?.({ loaded: body.size })
        this.status = response.status
        this.responseText = await response.text()
        this.onload?.()
      },
      () => this.onerror?.(),
    )
  }
}

vi.stubGlobal('fetch', (url: string | URL, init?: RequestInit) => worker(toRequest(url, init)))
vi.stubGlobal('XMLHttpRequest', XHR)
