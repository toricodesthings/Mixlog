import { describe, expect, it } from 'vitest'

import { meterHostAnswer } from '#/server/meter-host'

describe('meterHostAnswer', () => {
  it('serves the page and its built files', () => {
    for (const path of ['/', '/meter', '/meter/', '/assets/x.js', '/brand/mixlog-mark.svg', '/favicon.ico']) expect(meterHostAnswer('GET', path)).toBe('page')
    expect(meterHostAnswer('HEAD', '/')).toBe('page')
  })
  it('refuses server functions, /api and every other method', () => {
    for (const path of ['/_serverFn/x', '/_serverFn', '/api/files/x', '/api']) expect(meterHostAnswer('GET', path)).toBe('refuse')
    expect(meterHostAnswer('POST', '/')).toBe('refuse')
    expect(meterHostAnswer('POST', '/_serverFn/x')).toBe('refuse')
    expect(meterHostAnswer('PUT', '/assets/x.js')).toBe('refuse')
    expect(meterHostAnswer('OPTIONS', '/')).toBe('refuse')
  })
  it('gives any other address the page shell as a 404, never its own route', () => {
    for (const path of ['/upcoming', '/releases/x', '/apiary', '/site.webmanifest', '/meterx']) expect(meterHostAnswer('GET', path)).toBe('not-found')
  })
})
