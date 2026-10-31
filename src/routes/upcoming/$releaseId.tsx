import { createFileRoute } from '@tanstack/react-router'

import { ReleaseLayout } from '#/components/releases/ReleaseLayout'
import { loadRelease } from '#/components/releases/loaders'

export const Route = createFileRoute('/upcoming/$releaseId')({
  loader: ({ params }) => loadRelease('upcoming', params.releaseId),
  component: Release,
})

function Release() {
  return <ReleaseLayout {...Route.useLoaderData()} />
}
