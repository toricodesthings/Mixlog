import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseArtwork } from '#/components/releases/ReleaseArtwork'

const release = getRouteApi('/releases/$releaseId')

export const Route = createFileRoute('/releases/$releaseId/artwork')({ component: Part })

function Part() {
  return <ReleaseArtwork {...release.useLoaderData()} />
}
