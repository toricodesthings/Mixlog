import { ClientOnly, Outlet, useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { MotionConfig } from 'framer-motion'

import { useAppearance } from '../../hooks/ui/use-appearance'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { Toaster } from '../primitives'
import { AuditionProvider } from '../player/ABSwitch'
import { ListeningRoom } from '../player/ListeningRoom'
import { PlayerProvider } from '../player/Player'
import { PlayerBar } from '../player/PlayerBar'
import { SettingsDialog } from '../settings/SettingsDialog'
import { IconRail } from './IconRail'
import { Boot } from './Boot'
import { PhoneDock } from './PhoneDock'

/** Rail on wide and laptop, dock on tablet and phone. Pages (and their navigator) fill the rest; the player (its bar,
 * docked under them or above the dock, and the listening room over everything) outlives them.
 * Browser-only, as in the production SPA shell: its layout depends on the screen and this device's choices. The boot
 * screen sits beside it, not as its fallback, so the same one (in the shell HTML) keeps playing until the first page is
 * ready, then fades. */
export function AppShell() {
  const [boot, setBoot] = useState<'on' | 'leaving' | 'off'>('on')
  const ready = useCallback(() => setBoot((b) => (b === 'on' ? 'leaving' : b)), [])
  const gone = useCallback(() => setBoot('off'), [])
  return (
    <>
      <ClientOnly>
        <Shell onReady={ready} />
      </ClientOnly>
      {boot !== 'off' && <Boot leaving={boot === 'leaving'} onLeft={gone} />}
    </>
  )
}

/** The boot holds until the first page has its data, or 1.6s from navigation start (3× Doherty), whichever is first:
 * a fast connection lands the page whole, a slow one hands over to its skeleton. */
const BOOT_CAP_MS = 1600

function useBootReady(onReady: () => void) {
  const loading = useRouterState({ select: (s) => s.isLoading || s.status === 'pending' })
  useEffect(() => {
    if (!loading) return onReady()
    const timer = setTimeout(onReady, BOOT_CAP_MS - performance.now())
    return () => clearTimeout(timer)
  }, [loading, onReady])
}

/** A new page lands focus on its heading (the title is announced, and the next Tab starts in the page), not on the link
 * that was pressed. Only the path counts: a search change (Settings, the room, meters) keeps focus where it is. */
function useFocusHeading() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const first = useRef(true)
  useEffect(() => {
    if (first.current) return void (first.current = false)
    const frame = requestAnimationFrame(() => {
      const h1 = document.querySelector<HTMLElement>('h1')
      if (!h1) return
      h1.tabIndex = -1
      h1.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname])
}

function Shell({ onReady }: { onReady: () => void }) {
  useFocusHeading()
  useBootReady(onReady)
  const { isDesktop } = useShellMode()
  const { reduceMotion } = useAppearance()
  // Springs and sheet gestures read this: reduced when asked here, else the device's own setting.
  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
      <PlayerProvider>
        <AuditionProvider>
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
          <Toaster />
        </AuditionProvider>
      </PlayerProvider>
    </MotionConfig>
  )
}
