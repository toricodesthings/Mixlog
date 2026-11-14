import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseDetailsForm } from '#/components/releases/ReleaseDetailsForm'
import { isId } from '#/server/input'

const release = getRouteApi('/upcoming/$releaseId')

// `?license=<versionId>` opens a track's license over the form; `?artists=<trackId>` its artists.
export const Route = createFileRoute('/upcoming/$releaseId/details')({
  validateSearch: (search: Record<string, unknown>): { license?: string; artists?: string } => ({
    ...(isId(search.license) ? { license: search.license } : {}),
    ...(isId(search.artists) ? { artists: search.artists } : {}),
  }),
  component: Part,
})

function Part() {
  return <ReleaseDetailsForm {...release.useLoaderData()} />
}
