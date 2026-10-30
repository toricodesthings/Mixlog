import { Link, type LinkOptions } from '@tanstack/react-router'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import * as ScrollArea from '../primitives/ScrollArea'

export type NavigatorItem = { id: string; label: string; link: LinkOptions }

/** The second column beside the rail on pages that have siblings to jump between. Desktop only. */
export function Navigator({ title, items, empty }: { title: string; items: NavigatorItem[]; empty: string }) {
  const { isDesktop } = useShellMode()
  if (!isDesktop) return null
  return (
    <aside aria-label={title} className="flex h-full w-64 shrink-0 flex-col border-r border-line">
      <div className="flex h-(--shell-header-h) shrink-0 items-center border-b border-line px-5">
        <h2 className="font-display text-sm font-semibold text-ink-soft">{title}</h2>
      </div>
      <ScrollArea.Root className="flex-1">
        <ScrollArea.Viewport>
          {items.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-muted">{empty}</p>
          ) : (
            <ul className="space-y-0.5 p-2">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    {...item.link}
                    className="flex h-11 items-center rounded-xl px-3 text-sm text-ink-soft transition-colors hover:bg-accent-dim hover:text-ink data-[status=active]:bg-accent-soft data-[status=active]:font-medium data-[status=active]:text-ink"
                  >
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </aside>
  )
}
