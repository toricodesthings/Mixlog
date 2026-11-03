import { expect, it } from 'vitest'

import { call } from '../../support/start'
import { createRelease, getRelease } from '#/server/releases'
import { saveLyrics } from '#/server/tracks'

it('saves lyrics as typed, last save wins, and an emptied page clears them', async () => {
  const { id, trackIds: [t] } = await call(createRelease, { title: 'Night Drive', format: 'single', tracks: [] })
  const lyrics = async () => (await call(getRelease, id)).tracks[0].lyrics
  await call(saveLyrics, { trackId: t, lyrics: '#VERSE\n  Headlights\n' })
  await call(saveLyrics, { trackId: t, lyrics: '#VERSE\n  Headlights on the bridge\n' })
  expect(await lyrics()).toBe('#VERSE\n  Headlights on the bridge')
  await call(saveLyrics, { trackId: t, lyrics: ' \n' })
  expect(await lyrics()).toBeNull()
  await expect(call(saveLyrics, { trackId: crypto.randomUUID(), lyrics: 'x' })).rejects.toMatchObject({ isNotFound: true })
})
