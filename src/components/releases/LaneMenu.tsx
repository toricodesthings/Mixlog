import type { ReactElement } from 'react'

import * as DropdownMenu from '../primitives/DropdownMenu'
import type { Target } from '../uploads/use-lane-upload'
import { FINAL_ICON, KIND_ICON, KIND_LABEL } from './stacks'

/** Each place a file can land, named and drawn once: the lanes and the alternates. */
export const TARGET_LABEL = (target: Target) => (target === 'final' ? 'Final' : KIND_LABEL[target])
export const TARGET_ICON = (target: Target) => (target === 'final' ? FINAL_ICON : KIND_ICON[target])

/**
 * Where a file goes: a radio group of lanes (and alternates, when offered) with the current one checked. One menu for
 * moving a version (its Move button), choosing where a new file lands (the new-release dialog) and which alternate to
 * add. `test` marks a test bounce: its Final item says it asks for the WAV instead of filing the test.
 */
export function LaneMenu({ title, value, options, onChange, test, align = 'end', children }: {
  title?: string
  value: Target | null
  options: readonly Target[]
  onChange: (target: Target) => void
  test?: boolean
  align?: 'start' | 'end'
  /** The trigger. */
  children: ReactElement
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Content align={align} className="min-w-[12rem]">
        {title && <p className="readout px-3 pt-2 pb-1 text-ink-muted">{title}</p>}
        <DropdownMenu.RadioGroup value={value ?? ''} onValueChange={(next) => onChange(next as Target)}>
          {options.map((target) => {
            const Icon = TARGET_ICON(target)
            return (
              <DropdownMenu.RadioItem key={target} value={target} className="gap-2">
                <Icon size={14} aria-hidden="true" className="text-ink-muted" />
                {target === 'final' && test ? 'Final: send its WAV…' : TARGET_LABEL(target)}
              </DropdownMenu.RadioItem>
            )
          })}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
