import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

const keySets = new Map<string, JWTVerifyGetKey>()

/** The team's public signing keys, fetched once per isolate (jose caches and rotates them). */
export function accessKeys(teamDomain: string): JWTVerifyGetKey {
  let keys = keySets.get(teamDomain)
  if (!keys) {
    keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', teamDomain))
    keySets.set(teamDomain, keys)
  }
  return keys
}

/**
 * True only if the request carries a Cloudflare Access token signed by the team, for this application.
 * Fails closed: missing config, a missing header, or any verification error is a no.
 */
export async function isAllowed(
  request: Request,
  teamDomain: string | undefined,
  aud: string | undefined,
  keys: JWTVerifyGetKey | undefined = teamDomain ? accessKeys(teamDomain) : undefined,
): Promise<boolean> {
  const token = request.headers.get('cf-access-jwt-assertion')
  if (!teamDomain || !aud || !token || !keys) return false
  try {
    await jwtVerify(token, keys, { issuer: teamDomain, audience: aud })
    return true
  } catch {
    return false
  }
}
