import type { LinkOptions } from '@tanstack/react-router'

import type { Crumb } from '../layout/Page'

/** A release is upcoming until it's stamped released; then it's a done deal under Releases. */
export type Section = 'upcoming' | 'released'

export const sectionOf = (release: { released_at: string | null }): Section => (release.released_at ? 'released' : 'upcoming')

export const SECTIONS = {
  upcoming: { label: 'Upcoming', index: { to: '/upcoming' } },
  released: { label: 'Releases', index: { to: '/releases' } },
} satisfies Record<Section, { label: string; index: LinkOptions }>

export function releaseLink(section: Section, releaseId: string): LinkOptions {
  return section === 'upcoming' ? { to: '/upcoming/$releaseId', params: { releaseId } } : { to: '/releases/$releaseId', params: { releaseId } }
}

export function trackLink(section: Section, releaseId: string, trackId: string): LinkOptions {
  return section === 'upcoming'
    ? { to: '/upcoming/$releaseId/$trackId', params: { releaseId, trackId } }
    : { to: '/releases/$releaseId/$trackId', params: { releaseId, trackId } }
}

export const sectionCrumb = (section: Section): Crumb => ({ label: SECTIONS[section].label, link: SECTIONS[section].index })

export const FORMAT_LABEL = { single: 'Single', ep: 'EP', album: 'Album' } as const
