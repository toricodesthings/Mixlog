import { Link, type LinkOptions } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { cn } from '../../lib/utils'

/** A page above this one. The page itself is the title, so it's never a crumb. */
export type Crumb = { label: string; link: LinkOptions }

/**
 * Every page: a header with the trail to it, then its scrolling content.
 * Desktop shows the whole trail; compact shows only the way back up.
 */
export function Page({ title, crumbs = [], lead, meta, actions, children }: {
  title: string
  crumbs?: Crumb[]
  /** Before the title, like a cover beside a track name (ReleaseArt). */
  lead?: ReactNode
  /** Under the title: its facts (MetaLine). */
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  const { isCompact } = useShellMode()
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header
        className={cn(
          'surface-shell layer-shell-header flex min-h-(--shell-header-h) shrink-0 items-center gap-3 signal-rule',
          isCompact ? 'safe-header-top px-4 pb-2' : 'px-6 py-2 lg:px-8',
        )}
      >
        {lead}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {crumbs.length > 0 && <Breadcrumbs crumbs={isCompact ? crumbs.slice(-1) : crumbs} back={isCompact} />}
          <h1 className={cn('truncate font-display font-semibold leading-tight tracking-tight', isCompact ? 'text-[22px]' : 'text-lg')}>{title}</h1>
          {meta}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <main className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8', isCompact && 'pb-28')}>{children}</main>
    </div>
  )
}

function Breadcrumbs({ crumbs, back }: { crumbs: Crumb[]; back: boolean }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1 text-[12.5px] font-medium leading-tight">
        {crumbs.map((crumb) => (
          <li key={crumb.label} className="flex min-w-0 items-center gap-1">
            {back && <ChevronLeft size={14} aria-hidden="true" className="-ml-1 shrink-0 text-accent" />}
            <Link {...crumb.link} className="truncate rounded text-accent hover:underline hover:underline-offset-4">
              {crumb.label}
            </Link>
            {!back && <ChevronRight size={13} aria-hidden="true" className="shrink-0 text-ink-muted" />}
          </li>
        ))}
      </ol>
    </nav>
  )
}
