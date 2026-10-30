import { Page } from './Page'
import { EmptyState } from '../shared/EmptyState'

export function NotFound() {
  return (
    <Page title="Not here" crumbs={[{ label: 'Upcoming', link: { to: '/upcoming' } }]}>
      <EmptyState title="Nothing at this address">It may have moved to Trash, or the link is from somewhere else.</EmptyState>
    </Page>
  )
}
