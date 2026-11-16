import { inflateSync } from 'node:zlib'
import { expect, it } from 'vitest'

import { objects } from '../../support/cloudflare-workers'
import { call } from '../../support/start'
import { seedDev } from '#/server/dev'
import { lanesOf } from '#/server/lanes'
import { getRelease, listReleased, listUpcoming } from '#/server/releases'

// The samples fill every lane the way uploads would: each file stored, numbered per song, finals pinned.
it('seeds every lane: tests, a master waiting to be picked, alternates, and Releases holding only what shipped', async () => {
  await call(seedDev)
  const releases = [...(await call(listUpcoming)), ...(await call(listReleased))]
  const lanes = Object.fromEntries(
    await Promise.all(
      releases.map(async (r) => {
        const { tracks, versions } = await call(getRelease, r.id)
        return tracks.map((t) => {
          const l = lanesOf(t.id, versions)
          const name = (v: { number: number; filename: string }) => `v${v.number} ${v.filename.split('.').pop()}`
          return [t.title, { final: l.final && name(l.final), master: l.master.map(name), mix: l.mix.map(name), alternates: l.alternates.map((a) => a.kind) }]
        })
      }),
    ).then((all) => all.flat()),
  )
  expect(lanes).toEqual({
    'Glass City': { final: 'v4 wav', master: ['v3 mp3'], mix: ['v2 mp3', 'v1 mp3'], alternates: ['instrumental'] },
    'Night Bus': { final: null, master: ['v2 mp3'], mix: ['v1 mp3'], alternates: [] },
    Lantern: { final: null, master: [], mix: ['v1 mp3'], alternates: [] },
    'Midnight Train': { final: null, master: ['v2 wav'], mix: ['v1 mp3'], alternates: [] },
    'First Light': { final: 'v1 wav', master: [], mix: [], alternates: [] },
    Tide: { final: 'v2 wav', master: [], mix: [], alternates: ['instrumental', 'acapella'] },
    Lamplight: { final: 'v2 wav', master: [], mix: [], alternates: [] },
    'Coast test': { final: null, master: [], mix: ['v1 mp3'], alternates: [] },
    'Highlands test': { final: null, master: [], mix: ['v1 mp3'], alternates: [] },
  })
  // The two landscape samples keep the night written for them, never the arpeggio's measured one
  const coast = await call(getRelease, releases.find((r) => r.title === 'Coast test')!.id)
  expect(coast.tracks[0].scene?.width).toBe(0.85)
  // …and a cover, a real PNG: its pixels inflate back to the gradient's first colour
  const png = [...objects.values()].find((o) => o.httpMetadata?.contentType === 'image/png')!.bytes
  expect([coast.versions.some((v) => v.kind === 'artwork'), [...png.slice(1, 4)]]).toEqual([true, [0x50, 0x4e, 0x47]])
  const idat = png.slice(41, 41 + new DataView(png.buffer, png.byteOffset).getUint32(33))
  expect([...inflateSync(idat).subarray(0, 4)]).toEqual([0, 64, 150, 170])
  const harbour = await call(getRelease, releases.find((r) => r.title === 'Harbour Lights')!.id)
  expect([harbour.pruned, harbour.versions.every((v) => v.released_at)]).toEqual([2, true])
  expect([...objects.values()].filter((o) => o.httpMetadata?.contentType === 'audio/mpeg')[0].bytes.slice(0, 3)).toEqual(new Uint8Array([0x49, 0x44, 0x33]))
})
