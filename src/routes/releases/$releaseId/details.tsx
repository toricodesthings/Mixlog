import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseDetailsForm } from '#/components/releases/ReleaseDetailsForm'

const release = getRouteApi('/releases/$releaseId')

export const Route = createFileRoute('/releases/$releaseId/details')({ component: Part })

function Part() {
  return <ReleaseDetailsForm {...release.useLoaderData()} />
}
