import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseTracks } from '#/components/releases/ReleaseTracks'
import { isId } from '#/server/input'

const release = getRouteApi('/upcoming/$releaseId')

export const Route = createFileRoute('/upcoming/$releaseId/tracks/')({
  // `?meters=<versionId>` opens a version's meters; `?add` Add a track (an EP or album).
  validateSearch: (search: Record<string, unknown>): { meters?: string; add?: true } => ({
    ...(isId(search.meters) ? { meters: search.meters } : {}),
    ...(search.add === true ? { add: true as const } : {}),
  }),
  component: Part,
})

function Part() {
  return <ReleaseTracks {...release.useLoaderData()} />
}
