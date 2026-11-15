/** What every answer from the Worker says about how a browser may use it. A response that already says one keeps
 *  its own (a file's sandboxing CSP, a later public route's own policy). */
export const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'same-origin',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'x-robots-tag': 'noindex, nofollow',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  // Only what can't break a page: no framing, no <base> or form pointed elsewhere, no plugins. Scripts come later.
  'content-security-policy': "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
}

export function withSecurityHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) if (!response.headers.has(name)) response.headers.set(name, value)
  return response
}
