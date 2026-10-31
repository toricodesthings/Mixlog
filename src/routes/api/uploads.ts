import { createFileRoute } from '@tanstack/react-router'

import { abortUpload, putUploadPart, startUpload } from '#/server/versions'

export const Route = createFileRoute('/api/uploads')({
  server: {
    handlers: {
      POST: ({ request }) => startUpload(request),
      PUT: ({ request }) => putUploadPart(request),
      DELETE: ({ request }) => abortUpload(request),
    },
  },
})
