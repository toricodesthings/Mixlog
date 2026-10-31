import type { AudioKind } from '#/server/files'
import type { ReleaseFormat } from '#/server/releases'

/** Words that say which stack or which pass a bounce is, not what the song is called. */
const NOISE = /\b((master(ed)?|final|mix(down)?|pre-?master|inst(rumental)?|a ?cap+el+a|bounce|export|copy)( ?\d+)?|v(er(sion)?)? ?\d+|\d+ ?(bit|k(hz)?|kbps))\b/gi

/** Reads a filename the way a musician named it: "Blue_Hour - Mix v3.wav" is the track "Blue Hour", a mix.
 *  Only a suggestion: the dialog shows it before anything is saved. */
export function readFilename(name: string): { title: string; kind: AudioKind } {
  const base = name.replace(/\.[^.]+$/, '')
  const words = base.replace(/[_.]+/g, ' ')
  const kind: AudioKind = /\ba ?cap+el+a\b/i.test(words)
    ? 'acapella'
    : /\binst(rumental)?\b/i.test(words)
      ? 'instrumental'
      : /\b(mix(down)?|pre-?master)\b/i.test(words)
        ? 'mix'
        : 'master'
  const title = words
    .replace(NOISE, ' ')
    .replace(/[([]\s*\d*\s*[)\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—·,]+|[\s\-–—·,(]+$/g, '')
    .trim()
  return { title: title || base, kind }
}

/** One song is a single; two to four an EP; five or more an album. Files that read as the same title are one song. */
export function suggestFormat(titles: string[]): ReleaseFormat {
  const songs = new Set(titles.map((t) => t.trim().toLowerCase())).size
  return songs <= 1 ? 'single' : songs <= 4 ? 'ep' : 'album'
}
