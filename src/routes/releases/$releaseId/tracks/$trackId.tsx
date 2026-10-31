import { createFileRoute } from '@tanstack/react-router'

import { TrackPage } from '#/components/releases/ReleaseTracks'
import { loadTrack } from '#/components/releases/loaders'

export const Route = createFileRoute('/releases/$releaseId/tracks/$trackId')({
  loader: async ({ params, parentMatchPromise }) => loadTrack('released', (await parentMatchPromise).loaderData!, params.trackId),
  component: Track,
})

function Track() {
  return <TrackPage {...Route.useLoaderData()} />
}
