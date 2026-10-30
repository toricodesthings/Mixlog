import { Link } from '@tanstack/react-router'

import type { ReleaseRow } from '#/server/releases'
import { Page } from '../layout/Page'
import { EmptyState } from '../shared/EmptyState'
import { TrackBody } from './TrackPage'
import { sectionCrumb, sectionOf, trackLink } from './sections'

/** A release. A single is its track, so it shows the track itself; an EP or album lists its tracks in order. */
export function ReleasePage({ release, tracks }: { release: ReleaseRow; tracks: { id: string; title: string }[] }) {
  const section = sectionOf(release)
  return (
    <Page title={release.title} crumbs={[sectionCrumb(section)]}>
      {release.format === 'single' ? (
        <TrackBody section={section} />
      ) : tracks.length === 0 ? (
        <EmptyState title="No tracks yet">Its tracks line up here in order.</EmptyState>
      ) : (
        <ol className="mx-auto max-w-3xl space-y-2">
          {tracks.map((track, i) => (
            <li key={track.id}>
              <Link {...trackLink(section, release.id, track.id)} className="surface-item flex min-h-14 items-center gap-4 rounded-2xl px-4 font-medium">
                <span data-numeric className="w-5 text-right text-sm text-ink-muted">
                  {i + 1}
                </span>
                {track.title}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Page>
  )
}
