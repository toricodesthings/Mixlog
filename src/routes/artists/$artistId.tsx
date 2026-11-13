import { createFileRoute } from '@tanstack/react-router'

import { ArtistEditor } from '#/components/artists/ArtistEditor'
import { getArtist } from '#/server/artists'

export const Route = createFileRoute('/artists/$artistId')({
  loader: ({ params }) => getArtist({ data: params.artistId }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.name ?? 'Artist'} · Artists · Mixlog` }] }),
  component: Artist,
})

function Artist() {
  return <ArtistEditor artist={Route.useLoaderData()} />
}
