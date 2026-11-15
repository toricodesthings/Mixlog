import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseArtwork } from '#/components/releases/ReleaseArtwork'
import { fullSearch } from '#/components/shared/Viewer'

const release = getRouteApi('/upcoming/$releaseId')

export const Route = createFileRoute('/upcoming/$releaseId/artwork')({
  // `?full` opens the cover full size.
  validateSearch: fullSearch,
  component: Part,
})

function Part() {
  return <ReleaseArtwork {...release.useLoaderData()} />
}
