import { Outlet, useLocation } from '@tanstack/react-router'

import type { ReleaseRow } from '#/server/releases'
import { Navigator } from '../layout/Navigator'
import { SECTIONS, releaseLink, type Section } from './sections'

/** Upcoming or Releases: the navigator beside a release or track, never beside the list it would repeat. */
export function SectionLayout({ section, releases }: { section: Section; releases: ReleaseRow[] }) {
  const { label, index } = SECTIONS[section]
  const onIndex = useLocation().pathname === index.to
  return (
    <>
      {!onIndex && (
        <Navigator
          title={label}
          empty={section === 'upcoming' ? 'Nothing in progress' : 'No releases yet'}
          items={releases.map((r) => ({ id: r.id, label: r.title, link: releaseLink(section, r.id) }))}
        />
      )}
      <Outlet />
    </>
  )
}
