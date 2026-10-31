import { Link, useLocation } from '@tanstack/react-router'

import { DESTINATIONS, SETTINGS_ENTRY } from '../../lib/nav'
import { cn } from '../../lib/utils'
import { Led } from '../primitives'
import { useSettingsParam } from '../settings/use-settings-param'

const ITEM = 'press relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition-colors'

/** Phone and tablet: every destination, thumb-reachable at the bottom. */
export function PhoneDock() {
  const { pathname } = useLocation()
  const settings = useSettingsParam()
  const SettingsIcon = SETTINGS_ENTRY.icon
  return (
    <nav
      aria-label="Main"
      className="glass-surface layer-floating-bar fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-line px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {[...DESTINATIONS.primary, ...DESTINATIONS.secondary].map(({ to, label, icon: Icon, owns }) => (
        <Link
          key={to}
          to={to}
          aria-current={owns(pathname) ? 'page' : undefined}
          className={cn(ITEM, owns(pathname) && !settings.settings ? 'text-accent' : 'text-ink-muted')}
        >
          <Led lit={owns(pathname) && !settings.settings} className={cn('absolute top-0.5 transition-opacity', owns(pathname) && !settings.settings ? 'opacity-100' : 'opacity-0')} />
          <Icon size={20} aria-hidden="true" />
          {label}
        </Link>
      ))}
      <button type="button" onClick={() => void settings.open('menu')} aria-haspopup="dialog" className={cn(ITEM, 'cursor-pointer', settings.settings ? 'text-accent' : 'text-ink-muted')}>
        <Led lit={!!settings.settings} className={cn('absolute top-0.5 transition-opacity', settings.settings ? 'opacity-100' : 'opacity-0')} />
        <SettingsIcon size={20} aria-hidden="true" />
        {SETTINGS_ENTRY.label}
      </button>
    </nav>
  )
}
