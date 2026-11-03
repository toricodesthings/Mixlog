import { Clapperboard, File, Film, Gauge, Layers, MicVocal, Piano, SlidersHorizontal, type LucideIcon } from 'lucide-react'

import type { ReleaseRow, TrackRow, VersionRow } from '#/server/releases'
import { dayOf, formatDay, todayIn, type Zone } from '../../lib/time'
import type { Playable } from '../player/Player'
import { dateLabel } from './browse'
import { releaseLink, sectionOf } from './sections'

/** One track's stacks, read from the release's versions: each kind's versions newest first, and its current one.
 *  Its license is paperwork, not something to hear: it lives in Details (`licensesOf`). */
export function stacksOf(track: TrackRow, versions: VersionRow[]) {
  const own = versions.filter((v) => v.track_id === track.id && v.kind !== 'license')
  const kinds = [...new Set(own.map((v) => v.kind))].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b))
  return kinds.map((kind) => {
    const stack = own.filter((v) => v.kind === kind).sort((a, b) => b.number - a.number)
    return { kind, versions: stack, current: stack.find((v) => v.is_current) ?? stack[0] }
  })
}

/** How stacks line up: what you'd ship first. */
const KIND_ORDER = ['master', 'mix', 'instrumental', 'acapella', 'stems', 'canvas', 'video', 'other']

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

/** Each kind's one icon, everywhere it shows. */
export const KIND_ICON: Record<string, LucideIcon> = {
  master: Gauge,
  mix: SlidersHorizontal,
  instrumental: Piano,
  acapella: MicVocal,
  stems: Layers,
  canvas: Clapperboard,
  video: Film,
  other: File,
}

/** A track's licenses, newest first: the top one is the license, the rest are kept. */
export const licensesOf = (trackId: string, versions: VersionRow[]) =>
  versions.filter((v) => v.track_id === trackId && v.kind === 'license').sort((a, b) => b.number - a.number)

/** "WAV", "MP3": the format as a musician says it. */
export const formatOf = (filename: string) => (filename.includes('.') ? filename.split('.').pop()!.toUpperCase() : 'FILE')

/** "84 KB", "48.2 MB", "1.24 GB". */
export const sizeOf = (bytes: number) =>
  bytes < 1024 ** 2 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`

/** A version as the player names it: "Night Drive", "Master v4 · WAV", and the day it was bounced or went out. */
export function playableOf(release: ReleaseRow, track: TrackRow, version: VersionRow, zone: Zone): Playable {
  const section = sectionOf(release)
  return {
    versionId: version.id,
    title: track.title,
    label: `${KIND_LABEL[version.kind] ?? version.kind} v${version.number} · ${formatOf(version.filename)}`,
    day: section === 'released' ? dateLabel(section, release, zone) : `Uploaded ${formatDay(dayOf(version.created_at, zone), todayIn(zone))}`,
    released: section === 'released',
    release: release.title,
    artworkId: release.artwork_id,
    link: releaseLink(section, release.id),
  }
}
