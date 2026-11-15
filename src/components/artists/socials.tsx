import { Link2, Mail } from 'lucide-react'

import { EMAIL } from '#/server/artists'
import {
  siApplemusic, siBandcamp, siBluesky, siDeezer, siDiscord, siFacebook, siInstagram, siPatreon, siSoundcloud,
  siSpotify, siThreads, siTidal, siTiktok, siTwitch, siX, siYoutube, type SimpleIcon,
} from 'simple-icons'

/** The platforms a link can be, each by the words its address carries; anything else is a plain link. */
const SOCIALS: [words: RegExp, name: string, icon: SimpleIcon][] = [
  [/spotify/, 'Spotify', siSpotify],
  [/music\.apple|apple ?music/, 'Apple Music', siApplemusic],
  [/youtube|youtu\.be/, 'YouTube', siYoutube],
  [/instagram|instagr\.am/, 'Instagram', siInstagram],
  [/tiktok/, 'TikTok', siTiktok],
  [/twitter|(^|[/.@])x\.com/, 'X', siX],
  [/soundcloud/, 'SoundCloud', siSoundcloud],
  [/bandcamp/, 'Bandcamp', siBandcamp],
  [/facebook|(^|[/.])fb\.(com|me)/, 'Facebook', siFacebook],
  [/twitch/, 'Twitch', siTwitch],
  [/threads\.(net|com)/, 'Threads', siThreads],
  [/bsky|bluesky/, 'Bluesky', siBluesky],
  [/discord/, 'Discord', siDiscord],
  [/tidal/, 'Tidal', siTidal],
  [/deezer/, 'Deezer', siDeezer],
  [/patreon/, 'Patreon', siPatreon],
]

/** A link's mark: a platform's, an envelope for an email, or null for a plain link. */
type Mark = SimpleIcon | 'mail' | null

/** The platform a half-typed or pasted link already names ("spotify", "open.spotify.com/…", an email), or null. */
export function platformIn(text: string): { name: string; icon: SimpleIcon | 'mail' } | null {
  if (EMAIL.test(text.trim())) return { name: 'Email', icon: 'mail' }
  const hit = SOCIALS.find(([words]) => words.test(text.trim().toLowerCase()))
  return hit ? { name: hit[1], icon: hit[2] } : null
}

/** A saved link's platform name and mark, read from its host. Unknown hosts read as their domain, with a link glyph. */
export function socialOf(url: string): { name: string; icon: Mark } {
  if (url.startsWith('mailto:')) return { name: 'Email', icon: 'mail' }
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return { name: url, icon: null }
  }
  return platformIn(host) ?? { name: host.replace(/^www\./, ''), icon: null }
}

/** The platform's mark in the room's ink, never its brand colour. */
export function SocialIcon({ url, icon = url ? socialOf(url).icon : null, size = 18 }: { url?: string; icon?: Mark; size?: number }) {
  if (icon === 'mail') return <Mail size={size} aria-hidden="true" />
  if (!icon) return <Link2 size={size} aria-hidden="true" />
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className="shrink-0 fill-current">
      <path d={icon.path} />
    </svg>
  )
}

/** Where a link goes, as the artist would say it: the address, or the email. */
export const linkLabel = (url: string) => url.replace(/^(https:\/\/(www\.)?|mailto:)/, '')

/** What was pasted as an email (`mailto:`) or an https link, or null when it's neither (the Worker checks it again). */
export function asLink(text: string): string | null {
  if (EMAIL.test(text.trim())) return `mailto:${text.trim().replace(/^mailto:/i, '')}`
  const value = /^https?:\/\//i.test(text.trim()) ? text.trim() : `https://${text.trim()}`
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.includes('.') ? value : null
  } catch {
    return null
  }
}
