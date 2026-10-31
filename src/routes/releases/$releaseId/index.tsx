import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseSummary } from '#/components/releases/ReleaseSummary'

const release = getRouteApi('/releases/$releaseId')

export const Route = createFileRoute('/releases/$releaseId/')({ component: Part })

function Part() {
  return <ReleaseSummary {...release.useLoaderData()} />
}
