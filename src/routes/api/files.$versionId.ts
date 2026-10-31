import { createFileRoute } from '@tanstack/react-router'

import { serveFile } from '#/server/versions'

export const Route = createFileRoute('/api/files/$versionId')({
  server: { handlers: { GET: ({ request, params }) => serveFile(request, params.versionId) } },
})
