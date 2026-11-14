import { createFileRoute } from '@tanstack/react-router'

import { addCanvas } from '#/server/versions'

export const Route = createFileRoute('/api/tracks/$trackId/canvas')({
  server: { handlers: { POST: ({ request, params }) => addCanvas(request, params.trackId) } },
})
