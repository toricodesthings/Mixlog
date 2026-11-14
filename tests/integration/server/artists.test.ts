import { expect, it } from 'vitest'

import { call } from '../../support/start'
import { createArtist, getArtist, listArtists, setTrackArtists } from '#/server/artists'
import { createRelease, getRelease } from '#/server/releases'

it('bills artists on a track, main before featured, and saving again replaces the billing whole', async () => {
  const { id, trackIds: [t] } = await call(createRelease, { title: 'Glass City', format: 'ep', tracks: ['Glass City', 'Neon Rain'] })
  const nova = (await call(createArtist, { name: 'Nova', role: null })).id
  const kai = (await call(createArtist, { name: 'Kai', role: 'Producer' })).id
  await call(setTrackArtists, { trackId: t, artists: [{ id: kai, role: 'featured' }, { id: nova, role: 'artist' }] })
  const billed = async () => (await call(getRelease, id)).artists.map((a) => [a.track_id, a.name, a.role])
  expect(await billed()).toEqual([[t, 'Nova', 'artist'], [t, 'Kai', 'featured']])
  expect((await call(listArtists)).find((a) => a.id === nova)?.track_count).toBe(1)
  expect((await call(getArtist, nova)).tracks).toMatchObject([{ id: t, release_id: id, role: 'artist' }])

  await call(setTrackArtists, { trackId: t, artists: [{ id: kai, role: 'artist' }] })
  expect(await billed()).toEqual([[t, 'Kai', 'artist']])
  await call(setTrackArtists, { trackId: t, artists: [] })
  expect(await billed()).toEqual([])

  await expect(call(setTrackArtists, { trackId: t, artists: [{ id: kai, role: 'artist' }, { id: kai, role: 'featured' }] })).rejects.toThrow('on a track once')
  await expect(call(setTrackArtists, { trackId: crypto.randomUUID(), artists: [] })).rejects.toThrow('not available')
})
