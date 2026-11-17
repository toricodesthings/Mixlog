import { env } from 'cloudflare:workers'
import { getRequest } from '@tanstack/react-start/server'
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose'
import { z } from 'zod'

import { report } from '#/server/log'

let teamKeys: JWTVerifyGetKey | undefined

/** The team's public signing keys, fetched once per isolate (jose caches and rotates them). A deployment has one team. */
const accessKeys = (teamDomain: string) => (teamKeys ??= createRemoteJWKSet(new URL('/cdn-cgi/access/certs', teamDomain)))

/**
 * The claims of a Cloudflare Access token signed by the team, for this application; null for anything else.
 * Fails closed: missing config, a missing header, or any verification error is a null.
 */
export async function accessClaims(
  request: Request,
  teamDomain: string | undefined,
  aud: string | undefined,
  keys: JWTVerifyGetKey | undefined = teamDomain ? accessKeys(teamDomain) : undefined,
): Promise<JWTPayload | null> {
  const token = request.headers.get('cf-access-jwt-assertion')
  if (!teamDomain || !aud || !token || !keys) return null
  try {
    return (await jwtVerify(token, keys, { issuer: teamDomain, audience: aud })).payload
  } catch (error) {
    // Access checked this token at the edge, so a no here is a fault (keys unreachable, a changed AUD), not a stranger.
    report('warn', 'Access token refused', error)
    return null
  }
}

/** True only if the request carries a Cloudflare Access token signed by the team, for this application. */
export const isAllowed = async (...args: Parameters<typeof accessClaims>) => (await accessClaims(...args)) !== null

/** The email Access signed the current request in as, or null (`pnpm dev` has no Access). Read from the verified token only. */
export async function accessEmail(): Promise<string | null> {
  if (import.meta.env.DEV) return null
  const claims = await accessClaims(getRequest(), env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD)
  return z.string().email().safeParse(claims?.email).data ?? null
}

/** The door every server function and /api handler goes through: this deployment's Access token, or `pnpm dev`. */
export const allowed = async (request: Request) => import.meta.env.DEV || (await isAllowed(request, env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD))
