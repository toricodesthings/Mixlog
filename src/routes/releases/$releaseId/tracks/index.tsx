import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseTracks } from '#/components/releases/ReleaseTracks'

const release = getRouteApi('/releases/$releaseId')

export const Route = createFileRoute('/releases/$releaseId/tracks/')({ component: Part })

function Part() {
  return <ReleaseTracks {...release.useLoaderData()} />
}
