import { createFileRoute } from '@tanstack/react-router'

import { ReleasePage } from '#/components/releases/ReleasePage'
import { loadRelease } from '#/components/releases/loaders'

export const Route = createFileRoute('/releases/$releaseId/')({
  loader: ({ params }) => loadRelease('released', params.releaseId),
  component: Release,
})

function Release() {
  return <ReleasePage {...Route.useLoaderData()} />
}
