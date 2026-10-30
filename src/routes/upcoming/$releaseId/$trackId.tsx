import { createFileRoute } from '@tanstack/react-router'

import { TrackPage } from '#/components/releases/TrackPage'
import { loadTrack } from '#/components/releases/loaders'

export const Route = createFileRoute('/upcoming/$releaseId/$trackId')({
  loader: ({ params }) => loadTrack('upcoming', params.releaseId, params.trackId),
  component: Track,
})

function Track() {
  return <TrackPage {...Route.useLoaderData()} />
}
