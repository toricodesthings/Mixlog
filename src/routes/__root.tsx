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
      { title: 'Mixlog' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
    // Before first paint, so a Daylight device never flashes Blue Hour.
    scripts: [{ children: APPEARANCE_BOOT }],
  }),
  // `?settings=<tab>` opens Settings over any page.
  validateSearch: (search: Record<string, unknown>): { settings?: string } =>
    typeof search.settings === 'string' ? { settings: search.settings } : {},
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
