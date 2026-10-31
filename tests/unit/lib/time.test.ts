import { describe, expect, it } from 'vitest'

import { dayOf, formatDay, isLocalDate, isZone, todayIn } from '#/lib/time'

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

  it('knows a day and a zone when it sees one', () => {
    expect(isLocalDate('2026-02-29')).toBe(false)
    expect(isLocalDate('2028-02-29')).toBe(true)
    expect(isLocalDate('2026-08-01T00:00:00Z')).toBe(false)
    expect(isZone('America/Toronto')).toBe(true)
    expect(isZone('Mars/Olympus')).toBe(false)
  })
})
