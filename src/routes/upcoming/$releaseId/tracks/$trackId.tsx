import { createFileRoute } from '@tanstack/react-router'

import { TrackPage } from '#/components/releases/ReleaseTracks'
import { loadTrack } from '#/components/releases/loaders'
import { isId } from '#/server/input'

export const Route = createFileRoute('/upcoming/$releaseId/tracks/$trackId')({
  // `?meters=<versionId>` opens a version's meters.
  validateSearch: (search: Record<string, unknown>): { meters?: string } => (isId(search.meters) ? { meters: search.meters } : {}),
  loader: async ({ params, parentMatchPromise }) => loadTrack('upcoming', (await parentMatchPromise).loaderData!, params.trackId),
  component: Track,
})

function Track() {
  return <TrackPage {...Route.useLoaderData()} />
}
