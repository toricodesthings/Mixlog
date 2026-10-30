import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseList } from '#/components/releases/ReleaseList'

const section = getRouteApi('/releases')

export const Route = createFileRoute('/releases/')({ component: Releases })

function Releases() {
  return <ReleaseList section="released" releases={section.useLoaderData()} />
}
