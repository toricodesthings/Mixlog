import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { PagePending } from './components/releases/Pending'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 5_000,
    // A page on its way shows its skeleton soon (on bad signal, a second of nothing reads as broken), and once shown,
    // long enough not to flicker.
    defaultPendingMs: 200,
    defaultPendingMinMs: 250,
    defaultPendingComponent: PagePending,
    // On the public meter's own host the meter is the whole site: `/` is `/meter`, and any other path lands on the
    // meter's not-found, never on a private page.
    rewrite: onMeterHost() ? { input: ({ url }) => withPath(url, `/meter${url.pathname === '/' ? '' : url.pathname}`), output: ({ url }) => withPath(url, url.pathname.replace(/^\/meter(?=\/|$)/, '') || '/') } : undefined,
  })

  return router
}

/** Whether this page is on the public meter's host (`METER_HOST`). */
export const onMeterHost = () => typeof location !== 'undefined' && !!__METER_HOST__ && location.hostname === __METER_HOST__

const withPath = (url: URL, pathname: string) => Object.assign(new URL(url), { pathname })

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
  interface StaticDataRouteOption {
    /** Renders in `MeterShell`, not `AppShell`: a public page with no app around it and no server functions. */
    bare?: boolean
  }
}
