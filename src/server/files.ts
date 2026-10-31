/** File rules shared by the server routes and their tests: pure, no bindings. */

/** Artwork is what a distributor takes: a PNG or JPG. (Never SVG: it can carry script.) */
export const ARTWORK_TYPES = ['image/png', 'image/jpeg'] as const

/** Artwork goes up in one streamed request, well under a Worker's ~100 MB body cap; audio is chunked. */
export const MAX_ARTWORK_BYTES = 20 * 1024 * 1024

/** Why this upload can't be artwork, or null when it can. */
export function artworkProblem(contentType: string | null, size: number): string | null {
  if (!ARTWORK_TYPES.includes(contentType as (typeof ARTWORK_TYPES)[number])) return 'Artwork is a PNG or JPG.'
  if (!Number.isInteger(size) || size <= 0) return 'The image is empty or its size is unknown.'
  if (size > MAX_ARTWORK_BYTES) return 'Artwork is 20 MB at most.'
  return null
}

/** The `Content-Range` for a ranged read of an object of `size` bytes. Keys may be present but undefined (local R2 does that). */
export function contentRange(range: { offset?: number; length?: number; suffix?: number }, size: number): string {
  const offset = range.suffix !== undefined ? Math.max(0, size - range.suffix) : (range.offset ?? 0)
  const length = range.suffix !== undefined ? size - offset : (range.length ?? size - offset)
  return `bytes ${offset}-${offset + length - 1}/${size}`
}

/** Audio stacks a dropped bounce can land in. */
export const AUDIO_KINDS = ['master', 'mix', 'instrumental', 'acapella'] as const
export type AudioKind = (typeof AUDIO_KINDS)[number]

/** By extension first: browsers disagree on (or leave out) a WAV's or AIFF's type. One stored type per format. */
const AUDIO_EXTENSIONS: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
}
export const AUDIO_TYPES = [...new Set(Object.values(AUDIO_EXTENSIONS))]

/** The type Mixlog stores an audio file as, or null when it isn't audio Mixlog takes. */
export function audioTypeOf(name: string, type: string): string | null {
  const byName = AUDIO_EXTENSIONS[name.split('.').pop()!.toLowerCase()]
  if (byName) return byName
  return AUDIO_TYPES.includes(type) ? type : type === 'audio/x-wav' || type === 'audio/wave' ? 'audio/wav' : null
}

/** A long album as a 24-bit/96 kHz WAV still fits. */
export const MAX_AUDIO_BYTES = 4 * 1024 ** 3
/** Audio goes up in parts this size (R2 wants every part but the last the same size, ≥ 5 MiB). */
export const UPLOAD_PART_BYTES = 10 * 1024 * 1024

/** Why this can't start an audio upload, or null when it can. */
export function audioProblem(kind: unknown, contentType: unknown, size: unknown): string | null {
  if (!AUDIO_KINDS.includes(kind as AudioKind)) return 'That isn’t a stack a bounce goes in.'
  if (!AUDIO_TYPES.includes(contentType as string)) return 'Mixlog takes MP3, WAV, AIFF, FLAC, M4A or OGG.'
  if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) return 'The file is empty or its size is unknown.'
  if (size > MAX_AUDIO_BYTES) return 'A bounce is 4 GB at most.'
  return null
}

/** An upload's R2 key carries its track, stack and version, so the file can be matched up without D1. */
export const uploadKey = (trackId: string, kind: AudioKind, versionId: string) => `tracks/${trackId}/${kind}/${versionId}`

export function parseUploadKey(key: unknown): { trackId: string; kind: AudioKind; versionId: string } | null {
  const match = typeof key === 'string' && /^tracks\/([\w-]{1,64})\/(master|mix|instrumental|acapella)\/([\w-]{1,64})$/.exec(key)
  return match ? { trackId: match[1], kind: match[2] as AudioKind, versionId: match[3] } : null
}

/** A final is lossless (WAV, AIFF, FLAC); anything else is a test bounce. The format says it, so Mixlog never asks. */
export const isFinal = (contentType: string) => ['audio/wav', 'audio/aiff', 'audio/flac'].includes(contentType)
