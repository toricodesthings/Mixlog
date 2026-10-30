import type { ReleaseRow } from '#/server/releases'
import type { TrackDetail } from '#/server/tracks'
import { Page } from '../layout/Page'
import { EmptyState } from '../shared/EmptyState'
import { releaseLink, sectionCrumb, sectionOf, type Section } from './sections'

/** A track on an EP or album: Upcoming › EP › Track. */
export function TrackPage({ track, release }: { track: TrackDetail; release: ReleaseRow }) {
  const section = sectionOf(release)
  return (
    <Page title={track.title} crumbs={[sectionCrumb(section), { label: release.title, link: releaseLink(section, release.id) }]}>
      <TrackBody section={section} />
    </Page>
  )
}

/** What a track holds. Upcoming: the versions, A/B against the last master. Released: what shipped, frozen. */
export function TrackBody({ section }: { section: Section }) {
  return section === 'upcoming' ? (
    <EmptyState title="No versions yet">Each new master stacks on top, ready to A/B against the one before it.</EmptyState>
  ) : (
    <EmptyState title="Released">The exact versions that shipped, stamped and frozen, with their details.</EmptyState>
  )
}
