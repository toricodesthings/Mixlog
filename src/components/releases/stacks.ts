import { AudioWaveform, Clapperboard, File, Film, Gauge, Image, Layers, MicVocal, Piano, ScrollText, SlidersHorizontal, type LucideIcon } from 'lucide-react'

import { lanesOf } from '#/server/lanes'
import { isMeasured } from '#/server/loudness'
import type { ReleaseRow, TrackRow, VersionRow } from '#/server/releases'
import { formatMoment, todayIn, type Zone } from '../../lib/time'
import type { Playable } from '../player/Player'
import { dateLabel } from './browse'
import { releaseLink, sectionOf, type Part, type Section } from './sections'

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

/** The final's one icon, everywhere it shows: its lane, its station, the menus. */
export const FINAL_ICON = AudioWaveform

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

/** A version's name: "Final v4", "Master v3", "Instrumental v1". Releases keep one file per slot, so there it has no
 *  number: "Final", "Instrumental". */
export function versionLabel(version: Pick<VersionRow, 'kind' | 'number' | 'is_final'>, section: Section) {
  const name = version.is_final ? 'Final' : (KIND_LABEL[version.kind] ?? version.kind)
  return section === 'released' ? name : `${name} v${version.number}`
}

/** A version as the player names it: "Night Drive", "Final v4 · WAV", and the day it was bounced or went out. */
export function playableOf(release: ReleaseRow, track: TrackRow, version: VersionRow, zone: Zone): Playable {
  const section = sectionOf(release)
  return {
    versionId: version.id,
    title: track.title,
    label: `${versionLabel(version, section)} · ${formatOf(version.filename)}`,
    day: section === 'released' ? dateLabel(section, release, zone) : `Uploaded ${formatMoment(version.created_at, zone, todayIn(zone))}`,
    released: section === 'released',
    release: release.title,
    artworkId: release.artwork_id,
    link: releaseLink(section, release.id),
    wave: isMeasured(version.analysis) ? { bars: version.analysis.wave, ms: version.analysis.ms, loudestMs: version.analysis.loudest?.atMs ?? null } : null,
  }
}

/** One station on a release's signal path: the part it links to, and whether the signal has reached it. */
export type Station = { part: Part; icon: LucideIcon; label: string; fact: string; lit: boolean }

/** A release's signal path, from its source to the details: Mixes → Masters → Final → Artwork → Details in Upcoming;
 *  Final → Artwork → Details in Releases, where a track holds only its final. A single's Final names its file. */
export function stationsOf(section: Section, release: ReleaseRow, tracks: TrackRow[], versions: VersionRow[]): Station[] {
  const n = tracks.length
  const all = (count: number) => n > 0 && count === n
  const lanes = tracks.map((t) => lanesOf(t.id, versions))
  const finals = lanes.filter((l) => l.final).length
  const single = release.format === 'single' && n === 1 ? lanes[0].final : undefined
  const final: Station = {
    part: 'tracks',
    icon: FINAL_ICON,
    label: 'Final',
    fact: single ? `${section === 'released' ? '' : `v${single.number} · `}${formatOf(single.filename)}` : single === null ? 'Not yet' : n ? `${finals} of ${n}` : 'No tracks yet',
    lit: all(finals),
  }
  const detailsDone = section === 'released' ? Boolean(release.upc) && tracks.every((t) => t.isrc) : Boolean(release.release_date)
  const rest: Station[] = [
    { part: 'artwork', icon: Image, label: 'Artwork', fact: release.artwork_id ? 'Cover set' : 'No artwork yet', lit: Boolean(release.artwork_id) },
    {
      part: 'details',
      icon: ScrollText,
      label: 'Details',
      fact: section === 'released' ? (detailsDone ? 'All codes in' : 'Codes to add') : release.release_date ? 'Date set' : 'No date yet',
      lit: detailsDone,
    },
  ]
  if (section === 'released') return [final, ...rest]
  const mixes = lanes.reduce((sum, l) => sum + l.mix.length, 0)
  const mastered = lanes.filter((l) => l.final || l.master.length).length
  return [
    { part: 'tracks', icon: KIND_ICON.mix, label: 'Mixes', fact: mixes ? `${mixes} ${mixes === 1 ? 'mix' : 'mixes'}` : 'None yet', lit: mixes > 0 },
    { part: 'tracks', icon: KIND_ICON.master, label: 'Masters', fact: n ? `${mastered} of ${n}` : 'No tracks yet', lit: all(mastered) },
    final,
    ...rest,
  ]
}
