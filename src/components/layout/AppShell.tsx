import { ClientOnly, Outlet } from '@tanstack/react-router'

import { MotionConfig } from 'framer-motion'

import { useAppearance } from '../../hooks/ui/use-appearance'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { SettingsDialog } from '../settings/SettingsDialog'
import { IconRail } from './IconRail'
import { PhoneDock } from './PhoneDock'

/** Rail on wide and laptop, dock on tablet and phone. Pages (and their navigator) fill the rest.
 * Browser-only, as in the production SPA shell: its layout depends on the screen and this device's choices. */
export function AppShell() {
  return (
    <ClientOnly>
      <Shell />
    </ClientOnly>
  )
}

function Shell() {
  const { isDesktop } = useShellMode()
  const { reduceMotion } = useAppearance()
  // Springs and sheet gestures read this: reduced when asked here, else the device's own setting.
  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <div className="flex h-dvh overflow-hidden">
        {isDesktop && <IconRail />}
        <div className="flex min-w-0 flex-1">
          <Outlet />
        </div>
        {!isDesktop && <PhoneDock />}
      </div>
      <SettingsDialog />
    </MotionConfig>
  )
}
