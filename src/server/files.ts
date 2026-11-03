/** File rules shared by the server routes and their tests: pure, no bindings. */
import type { VERSION_KINDS } from '#/server/schema'

/** Artwork is what a distributor takes: a PNG or JPG. (Never SVG: it can carry script.) */
const ARTWORK_TYPES = ['image/png', 'image/jpeg'] as const

/** Artwork goes up in one streamed request, well under a Worker's ~100 MB body cap; audio is chunked. */
export const MAX_ARTWORK_BYTES = 20 * 1024 * 1024

/** What the artwork pickers accept. */
export const ARTWORK_ACCEPT = 'image/png,image/jpeg,.png,.jpg,.jpeg'

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
/** What a bounce picker offers: every audio format Mixlog takes. */
export const AUDIO_ACCEPT = [...AUDIO_TYPES, ...Object.keys(AUDIO_EXTENSIONS).map((ext) => `.${ext}`)].join(',')
/** What a final's picker offers: the lossless formats. */
export const FINAL_ACCEPT = '.wav,.aif,.aiff,.flac'

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

/** Where a version's file lives in R2, foldered like the song: its release, then its track when it has one, then its stack.
 *  `releases/<release>/tracks/<track>/<kind>/<version>`, or `releases/<release>/<kind>/<version>` for the release's own
 *  (artwork, a release video). Every ID is a random UUID, the key never leaves the Worker, and with the object's metadata
 *  it's how the files could be matched back up without D1. R2 can't rename, so a version keeps the key it was born with. */
export const fileKey = (owner: { releaseId: string; trackId?: string }, kind: (typeof VERSION_KINDS)[number], versionId: string) =>
  `releases/${owner.releaseId}/${owner.trackId ? `tracks/${owner.trackId}/` : ''}${kind}/${versionId}`

/** A license is the paper behind a cover or a remix: a PDF or a Word document, typed by extension like audio. */
const LICENSE_EXTENSIONS: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
}
export const LICENSE_TYPES = Object.values(LICENSE_EXTENSIONS)
/** What a file picker offers for a license. */
export const LICENSE_ACCEPT = Object.keys(LICENSE_EXTENSIONS).map((ext) => `.${ext}`).join(',')
/** A license goes up in one request, like artwork. */
export const MAX_LICENSE_BYTES = 20 * 1024 * 1024

/** The type Mixlog stores a license as, or null when it isn't a PDF or Word document. */
export const licenseTypeOf = (name: string): string | null => LICENSE_EXTENSIONS[name.split('.').pop()!.toLowerCase()] ?? null

/** Why this can't be a license, or null when it can. */
export function licenseProblem(contentType: string | null, size: number): string | null {
  if (!LICENSE_TYPES.includes(contentType as string)) return 'A license is a PDF or a Word document.'
  if (!Number.isInteger(size) || size <= 0) return 'The file is empty or its size is unknown.'
  if (size > MAX_LICENSE_BYTES) return 'A license is 20 MB at most.'
  return null
}

/** Each license type's first bytes: a PDF's header, a .docx's ZIP, a .doc's OLE container. */
const LICENSE_MAGIC: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  [LICENSE_EXTENSIONS.docx]: [0x50, 0x4b, 0x03, 0x04],
  'application/msword': [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
}

/** Whether a file's bytes are what its type says, so a page or a program renamed `.pdf` is refused. */
export const startsLike = (contentType: string, bytes: Uint8Array) => LICENSE_MAGIC[contentType]?.every((b, i) => bytes[i] === b) ?? false

/** A final is lossless (WAV, AIFF, FLAC); anything else is a test bounce. The format says it, so Mixlog never asks. */
export const isFinal = (contentType: string) => ['audio/wav', 'audio/aiff', 'audio/flac'].includes(contentType)
