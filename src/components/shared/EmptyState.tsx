import type { ReactNode } from 'react'

import { Scope } from '../primitives'

/** A quiet fact about what isn't here yet. Never an error, never a nag.
 *  A scope screen tops it: `flat` when there's no signal yet; `readout` is the channel-strip line above the title. */
export function EmptyState({ title, readout, flat, phantom, action, children }: {
  title: string
  readout?: string
  flat?: boolean
  /** The rare accent: only where nothing else on screen holds it (see src/AGENTS.md §6). */
  phantom?: boolean
  /** The one next step, if there is one. */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="surface-card glass-edge glow-accent relative mx-auto mt-[8vh] w-full max-w-md overflow-hidden rounded-3xl px-6 pt-8 pb-10 text-center">
      <Scope flat={flat} phantom={phantom} className="mx-auto mb-6" />
      {readout && <p className="readout mb-2 text-accent">{readout}</p>}
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-3 max-w-xs text-balance text-sm leading-relaxed text-ink-soft">{children}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </section>
  )
}
