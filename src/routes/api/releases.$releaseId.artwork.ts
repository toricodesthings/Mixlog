import { createFileRoute } from '@tanstack/react-router'

import { addArtwork } from '#/server/versions'

export const Route = createFileRoute('/api/releases/$releaseId/artwork')({
  server: { handlers: { POST: ({ request, params }) => addArtwork(request, params.releaseId) } },
})
