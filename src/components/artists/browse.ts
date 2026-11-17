import { ArrowDownAZ, ArrowDownWideNarrow, BadgeCheck } from 'lucide-react'
import { z } from 'zod'

import type { ArtistRow } from '#/server/artists'
import { fold } from '../../lib/utils'
import type { SortOption } from '../shared/SortMenu'

type ArtistSort = 'name' | 'tracks' | 'role'

/** `?q=&sort=&view=&add` on Artists. Defaults are left out, so a plain link is the cards, A to Z. */
export type ArtistSearch = { q?: string; sort?: Exclude<ArtistSort, 'name'>; view?: 'list'; add?: true }

export const ARTIST_SORTS: SortOption<ArtistSort>[] = [
  { value: 'name', label: 'Name', icon: ArrowDownAZ },
  { value: 'tracks', label: 'Most tracks', icon: ArrowDownWideNarrow },
  { value: 'role', label: 'Role', icon: BadgeCheck },
]

// Anything unreadable falls back to its default rather than refusing: a stale link still opens the page.
const Params = z.object({
  q: z.string().min(1).optional().catch(undefined),
  sort: z.enum(['tracks', 'role']).optional().catch(undefined),
  view: z.literal('list').optional().catch(undefined),
  add: z.literal(true).optional().catch(undefined),
})

/** Reads (and tidies) the page's search params: unknown ones and defaults left out. */
export function artistSearch(search: Record<string, unknown>): ArtistSearch {
  return Object.fromEntries(Object.entries(Params.parse(search)).filter(([, v]) => v !== undefined))
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })

/** Every word of the query, in any order, any case, accents ignored, against the name and the role; then the order:
 *  A to Z, most tracks first, or grouped by role (no role last). Ties fall back to A to Z. */
export function matchArtists<T extends Pick<ArtistRow, 'name' | 'role' | 'track_count'>>(artists: T[], query: string, sort: ArtistSort = 'name'): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  const first = {
    name: () => 0,
    tracks: (a: T, b: T) => b.track_count - a.track_count,
    role: (a: T, b: T) => (a.role === null) !== (b.role === null) ? (a.role === null ? 1 : -1) : byName(a.role ?? '', b.role ?? ''),
  }[sort]
  return artists
    .filter((a) => words.every((w) => fold(`${a.name} ${a.role ?? ''}`).includes(w)))
    .sort((a, b) => first(a, b) || byName(a.name, b.name))
}

/** "1 track", "3 tracks". */
export const tracksOf = (n: number) => `${n} ${n === 1 ? 'track' : 'tracks'}`
