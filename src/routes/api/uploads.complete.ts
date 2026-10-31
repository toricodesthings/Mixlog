import { createFileRoute } from '@tanstack/react-router'

import { completeUpload } from '#/server/versions'

export const Route = createFileRoute('/api/uploads/complete')({
  server: { handlers: { POST: ({ request }) => completeUpload(request) } },
})
