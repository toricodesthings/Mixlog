import { ClientOnly, Outlet } from '@tanstack/react-router'
import { MotionConfig } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

import { useAppearance } from '../../hooks/ui/use-appearance'
import { Boot } from '../layout/Boot'

/** The shell for a bare route (the public meter): no rail, dock, player, Settings or loaders, so nothing on it calls a
 *  server function. Browser-only, as `AppShell` is. Its boot is the same one, in the shell HTML beside it, so a first
 *  visit sees the loading screen until the page has mounted, then it flies off. */
export function MeterShell() {
  const [boot, setBoot] = useState<'on' | 'leaving' | 'off'>('on')
  const ready = useCallback(() => setBoot((b) => (b === 'on' ? 'leaving' : b)), [])
  const gone = useCallback(() => setBoot('off'), [])
  return (
    <>
      <ClientOnly>
        <Motion onReady={ready}>
          <Outlet />
        </Motion>
      </ClientOnly>
      {boot !== 'off' && <Boot leaving={boot === 'leaving'} onLeft={gone} />}
    </>
  )
}

function Motion({ children, onReady }: { children: React.ReactNode; onReady: () => void }) {
  const { reduceMotion } = useAppearance()
  useEffect(onReady, [onReady])
  return <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>
}
