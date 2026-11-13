import { createFileRoute } from '@tanstack/react-router'

import { ArtistList } from '#/components/artists/ArtistList'
import { listArtists } from '#/server/artists'

export const Route = createFileRoute('/artists/')({ head: () => ({ meta: [{ title: 'Artists · Mixlog' }] }), loader: () => listArtists(), component: Artists })

function Artists() {
  return <ArtistList artists={Route.useLoaderData()} />
}
