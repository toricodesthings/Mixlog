import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose'
import { expect, test } from 'vitest'

import { accessClaims, isAllowed } from '#/server/access'

const team = 'https://mixlog-test.cloudflareaccess.com'
const aud = 'app-aud'
const { publicKey, privateKey } = await generateKeyPair('RS256')
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: 'RS256' }] })

const sign = (claims: { iss?: string; aud?: string; exp?: string; email?: string } = {}, key = privateKey) =>
  new SignJWT(claims.email ? { email: claims.email } : {})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(claims.iss ?? team)
    .setAudience(claims.aud ?? aud)
    .setExpirationTime(claims.exp ?? '5m')
    .sign(key)
const request = (token?: string) =>
  new Request('https://mixlog.test/', token ? { headers: { 'cf-access-jwt-assertion': token } } : {})

test('lets a valid Access token through', async () => {
  expect(await isAllowed(request(await sign()), team, aud, keys)).toBe(true)
})

test('refuses everything else', async () => {
  const stranger = (await generateKeyPair('RS256')).privateKey
  expect(await isAllowed(request(), team, aud, keys)).toBe(false)
  expect(await isAllowed(request(await sign({ aud: 'other-app' })), team, aud, keys)).toBe(false)
  expect(await isAllowed(request(await sign({ iss: 'https://evil.cloudflareaccess.com' })), team, aud, keys)).toBe(false)
  expect(await isAllowed(request(await sign({ exp: '-1m' })), team, aud, keys)).toBe(false)
  expect(await isAllowed(request(await sign({}, stranger)), team, aud, keys)).toBe(false)
  expect(await isAllowed(request(await sign()), team, '', keys)).toBe(false)
})

test('reads the email from a valid token only', async () => {
  expect((await accessClaims(request(await sign({ email: 'kai@example.com' })), team, aud, keys))?.email).toBe('kai@example.com')
  expect(await accessClaims(request(await sign({ email: 'kai@example.com', aud: 'other-app' })), team, aud, keys)).toBeNull()
})
