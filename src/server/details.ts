/** A release's Details, as the artist types them: pure rules, shared with the browser and unit-tested. */
import { z } from 'zod'

import { Id, readWith } from '#/server/input'
import { isLocalDate, isZone, todayIn, type LocalDate } from '#/lib/time'

export type ReleaseFormat = 'single' | 'ep' | 'album'

/** An ISRC as distributors print it, `CC-XXX-YY-NNNNN`, read with or without dashes. Stored as its 12 characters. */
export function isrcOf(value: string): string | null {
  const isrc = value.replace(/[\s-]/g, '').toUpperCase()
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc) ? isrc : null
}

/** A UPC (12 digits) or EAN (13), spaces ignored, its last digit the GTIN check digit. */
export function upcOf(value: string): string | null {
  const upc = value.replace(/\s/g, '')
  if (!/^\d{12,13}$/.test(upc)) return null
  // Weights 3,1,3,1… from the right, skipping the check digit; the total comes to a multiple of 10.
  const sum = [...upc.slice(0, -1)].reverse().reduce((total, d, i) => total + Number(d) * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === Number(upc.at(-1)) ? upc : null
}

export type ReleaseDetails = {
  id: string
  title: string
  format: ReleaseFormat
  /** Upcoming: the planned day, or null. Releases: the day it went out, never null and never ahead of today. */
  releaseDate: LocalDate | null
  upc: string | null
  tracks: { id: string; title: string; isrc: string | null }[]
}

const TITLE = 'A title is 1 to 200 characters.'
export const Title = z.string(TITLE).trim().min(1, TITLE).max(200, TITLE)
export const Format = z.enum(['single', 'ep', 'album'], 'A release is a single, an EP or an album.')
/** A calendar day, read through `lib/time` like every date. */
export const LocalDay = z.string('That isn’t a day.').refine(isLocalDate, 'That isn’t a day.')
const Tracks = <T extends z.ZodType>(track: T) => z.array(track, 'A release has at most 100 tracks.').max(100, 'A release has at most 100 tracks.')
const SINGLE = 'A single has one track. Make it an EP to keep them all.'

/** A field that may be left empty (null), or else must read as `parse` says. */
const optional = (parse: (value: string) => string | null, problem: (value: string) => string) =>
  z
    .string()
    .nullish()
    .transform((value, ctx) => {
      if (!value?.trim()) return null
      const read = parse(value)
      if (read === null) ctx.addIssue({ code: 'custom', message: problem(value) })
      return read
    })

const Details = z
  .object({
    id: Id('Not a release.'),
    title: Title,
    format: Format,
    releaseDate: z.union([LocalDay, z.literal(''), z.null(), z.undefined()]).transform((day) => day || null),
    upc: optional(upcOf, () => 'That isn’t a UPC: 12 digits (13 for an EAN), as your distributor gave it.'),
    tracks: Tracks(z.object({ id: Id('Not a track.'), title: z.string().optional(), isrc: optional(isrcOf, (v) => `“${v}” isn’t an ISRC (CC-XXX-YY-NNNNN).`) })),
    released: z.boolean().default(false),
    zone: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.format === 'single' && d.tracks.length > 1) ctx.addIssue({ code: 'custom', message: SINGLE })
    if (d.released && (d.releaseDate === null || !isZone(d.zone) || d.releaseDate > todayIn(d.zone)))
      ctx.addIssue({ code: 'custom', message: 'A release went out on a day that has come.' })
    // A single's track is named like it; an EP's are titles like any other.
    if (d.format !== 'single' && d.tracks.some((t) => !Title.safeParse(t.title).success)) ctx.addIssue({ code: 'custom', message: TITLE })
  })
  .transform(({ zone: _, ...d }) => ({
    ...d,
    tracks: d.tracks.map((t) => ({ id: t.id, title: d.format === 'single' ? d.title : Title.parse(t.title), isrc: t.isrc })),
  }))

/** Checks a Details save. `released` says which section it's in; `zone` is the artist's, for "not ahead of today". */
export const detailsInput: (input: unknown) => ReleaseDetails & { released: boolean } = readWith(Details)
