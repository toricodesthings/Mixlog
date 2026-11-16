import { createFileRoute } from '@tanstack/react-router'

import { Page } from '#/components/layout/Page'
import { CHANGELOG, type ChangelogGroup } from '#/lib/changelog'
import { deviceZone, formatDay, todayIn } from '#/lib/time'

export const Route = createFileRoute('/changelog')({ head: () => ({ meta: [{ title: 'Changelog · Mixlog' }] }), component: Changelog })

const LABELS: Record<ChangelogGroup['kind'], string> = { added: 'New', changed: 'Changed', removed: 'Removed', fixed: 'Fixed' }

function Changelog() {
  const today = todayIn(deviceZone())
  return (
    <Page title="Changelog">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {CHANGELOG.map((entry, i) => (
          <details key={entry.version} open={i === 0} className="surface-row rounded-2xl px-4 py-3">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0">
                <span data-numeric className="readout block text-accent">{entry.version}</span>
                <span className="block text-ink">{entry.title}</span>
              </span>
              {entry.date && <time dateTime={entry.date} className="readout shrink-0 text-ink-muted">{formatDay(entry.date, today)}</time>}
            </summary>
            <div className="flex flex-col gap-4 pt-3">
              {entry.groups.map((group) => (
                <section key={group.kind}>
                  <h2 className="readout text-ink-soft">{LABELS[group.kind]}</h2>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-soft">
                    {group.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
              ))}
            </div>
          </details>
        ))}
      </div>
    </Page>
  )
}
