import type { TrackRow, VersionRow } from '#/server/releases'

/** One track's stacks, read from the release's versions: each kind's versions newest first, and its current one. */
export function stacksOf(track: TrackRow, versions: VersionRow[]) {
  const own = versions.filter((v) => v.track_id === track.id)
  const kinds = [...new Set(own.map((v) => v.kind))].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b))
  return kinds.map((kind) => {
    const stack = own.filter((v) => v.kind === kind).sort((a, b) => b.number - a.number)
    return { kind, versions: stack, current: stack.find((v) => v.is_current) ?? stack[0] }
  })
}

/** How stacks line up: what you'd ship first. */
export const KIND_ORDER = ['master', 'mix', 'instrumental', 'acapella', 'stems', 'canvas', 'video', 'other']

export const KIND_LABEL: Record<string, string> = {
  master: 'Master',
  mix: 'Mix',
  instrumental: 'Instrumental',
  acapella: 'Acapella',
  stems: 'Stems',
  canvas: 'Canvas',
  video: 'Video',
  other: 'Other',
}

/** "WAV", "MP3": the format as a musician says it. */
export const formatOf = (filename: string) => (filename.includes('.') ? filename.split('.').pop()!.toUpperCase() : 'FILE')
