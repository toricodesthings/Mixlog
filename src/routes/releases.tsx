import { createFileRoute } from '@tanstack/react-router'

import { SectionLayout } from '#/components/releases/SectionLayout'
import { listReleased } from '#/server/releases'

export const Route = createFileRoute('/releases')({ loader: () => listReleased(), component: ReleasesLayout })

function ReleasesLayout() {
  return <SectionLayout section="released" releases={Route.useLoaderData()} />
}
