import { ArrowUpDown, type LucideIcon } from 'lucide-react'

import { Button } from '../primitives'
import * as DropdownMenu from '../primitives/DropdownMenu'

export type SortOption<T extends string> = { value: T; label: string; icon: LucideIcon }

/** A list's order: one button naming the current one, a menu of the rest (Upcoming, Releases, Artists). */
export function SortMenu<T extends string>({ options, sort, onSort }: { options: SortOption<T>[]; sort: T; onSort: (sort: T) => void }) {
  const current = options.find((s) => s.value === sort)!
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" aria-label={`Sort: ${current.label}`} className="px-3.5">
          <ArrowUpDown size={16} aria-hidden="true" />
          <span className="max-lg:hidden">{current.label}</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="min-w-[13rem]">
        <DropdownMenu.RadioGroup value={sort} onValueChange={(v) => onSort(v as T)}>
          {options.map(({ value, label, icon: Icon }) => (
            <DropdownMenu.RadioItem key={value} value={value} className="gap-2">
              <Icon size={14} aria-hidden="true" className="text-ink-muted" />
              {label}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
