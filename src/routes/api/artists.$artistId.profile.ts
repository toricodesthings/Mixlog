import { createFileRoute } from '@tanstack/react-router'

import { addArtistProfile, serveArtistProfile } from '#/server/artist-files'

export const Route = createFileRoute('/api/artists/$artistId/profile')({
  server: {
    handlers: {
      GET: ({ request, params }) => serveArtistProfile(request, params.artistId),
      POST: ({ request, params }) => addArtistProfile(request, params.artistId),
    },
  },
})
