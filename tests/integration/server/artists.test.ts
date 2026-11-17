import { expect, it } from 'vitest'

import { objects, sqlite } from '../../support/cloudflare-workers'
import { call } from '../../support/start'
import { addArtistProfile } from '#/server/artist-files'
import { createArtist, getArtist, listArtists, setTrackArtists, updateArtist } from '#/server/artists'
import { createRelease, getRelease } from '#/server/releases'

it('puts artists on a track, main before featured, and saving again replaces them whole', async () => {
  const { id, trackIds: [t] } = await call(createRelease, { title: 'Glass City', format: 'ep', tracks: ['Glass City', 'Neon Rain'] })
  const nova = (await call(createArtist, { name: 'Nova', role: null })).id
  const kai = (await call(createArtist, { name: 'Kai', role: 'Producer' })).id
  await call(setTrackArtists, { trackId: t, artists: [{ id: kai, role: 'featured' }, { id: nova, role: 'artist' }] })
  const lineup = async () => (await call(getRelease, id)).artists.map((a) => [a.track_id, a.name, a.role])
  expect(await lineup()).toEqual([[t, 'Nova', 'artist'], [t, 'Kai', 'featured']])
  expect((await call(listArtists)).find((a) => a.id === nova)?.track_count).toBe(1)
  expect((await call(getArtist, nova)).tracks).toMatchObject([{ id: t, release_id: id, role: 'artist' }])

  await call(setTrackArtists, { trackId: t, artists: [{ id: kai, role: 'artist' }] })
  expect(await lineup()).toEqual([[t, 'Kai', 'artist']])
  await call(setTrackArtists, { trackId: t, artists: [] })
  expect(await lineup()).toEqual([])

  await expect(call(setTrackArtists, { trackId: t, artists: [{ id: kai, role: 'artist' }, { id: kai, role: 'featured' }] })).rejects.toThrow('on a track once')
  await expect(call(setTrackArtists, { trackId: crypto.randomUUID(), artists: [] })).rejects.toThrow('not available')
})

it('keeps an artist’s links, adds https when it’s left off, drops repeats and refuses other schemes', async () => {
  const { id } = await call(createArtist, { name: 'Kai', role: null })
  await call(updateArtist, { id, name: 'Kai', role: null, links: ['instagram.com/kai', 'https://instagram.com/kai'] })
  expect((await call(getArtist, id)).links).toEqual(['https://instagram.com/kai'])
  await expect(call(updateArtist, { id, name: 'Kai', role: null, links: ['http://example.com'] })).rejects.toThrow()
})

it('turns the live picture on (erasing an upload) and an upload turns it off', async () => {
  const { id } = await call(createArtist, { name: 'Kai', role: null })
  const other = (await call(createArtist, { name: 'Nova', role: null })).id
  const links = ['https://open.spotify.com/artist/1']
  const upload = () => addArtistProfile(new Request('https://mixlog.test', { method: 'POST', body: 'png', headers: { 'content-type': 'image/png', 'content-length': '3' } }), id)
  expect((await upload()).status).toBe(201)
  const [{ key }] = sqlite.prepare('SELECT profile_image_key AS key FROM artists WHERE id = ?').all(id) as { key: string }[]

  await call(updateArtist, { id, name: 'Kai', role: null, links, livePicture: true })
  const live = await call(getArtist, id)
  expect(live).toMatchObject({ live_picture: true, uploaded: false, profile_image_url: `/api/artists/${id}/profile?v=live` })
  expect(objects.has(key)).toBe(false)

  await call(updateArtist, { id, name: 'Kai', role: null, links: [] })
  expect((await call(getArtist, id)).profile_image_url).toBeNull() // no link to read it from

  await upload()
  expect(await call(getArtist, id)).toMatchObject({ live_picture: false, uploaded: true })
  expect(await call(getArtist, other)).toMatchObject({ uploaded: false, profile_image_url: null }) // only the one artist
})
