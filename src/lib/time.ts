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

/** `day` moved by `by` days. */
function shift(day: LocalDate, by: number): LocalDate {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + by))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

const day = (y: number, m: number, d: number): LocalDate | null => {
  const text = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return isLocalDate(text) ? text : null
}

/** The order the locale writes a numeric date in: ['month', 'day', 'year'] for en-US, day first for en-GB. */
function numericOrder(locale?: string): ('day' | 'month' | 'year')[] {
  const order = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(Date.UTC(2006, 10, 22)))
    .flatMap((p) => (p.type === 'day' || p.type === 'month' || p.type === 'year' ? [p.type] : []))
  return order.length === 3 ? order : ['month', 'day', 'year']
}

/** A month named by 3+ letters of its name, in the locale's words or English: 1–12, or null. */
function monthNamed(word: string, locale?: string): number | null {
  if (word.length < 3) return null
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ.]/g, '').toLowerCase()
  for (const l of new Set([locale, 'en-US'])) {
    for (const width of ['long', 'short'] as const) {
      const names = Array.from({ length: 12 }, (_, i) => fold(formatter(`mon|${l}|${width}`, { timeZone: 'UTC', month: width }, l).format(new Date(Date.UTC(2006, i, 15)))))
      const hit = names.findIndex((n) => n.startsWith(fold(word)) || fold(word).startsWith(n))
      if (hit >= 0) return hit + 1
    }
  }
  return null
}

/**
 * What an artist types for a day, read leniently (Postel): `2026-10-12`, the locale's numeric order (`10/12/2026`,
 * `12.10.26`), a month by name (`Oct 12`, `12 October 2026`), or `today`, `yesterday`, `tomorrow`. A missing year is
 * this year (`today`'s); a two-digit year is 20yy. Null when it isn't a day. The one parser of typed dates; nothing
 * parses what Mixlog printed.
 */
export function parseDay(text: string, today: LocalDate, locale?: string): LocalDate | null {
  const s = text.trim().toLowerCase()
  if (!s) return null
  if (s === 'today') return today
  if (s === 'yesterday') return shift(today, -1)
  if (s === 'tomorrow') return shift(today, 1)
  const year = Number(today.slice(0, 4))
  const full = (y: number) => (y < 100 ? 2000 + y : y)
  const parts = s.split(/[\s,./-]+/).filter(Boolean)
  const words = parts.filter((p) => !/^\d+(st|nd|rd|th)?$/.test(p))
  if (words.length === 1 && parts.length >= 2 && parts.length <= 3) {
    // A month by name, with a day and perhaps a year, either side of it.
    const month = monthNamed(words[0].replace(/(st|nd|rd|th)$/, ''), locale)
    const nums = parts.filter((p) => p !== words[0]).map((p) => parseInt(p, 10))
    if (month === null || nums.length !== parts.length - 1) return null
    const [d, y] = parts.indexOf(words[0]) === 0 ? nums : nums[0] > 31 ? [nums[1], nums[0]] : nums
    return day(full(y ?? year), month, d)
  }
  if (words.length > 0 || parts.length < 2 || parts.length > 3) return null
  const nums = parts.map(Number)
  if (parts[0].length === 4) return nums.length === 3 ? day(nums[0], nums[1], nums[2]) : null // year first: ISO
  const order = numericOrder(locale)
  const at = (kind: 'day' | 'month' | 'year') => nums[order.indexOf(kind)]
  if (nums.length === 3) return day(full(at('year')), at('month'), at('day'))
  // Two numbers: the locale's month and day, this year.
  const [first, second] = order.filter((k) => k !== 'year')
  return day(year, nums[first === 'month' ? 0 : 1], nums[second === 'day' ? 1 : 0])
}
