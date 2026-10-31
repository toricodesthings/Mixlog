import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { ReleaseSummary } from '#/components/releases/ReleaseSummary'

const release = getRouteApi('/upcoming/$releaseId')

export const Route = createFileRoute('/upcoming/$releaseId/')({ component: Part })

function Part() {
  return <ReleaseSummary {...release.useLoaderData()} />
}
