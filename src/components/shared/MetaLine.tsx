import { Fragment } from 'react'

import { cn } from '../../lib/utils'

/** Facts in a row, split by a small lit dot: Oct 12 · EP · 4 tracks · 14:32. Empty facts are left out. One line, the
 *  last fact truncated, for a list row; `wrap` (a page's header, a file's facts) lets whole facts move to the next
 *  line instead, each kept in one piece with its dot, so nothing is cut mid-word on a phone. */
export function MetaLine({ facts, wrap, className }: { facts: (string | null | undefined)[]; wrap?: boolean; className?: string }) {
  const shown = facts.filter(Boolean)
  const dot = (
    <span className="size-[3px] shrink-0 rounded-full bg-accent/70 shadow-[0_0_6px_var(--accent)]">
      <span className="sr-only">, </span>
    </span>
  )
  // Wrapping, every fact carries its dot, and the line sits one dot to the left in a clipped box: whichever dot starts a
  // line (the first fact's, or a wrapped one's) falls outside it, so no line starts with a dot.
  if (wrap)
    return (
      <span className={cn('block min-w-0 overflow-hidden text-[13.5px] text-ink-muted', className)} data-numeric>
        <span className="-ml-[11px] flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {shown.map((fact, i) => (
            <span key={i} className="flex min-w-0 items-center gap-2">
              {dot}
              <span className="min-w-0 break-words">{fact}</span>
            </span>
          ))}
        </span>
      </span>
    )
  return (
    <span className={cn('flex min-w-0 items-center gap-x-2 truncate text-[13.5px] text-ink-muted', className)} data-numeric>
      {shown.map((fact, i) => (
        <Fragment key={i}>
          {i > 0 && dot}
          <span className={cn(i === shown.length - 1 ? 'truncate' : 'shrink-0')}>{fact}</span>
        </Fragment>
      ))}
    </span>
  )
}
