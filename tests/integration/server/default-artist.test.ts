import { describe, expect, it } from 'vitest'

import { sqlite } from '../../support/cloudflare-workers'
import { call } from '../../support/start'
import { createArtist, getArtist, updateArtist } from '#/server/artists'
import { addTrack, createRelease, getRelease, listUpcoming } from '#/server/releases'
import { getSettings, saveDefaultArtist } from '#/server/settings'

const onTrack = (trackId: string) => sqlite.prepare('SELECT artist_id, role FROM track_artists WHERE track_id = ?').all(trackId)

describe('the default artist', () => {
  it('starts every new track with them, unless the dialog says otherwise', async () => {
    const { id: shep } = await call(createArtist, { name: 'Shep', role: 'Artist' })
    const { id: guest } = await call(createArtist, { name: 'Guest', role: null })
    await call(saveDefaultArtist, shep)
    expect((await call(getSettings)).defaultArtist).toBe(shep)

    const ep = await call(createRelease, { title: 'Two', format: 'ep', tracks: ['A', 'B'] })
    for (const t of ep.trackIds) expect(onTrack(t)).toEqual([{ artist_id: shep, role: 'artist' }])
    const { id: third } = await call(addTrack, { releaseId: ep.id, title: 'C' })
    expect(onTrack(third)).toEqual([{ artist_id: shep, role: 'artist' }])

    const picked = await call(createRelease, { title: 'Guest Spot', format: 'single', tracks: [], artistId: guest })
    expect(onTrack(picked.trackIds[0])).toEqual([{ artist_id: guest, role: 'artist' }])
    const none = await call(createRelease, { title: 'Alone', format: 'single', tracks: [], artistId: null })
    expect(onTrack(none.trackIds[0])).toEqual([])

    // The list's cards carry each release's main artists, once each
    expect((await call(listUpcoming)).find((r) => r.id === ep.id)?.artists.map((a) => a.name)).toEqual(['Shep'])
    expect((await call(getRelease, ep.id)).release.id).toBe(ep.id)

    await call(saveDefaultArtist, null)
    expect((await call(getSettings)).defaultArtist).toBeNull()
  })
})

describe('an artist’s roles and links', () => {
  it('keeps supporting roles apart from the main one, and emails as mailto', async () => {
    const { id } = await call(createArtist, { name: 'Roles', role: 'Producer' })
    await call(updateArtist, { id, name: 'Roles', role: 'Producer', otherRoles: ['Songwriter', 'Producer', 'Songwriter'], links: ['someone@gmail.com', 'open.spotify.com/artist/x'] })
    const artist = await call(getArtist, id)
    expect(artist.other_roles).toEqual(['Songwriter'])
    expect(artist.links).toEqual(['mailto:someone@gmail.com', 'https://open.spotify.com/artist/x'])
    await expect(call(updateArtist, { id, name: 'Roles', role: null, otherRoles: [], links: ['javascript:alert(1)'] })).rejects.toThrow()
  })
})
