import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseTracks } from '#/components/releases/ReleaseTracks'

const release = getRouteApi('/upcoming/$releaseId')

export const Route = createFileRoute('/upcoming/$releaseId/tracks/')({ component: Part })

function Part() {
  return <ReleaseTracks {...release.useLoaderData()} />
}
