import { createFileRoute } from '@tanstack/react-router'

import { ReleaseLayout } from '#/components/releases/ReleaseLayout'
import { loadRelease } from '#/components/releases/loaders'

export const Route = createFileRoute('/upcoming/$releaseId')({
  // `?move` opens Move to Releases over any of its parts; `?upload` a track's Upload over its page.
  validateSearch: (search: Record<string, unknown>): { move?: true; upload?: true } => ({
    ...(search.move === true ? { move: true as const } : {}),
    ...(search.upload === true ? { upload: true as const } : {}),
  }),
  loader: ({ params }) => loadRelease('upcoming', params.releaseId),
  component: Release,
})

function Release() {
  return <ReleaseLayout {...Route.useLoaderData()} />
}
