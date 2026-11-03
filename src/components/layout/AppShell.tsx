import { ClientOnly, Outlet } from '@tanstack/react-router'

import { MotionConfig } from 'framer-motion'

import { useAppearance } from '../../hooks/ui/use-appearance'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { BrandMark, Tuning } from '../primitives'
import { ListeningRoom } from '../player/ListeningRoom'
import { PlayerProvider } from '../player/Player'
import { PlayerBar } from '../player/PlayerBar'
import { SettingsDialog } from '../settings/SettingsDialog'
import { IconRail } from './IconRail'
import { PhoneDock } from './PhoneDock'

/** Rail on wide and laptop, dock on tablet and phone. Pages (and their navigator) fill the rest; the player (its bar,
 * docked under them or above the dock, and the listening room over everything) outlives them.
 * Browser-only, as in the production SPA shell: its layout depends on the screen and this device's choices. */
export function AppShell() {
  return (
    <ClientOnly fallback={<Boot />}>
      <Shell />
    </ClientOnly>
  )
}

/** Before the app has arrived (it's in the shell HTML, so CSS alone runs it): the mark, and the room tuning in. */
function Boot() {
  return (
    <div role="status" className="flex h-dvh flex-col items-center justify-center gap-5">
      <BrandMark live className="size-14" />
      <span className="readout flex items-center gap-2.5 text-ink-muted">
        <Tuning />
        Loading
      </span>
    </div>
  )
}

function Shell() {
  const { isDesktop } = useShellMode()
  const { reduceMotion } = useAppearance()
  // Springs and sheet gestures read this: reduced when asked here, else the device's own setting.
  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <PlayerProvider>
        <div className="flex h-dvh flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1">
            {isDesktop && <IconRail />}
            <div className="flex min-w-0 flex-1">
              <Outlet />
            </div>
          </div>
          <PlayerBar />
          {!isDesktop && <PhoneDock />}
        </div>
        <ListeningRoom />
        <SettingsDialog />
      </PlayerProvider>
    </MotionConfig>
  )
}
