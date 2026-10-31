import { createFileRoute } from '@tanstack/react-router'

import { listSearch } from '#/components/releases/browse'
import { ReleaseList } from '#/components/releases/ReleaseList'
import { listReleased } from '#/server/releases'

export const Route = createFileRoute('/releases/')({ validateSearch: listSearch, loader: () => listReleased(), component: Releases })

function Releases() {
  return <ReleaseList section="released" releases={Route.useLoaderData()} />
}
