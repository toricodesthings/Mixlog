import { afterEach, expect, it, vi } from 'vitest'

import { livePicture, ogImage, pictureLink } from '#/server/live-picture'

afterEach(() => vi.unstubAllGlobals())

it('reads og:image in either attribute order, unescaped', () => {
  expect(ogImage('<meta property="og:image" content="https://i.scdn.co/a?x=1&amp;y=2"/>')).toBe('https://i.scdn.co/a?x=1&y=2')
  expect(ogImage('<meta content="https://x/b.jpg" property="og:image">')).toBe('https://x/b.jpg')
  expect(ogImage('<meta property="og:image:width" content="640"><meta property="og:title" content="t">')).toBeNull()
})

it('names the sharpest platform linked, and ignores what it can’t read', () => {
  expect(pictureLink(['https://instagram.com/kai', 'mailto:kai@x.com'])).toBeNull()
  expect(pictureLink(['https://open.spotify.com/artist/1', 'https://music.apple.com/us/artist/kai/2'])).toEqual({ url: 'https://music.apple.com/us/artist/kai/2', name: 'Apple Music' })
  expect(pictureLink(['https://notspotify.com/x'])).toBeNull()
})

const page = (image: string) => new Response(`<meta property="og:image" content="${image}">`)
const jpeg = () => new Response('img', { headers: { 'content-type': 'image/jpeg' } })

it('fetches the picture the page names, asked for square on Apple Music', async () => {
  const fetched: string[] = []
  vi.stubGlobal('fetch', async (url: string) => (fetched.push(url), url.includes('music.apple.com') ? page('https://is1-ssl.mzstatic.com/image/thumb/a/b.png/1200x630cw.png') : jpeg()))
  expect(await livePicture(['https://music.apple.com/us/artist/kai/2'])).toMatchObject({ type: 'image/jpeg' })
  expect(fetched[1]).toBe('https://is1-ssl.mzstatic.com/image/thumb/a/b.png/2000x2000bb.jpg')
})

it('fetches nothing from a host it doesn’t know, and anything but an image is no picture', async () => {
  const fetched: string[] = []
  vi.stubGlobal('fetch', async (url: string) => (fetched.push(url), page('https://evil.example/x.jpg')))
  expect(await livePicture(['https://open.spotify.com/artist/1'])).toBeNull()
  expect(fetched).toEqual(['https://open.spotify.com/artist/1'])

  vi.stubGlobal('fetch', async (url: string) => (url.includes('spotify.com') ? page('https://i.scdn.co/image/a') : new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })))
  expect(await livePicture(['https://open.spotify.com/artist/1'])).toBeNull()

  vi.stubGlobal('fetch', async () => { throw new Error('down') })
  expect(await livePicture(['https://open.spotify.com/artist/1'])).toBeNull()
})
