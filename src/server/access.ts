import { env } from 'cloudflare:workers'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

import { report } from '#/server/log'

let teamKeys: JWTVerifyGetKey | undefined

/** The team's public signing keys, fetched once per isolate (jose caches and rotates them). A deployment has one team. */
const accessKeys = (teamDomain: string) => (teamKeys ??= createRemoteJWKSet(new URL('/cdn-cgi/access/certs', teamDomain)))

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
  } catch (error) {
    // Access checked this token at the edge, so a no here is a fault (keys unreachable, a changed AUD), not a stranger.
    report('warn', 'Access token refused', error)
    return false
  }
}

/** The door every server function and /api handler goes through: this deployment's Access token, or `pnpm dev`. */
export const allowed = async (request: Request) => import.meta.env.DEV || (await isAllowed(request, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD))
