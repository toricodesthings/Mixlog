import { createFileRoute } from '@tanstack/react-router'

import { SectionLayout } from '#/components/releases/SectionLayout'
import { listUpcoming } from '#/server/releases'

export const Route = createFileRoute('/upcoming')({ loader: () => listUpcoming(), component: UpcomingLayout })

function UpcomingLayout() {
  return <SectionLayout section="upcoming" releases={Route.useLoaderData()} />
}
