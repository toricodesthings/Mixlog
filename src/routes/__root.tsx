import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import '@fontsource-variable/outfit'
import '@fontsource-variable/sora'

import { AppShell } from '#/components/layout/AppShell'
import { APPEARANCE_BOOT } from '#/hooks/ui/use-appearance'
import { NotFound } from '#/components/layout/NotFound'
import { Provider as TooltipProvider } from '#/components/primitives/Tooltip'
import appCss from '#/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#0a1020' },
      { name: 'color-scheme', content: 'dark' },
      { title: 'Mixlog' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', href: '/brand/mixlog-mark.png', type: 'image/png' },
      { rel: 'apple-touch-icon', href: '/brand/mixlog-mark.png' },
      // Access sits in front of everything, so the manifest is fetched with the session's cookie.
      { rel: 'manifest', href: '/site.webmanifest', crossOrigin: 'use-credentials' },
    ],
    // Before first paint, so a Daylight device never flashes Blue Hour.
    scripts: [{ children: APPEARANCE_BOOT }],
  }),
  // `?settings=<tab>` opens Settings over any page; `?listen` the listening room over it, `&b=` split for A/B (with
  // that version on B), `&pick=a|b` its picker.
  validateSearch: (search: Record<string, unknown>): { settings?: string; listen?: true; b?: string | true; pick?: 'a' | 'b' } => ({
    ...(typeof search.settings === 'string' ? { settings: search.settings } : {}),
    ...(search.listen === true ? { listen: true as const } : {}),
    ...(search.listen === true && (search.b === true || (typeof search.b === 'string' && search.b)) ? { b: search.b as string | true } : {}),
    ...(search.listen === true && search.b !== undefined && (search.pick === 'a' || search.pick === 'b') ? { pick: search.pick } : {}),
  }),
  shellComponent: RootDocument,
  component: AppShell,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // The appearance boot script sets data-theme/data-motion here before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-atmosphere text-ink">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Scripts />
      </body>
    </html>
  )
}
