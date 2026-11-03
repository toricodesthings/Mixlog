// The one place that turns a moment into a day (Cadence's time model, trimmed: Mixlog deals in dates, never clock times,
// with one exception: a version, read as the day and time it landed, `formatMoment`). Pure, `Intl` only, so the server
// uses it too. Nothing else parses, slices or formats a date or a time.

/** A calendar day, `YYYY-MM-DD`, with no time and no zone: every date Mixlog shows or is told. */
export type LocalDate = string
/** A row's bookkeeping moment, ISO 8601 UTC as D1 writes it (`stamp` in server/schema.ts, the only writer). Read as the
 *  day it fell on (`dayOf`), or, for a version, the day and time it landed (`formatMoment`). */
export type Instant = string
/** An IANA zone name, e.g. `America/Toronto`. Never an offset, never "local". */
export type Zone = string

const formats = new Map<string, Intl.DateTimeFormat>()
function formatter(key: string, options: Intl.DateTimeFormatOptions, locale?: string) {
  let format = formats.get(key)
  if (!format) formats.set(key, (format = new Intl.DateTimeFormat(locale, options)))
  return format
}

export function isZone(value: unknown): value is Zone {
  if (typeof value !== 'string' || !value) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** The artist's zone: this device's. Every moment becomes a day in it.
 *  ponytail: device only; a Settings pin (Cadence's) when someone needs days in a zone they aren't in. */
export const deviceZone = (): Zone => Intl.DateTimeFormat().resolvedOptions().timeZone

/** The day a moment fell on in `zone`. */
export function dayOf(instant: Instant | Date, zone: Zone): LocalDate {
  const parts: Record<string, string> = {}
  const format = formatter(`day|${zone}`, { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-US')
  for (const p of format.formatToParts(typeof instant === 'string' ? new Date(instant) : instant)) parts[p.type] = p.value
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Today, in `zone`. */
export const todayIn = (zone: Zone, now: Date = new Date()): LocalDate => dayOf(now, zone)

/** The only date formatter. A day has no zone, so it reads as stored everywhere: "Oct 12" this year, "Oct 12, 2025" otherwise. */
export function formatDay(day: LocalDate, today: LocalDate, locale?: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const options: Intl.DateTimeFormatOptions = { timeZone: 'UTC', month: 'short', day: 'numeric', ...(day.slice(0, 4) !== today.slice(0, 4) && { year: 'numeric' }) }
  return formatter(`${locale}|${JSON.stringify(options)}`, options, locale).format(new Date(Date.UTC(y, m - 1, d, 12)))
}

/** The one time formatter, for the one exception to "dates, never clock times": a version, since an artist can bounce
 *  many in a day. The day it landed in `zone`, said as `formatDay` says it, and the time there in the locale's own
 *  clock: "Nov 2 · 9:14 PM", "2 Nov · 21:14". For reading only: nothing ever parses it back; the Instant is the record. */
export function formatMoment(instant: Instant, zone: Zone, today: LocalDate, locale?: string): string {
  const time = formatter(`time|${locale}|${zone}`, { timeZone: zone, hour: 'numeric', minute: '2-digit' }, locale).format(new Date(instant))
  return `${formatDay(dayOf(instant, zone), today, locale)} · ${time}`
}
