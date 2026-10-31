import { createFileRoute } from '@tanstack/react-router'

import { ReleaseLayout } from '#/components/releases/ReleaseLayout'
import { loadRelease } from '#/components/releases/loaders'

export const Route = createFileRoute('/releases/$releaseId')({
  loader: ({ params }) => loadRelease('released', params.releaseId),
  component: Release,
})

function Release() {
  return <ReleaseLayout {...Route.useLoaderData()} />
}
