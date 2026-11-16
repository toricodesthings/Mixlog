// An artist's picture read live from one of their links (the switch on their page), never stored: the Worker
// fetches it each time its cache runs out, so it follows whatever the artist shows there. Pure fetch, no bindings,
// so the editor can name the platform with `pictureLink` and tests can run it in Node.

type Platform = {
  name: string
  /** The artist pages it reads (an exact host or a subdomain of it). */
  hosts: string[]
  /** Where the picture is, from the page; null when it has none. */
  find: (link: URL) => Promise<string | null>
}

const DAY = 60 * 60 * 24
// Upstream pages and pictures are cached at the edge for a day; the picture follows the artist within one.
const get = (url: string) => fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Mixlog)' }, signal: AbortSignal.timeout(8000), cf: { cacheTtl: DAY, cacheEverything: true } } as RequestInit)

/** The page's `og:image`, whichever order its attributes come in. */
export function ogImage(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/(?:property|name)\s*=\s*["']og:image["']/i.test(tag)) continue
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]
    if (content) return content.replaceAll('&amp;', '&')
  }
  return null
}

const fromPage = (resize: (image: string) => string = (i) => i) => async (link: URL) => {
  const page = await get(link.href)
  if (!page.ok) return null
  const image = ogImage(await page.text())
  return image && resize(image)
}

/** Sharpest first: the switch names, and reads, the first of these the artist links to. */
const PLATFORMS: Platform[] = [
  // Its og:image is a 1200×630 crop; the same image asked for square.
  { name: 'Apple Music', hosts: ['music.apple.com'], find: fromPage((i) => i.replace(/\/[^/]+$/, '/2000x2000bb.jpg')) },
  { name: 'YouTube', hosts: ['youtube.com'], find: fromPage((i) => i.replace(/=s\d+/, '=s2000')) },
  {
    name: 'SoundCloud',
    hosts: ['soundcloud.com'],
    find: async (link) => {
      const answer = await get(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(link.href)}`)
      const image = answer.ok ? ((await answer.json()) as { thumbnail_url?: string }).thumbnail_url : null
      return image?.replace(/-t\d+x\d+\./, '-original.') ?? null
    },
  },
  {
    name: 'Deezer',
    hosts: ['deezer.com'],
    find: async (link) => {
      const id = link.pathname.match(/\/artist\/(\d+)/)?.[1]
      const answer = id && (await get(`https://api.deezer.com/artist/${id}`))
      const image = answer && answer.ok ? ((await answer.json()) as { picture_xl?: string }).picture_xl : null
      return image && !image.includes('/artist//') ? image : null // an empty hash is Deezer's stand-in
    },
  },
  { name: 'Tidal', hosts: ['tidal.com'], find: fromPage() },
  { name: 'Spotify', hosts: ['open.spotify.com'], find: fromPage() },
]

/** The image hosts a found picture may come from; anything else is not fetched. */
const IMAGE_HOSTS = ['mzstatic.com', 'googleusercontent.com', 'ggpht.com', 'sndcdn.com', 'dzcdn.net', 'resources.tidal.com', 'i.scdn.co']
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const on = (host: string, hosts: string[]) => hosts.some((h) => host === h || host.endsWith(`.${h}`))

function platformOf(url: string): Platform | undefined {
  if (!URL.canParse(url)) return undefined
  const { protocol, hostname } = new URL(url)
  return protocol === 'https:' ? PLATFORMS.find((p) => on(hostname.toLowerCase(), p.hosts)) : undefined
}

/** The link the live picture comes from (the sharpest platform the artist links to), and its platform's name. */
export function pictureLink(links: string[]): { url: string; name: string } | null {
  for (const platform of PLATFORMS) {
    const url = links.find((l) => platformOf(l) === platform)
    if (url) return { url, name: platform.name }
  }
  return null
}

/** The live picture's bytes and type, or null when the platform has none or can't be reached. */
export async function livePicture(links: string[]): Promise<{ body: ReadableStream | null; type: string } | null> {
  const link = pictureLink(links)
  if (!link) return null
  try {
    const image = await platformOf(link.url)!.find(new URL(link.url))
    if (!image || !URL.canParse(image)) return null
    const { protocol, hostname } = new URL(image)
    if (protocol !== 'https:' || !on(hostname.toLowerCase(), IMAGE_HOSTS)) return null
    const answer = await get(image)
    const type = answer.headers.get('content-type')?.split(';')[0].trim() ?? ''
    if (!answer.ok || !IMAGE_TYPES.includes(type)) return null
    return { body: answer.body, type }
  } catch {
    return null // a timeout or a platform that's down: the initials, as with no picture
  }
}
