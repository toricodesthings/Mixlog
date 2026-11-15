import { describe, expect, it } from 'vitest'

import { lufsOf } from '#/hooks/ui/use-listening'

describe('a typed custom level', () => {
  it('reads loudness as negative, held to −32…0', () => {
    expect(lufsOf('14')).toBe(-14)
    expect(lufsOf('-9.5')).toBe(-9.5)
    expect(lufsOf('−11')).toBe(-11)
    expect(lufsOf('40')).toBe(-32)
    expect(lufsOf('0')).toBe(-0)
    expect(lufsOf('loud')).toBeNull()
  })
})
