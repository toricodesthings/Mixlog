import { Fragment } from 'react'

import { cn } from '../../lib/utils'

/** Facts in a row, split by a small lit dot: Oct 12 · EP · 4 tracks · 14:32. Empty facts are left out. */
export function MetaLine({ facts, className }: { facts: (string | null | undefined)[]; className?: string }) {
  const shown = facts.filter(Boolean)
  return (
    <span className={cn('flex min-w-0 items-center gap-2 truncate text-[13px] text-ink-muted', className)} data-numeric>
      {shown.map((fact, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className="size-[3px] shrink-0 rounded-full bg-accent/70 shadow-[0_0_6px_var(--accent)]">
              <span className="sr-only">, </span>
            </span>
          )}
          <span className={cn(i === shown.length - 1 ? 'truncate' : 'shrink-0')}>{fact}</span>
        </Fragment>
      ))}
    </span>
  )
}
