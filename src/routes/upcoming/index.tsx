import { createFileRoute } from '@tanstack/react-router'

import { listSearch } from '#/components/releases/browse'
import { ReleaseList } from '#/components/releases/ReleaseList'
import { listUpcoming } from '#/server/releases'

export const Route = createFileRoute('/upcoming/')({ validateSearch: listSearch, loader: () => listUpcoming(), component: Upcoming })

function Upcoming() {
  return <ReleaseList section="upcoming" releases={Route.useLoaderData()} />
}
