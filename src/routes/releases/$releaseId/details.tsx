import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseDetailsForm } from '#/components/releases/ReleaseDetailsForm'
import { isId } from '#/server/input'

const release = getRouteApi('/releases/$releaseId')

// `?license=<versionId>` opens a track's license over the form.
export const Route = createFileRoute('/releases/$releaseId/details')({
  validateSearch: (search: Record<string, unknown>): { license?: string } => (isId(search.license) ? { license: search.license } : {}),
  component: Part,
})

function Part() {
  return <ReleaseDetailsForm {...release.useLoaderData()} />
}
