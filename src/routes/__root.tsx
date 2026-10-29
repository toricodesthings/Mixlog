import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import '@fontsource-variable/outfit'
import '@fontsource-variable/sora'

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
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
