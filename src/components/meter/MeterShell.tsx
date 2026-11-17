import { ClientOnly, Outlet } from '@tanstack/react-router'
import { MotionConfig } from 'framer-motion'

import { useAppearance } from '../../hooks/ui/use-appearance'

/** The shell for a bare route (the public meter): no rail, dock, player, Settings or loaders, so nothing on it calls a
 *  server function. Browser-only, as `AppShell` is. */
export function MeterShell() {
  return (
    <ClientOnly>
      <Motion>
        <Outlet />
      </Motion>
    </ClientOnly>
  )
}

function Motion({ children }: { children: React.ReactNode }) {
  const { reduceMotion } = useAppearance()
  return <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>
}
