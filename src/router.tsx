import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { PagePending } from './components/releases/Pending'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // A page on its way shows its skeleton soon (on bad signal, a second of nothing reads as broken), and once shown,
    // long enough not to flicker.
    defaultPendingMs: 200,
    defaultPendingMinMs: 400,
    defaultPendingComponent: PagePending,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
