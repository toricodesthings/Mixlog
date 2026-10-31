import { notFound, redirect } from '@tanstack/react-router'

import { getRelease } from '#/server/releases'
import { releaseLink, sectionOf, type Section } from './sections'

/** A release with its tracks and every version: what all its parts show. */
export type ReleaseData = Awaited<ReturnType<typeof getRelease>>

/** A release, from whichever section it's in now: an old Upcoming link to a released single lands in Releases. */
export async function loadRelease(section: Section, releaseId: string): Promise<ReleaseData> {
  const data = await getRelease({ data: releaseId })
  const actual = sectionOf(data.release)
  if (actual !== section) throw redirect(releaseLink(actual, releaseId))
  return data
}

/** A track, from its release's data. A single's release is its track, so its Tracks part is the track. */
export function loadTrack(section: Section, data: ReleaseData, trackId: string) {
  const track = data.tracks.find((t) => t.id === trackId)
  if (!track) throw notFound()
  if (data.release.format === 'single') throw redirect(releaseLink(section, data.release.id, 'tracks'))
  return { ...data, track }
}
