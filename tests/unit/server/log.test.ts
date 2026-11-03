import { notFound, redirect } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Refusal } from '#/server/input'
import { isAnswer, report } from '#/server/log'

afterEach(() => vi.restoreAllMocks())

describe('report', () => {
  it('logs the error itself, its cause and the context, at its level', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cause = new Error('D1_ERROR: no such table')
    const failure = new Error('Failed query', { cause })
    report('error', 'getRelease failed', failure, { data: { id: 'a' } })
    expect(error).toHaveBeenCalledWith('getRelease failed', failure, cause, { data: { id: 'a' } })
  })

  it('leaves out what it was not given', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    report('warn', 'Access token refused', 'expired')
    expect(warn).toHaveBeenCalledWith('Access token refused', 'expired')
  })
})

describe('isAnswer', () => {
  it('lets refusals, not-founds and redirects through, and nothing else', () => {
    expect(isAnswer(new Refusal('This release is already out.'))).toBe(true)
    expect(isAnswer(notFound())).toBe(true)
    expect(isAnswer(redirect({ to: '/upcoming' }))).toBe(true)
    expect(isAnswer(new Error('D1_ERROR'))).toBe(false)
    expect(isAnswer(new TypeError('x is undefined'))).toBe(false)
  })

  it('a refusal carries a status, so Start does not log it', () => {
    expect(new Refusal('No').status).toBe(400)
    expect(new Refusal('Forbidden', 403).status).toBe(403)
  })
})
