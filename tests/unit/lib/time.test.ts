import { describe, expect, it } from 'vitest'

import { dayOf, formatDay, formatMoment, isLocalDate, isZone, todayIn } from '#/lib/time'

describe('time', () => {
  it('reads a moment as the day it fell on in a zone', () => {
    expect(dayOf('2026-08-01T02:00:00Z', 'America/Toronto')).toBe('2026-07-31')
    expect(dayOf('2026-08-01T02:00:00Z', 'Pacific/Kiritimati')).toBe('2026-08-01')
    expect(todayIn('Pacific/Pago_Pago', new Date('2026-01-01T05:00:00Z'))).toBe('2025-12-31')
  })

  it('shows a day as stored, whatever the machine’s zone', () => {
    expect(formatDay('2026-08-01', '2026-10-30', 'en-US')).toBe('Aug 1')
    expect(formatDay('2025-12-31', '2026-10-30', 'en-US')).toBe('Dec 31, 2025')
  })

  it('reads a version’s moment as the day and time it landed in the zone, in the locale’s clock', () => {
    // 02:05 UTC on Aug 1 is still Jul 31 in Toronto: the day and the time move together.
    expect(formatMoment('2026-08-01T02:05:00.000Z', 'America/Toronto', '2026-10-30', 'en-GB')).toBe('31 Jul · 22:05')
    expect(formatMoment('2026-08-01T02:05:00.000Z', 'Asia/Kolkata', '2026-10-30', 'en-GB')).toBe('1 Aug · 7:35')
    expect(formatMoment('2025-12-31T23:30:00.000Z', 'UTC', '2026-10-30', 'en-US').replace(/\s/g, ' ')).toBe('Dec 31, 2025 · 11:30 PM')
  })

  it('knows a day and a zone when it sees one', () => {
    expect(isLocalDate('2026-02-29')).toBe(false)
    expect(isLocalDate('2028-02-29')).toBe(true)
    expect(isLocalDate('2026-08-01T00:00:00Z')).toBe(false)
    expect(isZone('America/Toronto')).toBe(true)
    expect(isZone('Mars/Olympus')).toBe(false)
  })
})
