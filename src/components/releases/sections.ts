import type { LinkOptions } from '@tanstack/react-router'

import type { Crumb } from '../layout/Page'

/** A release is upcoming until it's stamped released; then it's a done deal under Releases. */
export type Section = 'upcoming' | 'released'

export const sectionOf = (release: { released_at: string | null }): Section => (release.released_at ? 'released' : 'upcoming')

export const SECTIONS = {
  upcoming: { label: 'Upcoming', index: { to: '/upcoming' } },
  released: { label: 'Releases', index: { to: '/releases' } },
} satisfies Record<Section, { label: string; index: LinkOptions }>

/** The parts of a release, in the order its panel lists them. The summary is the release's own address. */
export type Part = 'summary' | 'details' | 'artwork' | 'tracks'

export function releaseLink(section: Section, releaseId: string, part: Part = 'summary'): LinkOptions {
  const params = { releaseId }
  if (section === 'upcoming') {
    return part === 'summary' ? { to: '/upcoming/$releaseId', params } : { to: `/upcoming/$releaseId/${part}`, params }
  }
  return part === 'summary' ? { to: '/releases/$releaseId', params } : { to: `/releases/$releaseId/${part}`, params }
}

/** A track lives in its release's Tracks part. */
export function trackLink(section: Section, releaseId: string, trackId: string): LinkOptions {
  return section === 'upcoming'
    ? { to: '/upcoming/$releaseId/tracks/$trackId', params: { releaseId, trackId } }
    : { to: '/releases/$releaseId/tracks/$trackId', params: { releaseId, trackId } }
}

export const sectionCrumb = (section: Section): Crumb => ({ label: SECTIONS[section].label, link: SECTIONS[section].index })

export const FORMAT_LABEL = { single: 'Single', ep: 'EP', album: 'Album' } as const
