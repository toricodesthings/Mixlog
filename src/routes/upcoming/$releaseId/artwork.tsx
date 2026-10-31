import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseArtwork } from '#/components/releases/ReleaseArtwork'

const release = getRouteApi('/upcoming/$releaseId')

export const Route = createFileRoute('/upcoming/$releaseId/artwork')({ component: Part })

function Part() {
  return <ReleaseArtwork {...release.useLoaderData()} />
}
