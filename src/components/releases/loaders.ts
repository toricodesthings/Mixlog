import { notFound, redirect } from '@tanstack/react-router'

import { getRelease } from '#/server/releases'
import { getTrack } from '#/server/tracks'
import { releaseLink, sectionOf, trackLink, type Section } from './sections'

/** A release, from whichever section it's in now: an old Upcoming link to a released single lands in Releases. */
export async function loadRelease(section: Section, releaseId: string) {
  const data = await getRelease({ data: releaseId })
  const actual = sectionOf(data.release)
  if (actual !== section) throw redirect(releaseLink(actual, releaseId))
  return data
}

export async function loadTrack(section: Section, releaseId: string, trackId: string) {
  const data = await getTrack({ data: trackId })
  if (data.track.release_id !== releaseId) throw notFound()
  const actual = sectionOf(data.release)
  // A single's release is its track: one page.
  if (data.release.format === 'single') throw redirect(releaseLink(actual, releaseId))
  if (actual !== section) throw redirect(trackLink(actual, releaseId, trackId))
  return data
}
