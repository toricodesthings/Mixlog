import { describe, expect, it } from 'vitest'

import { SECURITY_HEADERS, withSecurityHeaders } from '#/server/headers'

describe('withSecurityHeaders', () => {
  it('adds every header to a bare response', () => {
    const response = withSecurityHeaders(new Response('x'))
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(response.headers.get(name)).toBe(value)
  })

  it("keeps a header the response already set, and adds the rest", () => {
    const response = withSecurityHeaders(new Response('x', { headers: { 'content-security-policy': "default-src 'none'; sandbox" } }))
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox")
    expect(response.headers.get('x-frame-options')).toBe('DENY')
  })
})
