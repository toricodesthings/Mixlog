import { ArrowDownAZ, CalendarArrowDown, CalendarArrowUp, CalendarClock, type LucideIcon } from 'lucide-react'

import { z } from 'zod'

import type { ReleaseFormat, ReleaseRow } from '#/server/releases'
import { dayOf, formatDay, todayIn, type LocalDate, type Zone } from '../../lib/time'
import type { Section } from './sections'

/** How a section's releases show and in what order: all of it in the URL, so a refresh, Back or a link keeps it. */
export type View = 'list' | 'panels'
export type FormatFilter = 'all' | ReleaseFormat
export type SortMode = 'newest' | 'oldest' | 'planned' | 'title'

/** `?q=&format=&sort=&view=&upload` on Upcoming and Releases. Defaults are left out, so a plain link is the plain list. */
export type ListSearch = { q?: string; format?: ReleaseFormat; sort?: SortMode; view?: 'panels'; upload?: true }

// Anything unreadable is dropped back to its default rather than refused: a stale link still opens the list.
const ListParams = z.object({
  q: z.string().min(1).optional().catch(undefined),
  format: z.enum(['single', 'ep', 'album']).optional().catch(undefined),
  sort: z.enum(['oldest', 'planned', 'title']).optional().catch(undefined),
  view: z.literal('panels').optional().catch(undefined),
  upload: z.literal(true).optional().catch(undefined),
})

/** Reads (and tidies) the list's search params: unknown ones and defaults left out. */
export function listSearch(search: Record<string, unknown>): ListSearch {
  return Object.fromEntries(Object.entries(ListParams.parse(search)).filter(([, v]) => v !== undefined))
}

/** Upcoming dates by the day it was started; Releases by the day it went out (its release day, else the day it was stamped). */
export function releaseDay(section: Section, release: ReleaseRow, zone: Zone): LocalDate {
  if (section === 'released' && release.release_date) return release.release_date
  return dayOf(section === 'released' ? (release.released_at ?? release.created_at) : release.created_at, zone)
}

/** *Started Oct 12* or *Released Oct 12*, in the artist's zone. */
export const dateLabel = (section: Section, release: ReleaseRow, zone: Zone) =>
  `${section === 'upcoming' ? 'Started' : 'Released'} ${formatDay(releaseDay(section, release, zone), todayIn(zone))}`

export const SORTS: Record<Section, { value: SortMode; label: string; icon: LucideIcon }[]> = {
  upcoming: [
    { value: 'newest', label: 'Newest started', icon: CalendarArrowDown },
    { value: 'oldest', label: 'Oldest started', icon: CalendarArrowUp },
    { value: 'planned', label: 'Planned date', icon: CalendarClock },
    { value: 'title', label: 'Title', icon: ArrowDownAZ },
  ],
  released: [
    { value: 'newest', label: 'Newest out', icon: CalendarArrowDown },
    { value: 'oldest', label: 'Oldest out', icon: CalendarArrowUp },
    { value: 'title', label: 'Title', icon: ArrowDownAZ },
  ],
}

/** A saved value this section still offers, else its default. */
export const sortOf = (section: Section, saved: string | null): SortMode => SORTS[section].find((s) => s.value === saved)?.value ?? 'newest'

/** Search (title, any word order, any case), then the format filter, then the order. Never mutates its input. */
export function browse(section: Section, releases: ReleaseRow[], { query, format, sort, zone }: { query: string; format: FormatFilter; sort: SortMode; zone: Zone }) {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const shown = releases.filter(
    (r) => (format === 'all' || r.format === format) && words.every((w) => r.title.toLocaleLowerCase().includes(w)),
  )
  // By day, then by which was added first that day.
  const byDate = (a: ReleaseRow, b: ReleaseRow) =>
    releaseDay(section, a, zone).localeCompare(releaseDay(section, b, zone)) || Date.parse(a.created_at) - Date.parse(b.created_at)
  const byTitle = (a: ReleaseRow, b: ReleaseRow) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true })
  const compare = {
    newest: (a: ReleaseRow, b: ReleaseRow) => byDate(b, a),
    oldest: byDate,
    // Dated first, soonest on top; undated after, newest started first.
    planned: (a: ReleaseRow, b: ReleaseRow) =>
      a.release_date && b.release_date ? a.release_date.localeCompare(b.release_date) : a.release_date ? -1 : b.release_date ? 1 : byDate(b, a),
    title: byTitle,
  }[sort]
  return [...shown].sort(compare)
}

/** 3:41, or 1:02:09 past an hour. */
export function formatLength(ms: number) {
  const s = Math.round(ms / 1000)
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** The facts under a release's title, in the order you'd ask: format, tracks, length. Date is said separately. */
export function releaseFacts(release: ReleaseRow, formatLabel: string) {
  return [
    formatLabel,
    release.format === 'single' ? null : `${release.track_count} ${release.track_count === 1 ? 'track' : 'tracks'}`,
    release.duration_ms ? formatLength(release.duration_ms) : null,
  ].filter((f): f is string => f !== null)
}
