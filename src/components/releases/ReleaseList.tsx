import { Link } from '@tanstack/react-router'

import type { ReleaseRow } from '#/server/releases'
import { Page } from '../layout/Page'
import { EmptyState } from '../shared/EmptyState'
import { FORMAT_LABEL, SECTIONS, releaseLink, type Section } from './sections'

const EMPTY = {
  upcoming: ['Nothing in progress', 'Start a single or EP, and every bounce for it lands here: MP3 tests while it’s moving, the final WAV once it’s right.'],
  released: ['No releases yet', 'When something goes out, it’s stamped here with exactly what shipped.'],
} as const

/** Upcoming or Releases: one row per release. */
export function ReleaseList({ section, releases }: { section: Section; releases: ReleaseRow[] }) {
  const [title, body] = EMPTY[section]
  return (
    <Page title={SECTIONS[section].label}>
      {releases.length === 0 ? (
        <EmptyState title={title}>{body}</EmptyState>
      ) : (
        <ul className="mx-auto max-w-3xl space-y-2">
          {releases.map((release) => (
            <li key={release.id}>
              <Link {...releaseLink(section, release.id)} className="surface-item flex min-h-14 items-center justify-between gap-4 rounded-2xl px-4">
                <span className="truncate font-medium">{release.title}</span>
                <span className="shrink-0 text-sm text-ink-muted">{FORMAT_LABEL[release.format]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
