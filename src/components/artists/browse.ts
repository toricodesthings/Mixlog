import { z } from 'zod'

import type { ArtistRow } from '#/server/artists'
import { fold } from '../../lib/utils'

/** `?q=&view=&add` on Artists. Cards are the default and left out, so a plain link is the cards, A to Z. */
export type ArtistSearch = { q?: string; view?: 'list'; add?: true }

// Anything unreadable falls back to its default rather than refusing: a stale link still opens the page.
const Params = z.object({
  q: z.string().min(1).optional().catch(undefined),
  view: z.literal('list').optional().catch(undefined),
  add: z.literal(true).optional().catch(undefined),
})

/** Reads (and tidies) the page's search params: unknown ones and defaults left out. */
export function artistSearch(search: Record<string, unknown>): ArtistSearch {
  return Object.fromEntries(Object.entries(Params.parse(search)).filter(([, v]) => v !== undefined))
}

/** Every word of the query, in any order, any case, accents ignored, against the name and the role. A to Z. */
export function matchArtists<T extends Pick<ArtistRow, 'name' | 'role'>>(artists: T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  return artists
    .filter((a) => words.every((w) => fold(`${a.name} ${a.role ?? ''}`).includes(w)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
}
