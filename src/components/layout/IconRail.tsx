import { Link, useLocation } from '@tanstack/react-router'
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { DESTINATIONS, SETTINGS_ENTRY, type Destination } from '../../lib/nav'
import { cn } from '../../lib/utils'
import { Led, Meter, Tip } from '../primitives'
import { useSettingsParam } from '../settings/use-settings-param'

const EXPANDED_KEY = 'mixlog.rail.expanded'

function readExpanded() {
  try {
    return localStorage.getItem(EXPANDED_KEY) === '1'
  } catch {
    return false
  }
}

/** The permanent rail on wide and laptop: icons, or icons with labels once expanded (kept per device). */
export function IconRail() {
  const [expanded, setExpanded] = useState(readExpanded)
  const { pathname } = useLocation()
  const settings = useSettingsParam()

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    try {
      localStorage.setItem(EXPANDED_KEY, next ? '1' : '0')
    } catch {}
  }

  const link = (d: Destination) => (
    <RailItem key={d.to} icon={d.icon} label={d.label} expanded={expanded} lit={d.owns(pathname)}>
      {(content, className) => (
        <Link
          to={d.to}
          aria-current={d.owns(pathname) ? 'page' : undefined}
          className={cn(
            className,
            d.owns(pathname) ? 'bg-accent-soft text-accent glow-accent' : 'text-ink-muted hover:bg-accent-dim hover:text-ink',
          )}
        >
          {content}
        </Link>
      )}
    </RailItem>
  )

  return (
    <nav
      aria-label="Main"
      className={cn(
        'surface-shell layer-shell-base flex h-full shrink-0 flex-col gap-1 overflow-hidden border-r border-line px-2 py-3',
        'transition-[width] duration-(--duration-smooth) ease-(--ease-out-expo)',
        expanded ? 'w-56' : 'w-[60px]',
      )}
    >
      <div data-meter-host className="flex h-11 items-center gap-3 px-[11px]">
        {/* The brand mark: an EQ that dances on hover, its peak lit in Phantom (the one place it lives in the shell). */}
        <Meter peak className="ml-[1px] h-5 shrink-0" />
        <Label expanded={expanded} className="font-display text-base font-semibold tracking-tight text-ink">
          Mixlog
        </Label>
      </div>
      <Divider />
      {DESTINATIONS.primary.map(link)}
      <div className="flex-1" />
      {DESTINATIONS.secondary.map(link)}
      <RailItem icon={SETTINGS_ENTRY.icon} label={SETTINGS_ENTRY.label} expanded={expanded} lit={!!settings.settings}>
        {(content, className) => (
          <button
            type="button"
            onClick={() => void settings.open('appearance')}
            aria-haspopup="dialog"
            className={cn(className, settings.settings ? 'bg-accent-soft text-accent glow-accent' : 'text-ink-muted hover:bg-accent-dim hover:text-ink')}
          >
            {content}
          </button>
        )}
      </RailItem>
      <Divider />
      <RailItem icon={expanded ? PanelLeftClose : PanelLeftOpen} label={expanded ? 'Collapse' : 'Expand'} expanded={expanded}>
        {(content, className) => (
          <button type="button" onClick={toggle} aria-expanded={expanded} className={cn(className, 'text-ink-muted hover:bg-accent-dim hover:text-ink')}>
            {content}
          </button>
        )}
      </RailItem>
    </nav>
  )
}

/** One rail row: the icon always, the label once expanded; a tooltip carries the label while collapsed. */
function RailItem({
  icon: Icon,
  label,
  expanded,
  lit = false,
  children,
}: {
  icon: LucideIcon
  label: string
  expanded: boolean
  /** The channel's select LED: lit on the current destination. */
  lit?: boolean
  children: (content: ReactNode, className: string) => ReactNode
}) {
  const content = (
    <>
      <Led lit={lit} className={cn('absolute left-[3px] transition-opacity duration-(--duration-normal)', lit ? 'opacity-100' : 'opacity-0')} />
      <Icon size={18} aria-hidden="true" className="shrink-0" />
      <Label expanded={expanded}>{label}</Label>
    </>
  )
  return (
    <Tip label={label} disabled={expanded}>
      {children(content, 'press relative flex h-11 w-full shrink-0 cursor-pointer items-center gap-3 rounded-2xl px-[13px] text-sm font-medium transition-colors')}
    </Tip>
  )
}

/** Stays in the accessible name while collapsed; only its paint fades. */
function Label({ expanded, className, children }: { expanded: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn('truncate whitespace-nowrap transition-opacity duration-(--duration-normal)', expanded ? 'opacity-100' : 'opacity-0', className)}>
      {children}
    </span>
  )
}

function Divider() {
  return <div className="mx-1.5 my-1 h-px shrink-0 rounded-full bg-line" aria-hidden="true" />
}
