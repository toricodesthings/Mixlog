import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseList } from '#/components/releases/ReleaseList'

const section = getRouteApi('/upcoming')

export const Route = createFileRoute('/upcoming/')({ component: Upcoming })

function Upcoming() {
  return <ReleaseList section="upcoming" releases={section.useLoaderData()} />
}
