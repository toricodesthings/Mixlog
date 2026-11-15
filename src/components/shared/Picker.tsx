import { Fragment, useEffect, useId, useMemo, useState, type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { cn, matchesEvery } from '../../lib/utils'
import { Skeleton, useHoverSlide } from '../primitives'
import { SearchField } from '../primitives/SearchField'
import { Composer } from './Composer'
import { EmptyState } from './EmptyState'

/** A group of rows, drawn as a lane is on Tracks: its heading (an icon, the label and a count), a rule down its left,
 *  lit when `lit`; `section` (a track's title) heads the groups under it. */
export type PickerGroup<T> = { id: string; label: string | null; icon?: ReactNode; count?: number; section?: string | null; lit?: boolean; items: T[] }

/**
 * Pick one thing from a searchable, grouped list: a `Composer` (a dialog with a mouse, the glass sheet on a phone)
 * holding the search box and a listbox. No submit: choosing a row is the action. Keys as in Spotlight: focus stays in
 * the search box (with a mouse; on touch the keyboard waits for a tap), ↑ ↓ move the highlight, Enter picks, Escape
 * closes. One light glides to the highlight, under the pointer and under ↑ ↓, as on every list. It owns search,
 * groups, the highlight, keys and the empty state; the caller supplies the groups, each row's search text, and draws
 * the row. `problem` stands in for the list when it couldn't load; `tone` gives it a release's light.
 */
export function Picker<T>({ title, icon, eyebrow, groups, keyOf, textOf, renderRow, onPick, onClose, initial, label, placeholder, empty, problem, tone }: {
  title: string
  icon?: ComponentProps<typeof Composer>['icon']
  eyebrow?: ReactNode
  /** null while loading: skeleton rows. */
  groups: PickerGroup<T>[] | null
  keyOf: (item: T) => string
  textOf: (item: T) => string
  renderRow: (item: T, highlighted: boolean) => ReactNode
  onPick: (item: T) => void
  onClose: () => void
  /** The row to open on (highlighted and scrolled to). */
  initial?: string
  /** The search box's spoken name. */
  label: string
  placeholder: string
  /** What an empty result says. */
  empty: string
  problem?: ReactNode
  tone?: CSSProperties
}) {
  const { isTouch } = useShellMode()
  const [query, setQuery] = useState('')
  const shown = useMemo(() => (groups ?? []).map((g) => ({ ...g, items: g.items.filter((item) => matchesEvery(textOf(item), query)) })).filter((g) => g.items.length), [groups, query, textOf])
  const flat = shown.flatMap((g) => g.items)
  const [highlight, setHighlight] = useState<string | null>(initial ?? null)
  const current = flat.find((item) => keyOf(item) === highlight) ?? flat[0]
  const id = useId()
  const optionId = (item: T) => `${id}-${keyOf(item).replace(/\W/g, '')}`
  const slide = useHoverSlide()

  // Opens on the row now on that side; the highlight keeps in view as it moves, and the light goes with it. On open the
  // rows are still on their way into the dialog's portal, so it waits a frame or two for them.
  const currentKey = current ? keyOf(current) : null
  useEffect(() => {
    let frame = 0
    const go = (tries: number) => {
      const row = current ? document.getElementById(optionId(current)) : null
      if (current && !row && tries > 0) return void (frame = requestAnimationFrame(() => go(tries - 1)))
      row?.scrollIntoView({ block: 'nearest' })
      slide.to(row)
    }
    go(10)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, groups])

  const keys = (event: KeyboardEvent) => {
    if (!flat.length) return
    const at = current ? flat.indexOf(current) : -1
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = flat[Math.min(flat.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)))]
      setHighlight(keyOf(next))
    } else if (event.key === 'Enter' && current) {
      event.preventDefault()
      onPick(current)
    }
  }

  return (
    <Composer onClose={onClose} title={title} icon={icon} eyebrow={eyebrow} tone={tone} className="gap-4 sm:max-w-2xl [&>*]:min-w-0">
      <SearchField
        value={query}
        onValueChange={(next) => (setQuery(next), setHighlight(null))}
        onKeyDown={keys}
        aria-label={label}
        placeholder={placeholder}
        autoFocus={!isTouch}
        role="combobox"
        aria-expanded
        aria-controls={problem || groups === null ? undefined : `${id}-list`}
        aria-activedescendant={current ? optionId(current) : undefined}
      />
      {problem ?? (groups === null ? (
        <ul aria-busy="true" className="flex flex-col gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex min-h-14 items-center gap-3 px-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3.5 flex-1 rounded-full" />
              <Skeleton className="h-3 w-14 rounded-full" />
            </li>
          ))}
        </ul>
      ) : flat.length === 0 ? (
        <EmptyState flat readout="No signal" title={empty}>
          Try fewer words, or a version number like v4.
        </EmptyState>
      ) : (
        // Nothing between the listbox and an option is positioned: the light measures each row against the listbox
        <ul id={`${id}-list`} role="listbox" aria-label={title} {...slide.group} className="relative -mx-1 flex max-h-[min(34rem,62dvh)] flex-col overflow-y-auto px-1 pb-1">
          {slide.light}
          {shown.map((g, i) => {
            const heading = g.label && (g.section ? `${g.section}, ${g.label}` : g.label)
            return (
              <Fragment key={g.id}>
                {g.section && g.section !== shown[i - 1]?.section && (
                  <li role="presentation" className="px-2 pt-4 pb-1 font-display text-base font-semibold text-ink">{g.section}</li>
                )}
                <li role="presentation" className={cn('ml-1.5 flex flex-col border-l pl-1.5', g.lit ? 'border-accent/70' : 'border-line-strong')}>
                  {g.label && (
                    <p role="presentation" className="readout flex min-h-9 items-center gap-2 px-2 text-ink-muted">
                      {g.icon}
                      {g.label}
                      {g.count !== undefined && <span data-numeric>· {g.count}</span>}
                    </p>
                  )}
                  <ul role="group" aria-label={heading || undefined} className="flex flex-col gap-0.5">
                    {g.items.map((item) => {
                      const on = current === item
                      return (
                        <li
                          key={keyOf(item)}
                          id={optionId(item)}
                          role="option"
                          aria-selected={on}
                          {...slide.row}
                          onClick={() => onPick(item)}
                          onPointerMove={isTouch ? undefined : () => setHighlight(keyOf(item))}
                          className="group playhead-sweep relative flex min-h-14 cursor-pointer items-center gap-2 rounded-2xl px-2"
                        >
                          {renderRow(item, on)}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              </Fragment>
            )
          })}
        </ul>
      ))}
    </Composer>
  )
}
