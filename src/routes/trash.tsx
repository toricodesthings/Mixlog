import { createFileRoute } from '@tanstack/react-router'

import { Page } from '#/components/layout/Page'
import { EmptyState } from '#/components/shared/EmptyState'

export const Route = createFileRoute('/trash')({ component: Trash })

function Trash() {
  return (
    <Page title="Trash">
      <EmptyState title="Trash is empty">Anything you trash waits here until you restore it.</EmptyState>
    </Page>
  )
}
