import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseTracks } from '#/components/releases/ReleaseTracks'
import { isId } from '#/server/input'

const release = getRouteApi('/releases/$releaseId')

export const Route = createFileRoute('/releases/$releaseId/tracks/')({
  // `?meters=<versionId>` opens a version's meters.
  validateSearch: (search: Record<string, unknown>): { meters?: string } => (isId(search.meters) ? { meters: search.meters } : {}),
  component: Part,
})

function Part() {
  return <ReleaseTracks {...release.useLoaderData()} />
}
