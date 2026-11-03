import { createFileRoute } from '@tanstack/react-router'

import { addLicense } from '#/server/versions'

export const Route = createFileRoute('/api/tracks/$trackId/license')({
  server: { handlers: { POST: ({ request, params }) => addLicense(request, params.trackId) } },
})
