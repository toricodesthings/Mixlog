import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

import { useDockTucked } from '../../hooks/ui/use-dock-tucked'
import { useLensScrub } from '../../hooks/ui/use-lens-scrub'
import { SPRINGS } from '../../lib/constants/motion'
import { DESTINATIONS, SETTINGS_ENTRY, type Destination } from '../../lib/nav'
import { cn } from '../../lib/utils'
import { MiniPlayer } from '../player/PlayerBar'
import { Tip } from '../primitives'
import { useSettingsParam } from '../settings/use-settings-param'

const TABS = [...DESTINATIONS.primary, ...DESTINATIONS.secondary]

/** Phone and tablet: Cadence's floating glass dock, every destination and Settings in thumb's reach. The active tab is
 *  a glass lens that glides on a route change and, on touch, scrubs under the finger (letting go commits). Settings
 *  opens over the page, so its tab is lit while the sheet is open. While something plays the mini player rides on top.
 *  Scrolling a page down tucks the dock into its current tab, with the mini player beside it; a tap brings it back. */
export function PhoneDock() {
  const { pathname } = useLocation()
  const settings = useSettingsParam()
  const activeIndex = settings.settings ? TABS.length : TABS.findIndex((tab) => tab.owns(pathname))
  const [tucked, setTucked] = useDockTucked(pathname)
  const Current = (TABS[activeIndex] ?? SETTINGS_ENTRY).icon
  // Fades and slides only: the lens measures its tabs on screen, so the dock itself never scales.
  const swap = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 12 }, transition: SPRINGS.SNAP }
  return (
    <nav aria-label="Main" className="mobile-tab-bar safe-bottom layer-shell-header shrink-0 pt-2">
      <LayoutGroup>
        <div className={cn('mx-auto flex w-full max-w-sm gap-2', tucked ? 'flex-row-reverse items-center' : 'flex-col')}>
          <MiniPlayer tucked={tucked} />
          <AnimatePresence mode="popLayout" initial={false}>
            {tucked ? (
              <motion.button key="tucked" {...swap} type="button" onClick={() => setTucked(false)} aria-label="Show all tabs" aria-expanded={false} className="mobile-dock glass glass-edge dock-link flex size-14 shrink-0 items-center justify-center rounded-full p-1.5">
                <span className="dock-lens glass-edge flex size-full items-center justify-center rounded-full text-accent">
                  <Current size={22} strokeWidth={2.5} aria-hidden="true" />
                </span>
              </motion.button>
            ) : (
              <motion.div key="dock" {...swap} className="w-full">
                <Tabs activeIndex={activeIndex} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </nav>
  )
}

/** The tabs and their lens. Its own component so the lens measures afresh each time the dock comes back. */
function Tabs({ activeIndex }: { activeIndex: number }) {
  const navigate = useNavigate()
  const settings = useSettingsParam()
  const { trackRef, lens, handlers, hoverIndex, held } = useLensScrub({
    activeIndex,
    onCommit: (i) => void (i === TABS.length ? settings.open('menu') : navigate({ to: TABS[i].to })),
    rememberAs: 'dock',
  })
  const tabs: { to: Destination['to'] | null; label: string; icon: LucideIcon }[] = [...TABS, { to: null, ...SETTINGS_ENTRY }]
  return (
    <div ref={trackRef} {...handlers} data-held={held || undefined} className="mobile-dock glass glass-edge relative mx-auto flex w-full max-w-sm touch-none items-stretch gap-1 rounded-full p-1.5">
      <motion.span aria-hidden="true" className="dock-lens glass-edge pointer-events-none absolute inset-y-1.5 left-0 rounded-full" style={{ x: lens.x, width: lens.width, scale: lens.scale }} />
      {tabs.map(({ to, label, icon: Icon }, index) => {
        const active = index === activeIndex
        const lit = hoverIndex === null ? active : hoverIndex === index
        const className = cn('dock-link relative flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full transition-colors', lit ? 'text-accent' : 'text-ink-soft hover:bg-room-surface')
        const icon = <Icon size={22} strokeWidth={active ? 2.5 : 1.75} className="shrink-0" aria-hidden="true" />
        return (
          <Tip key={label} label={label} side="top">
            {to ? (
              <Link to={to} data-lens-item aria-current={active ? 'page' : undefined} aria-label={label} className={className}>
                {icon}
              </Link>
            ) : (
              <button type="button" data-lens-item onClick={() => void settings.open('menu')} aria-haspopup="dialog" aria-expanded={active} aria-label={label} className={className}>
                {icon}
              </button>
            )}
          </Tip>
        )
      })}
    </div>
  )
}
