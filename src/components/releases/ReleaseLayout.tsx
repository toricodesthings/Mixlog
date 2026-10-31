import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { Disc3, Images, ListMusic, ScrollText, Sparkles, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { deviceZone } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button, Led, Tip } from '../primitives'
import * as ScrollArea from '../primitives/ScrollArea'
import { Page } from '../layout/Page'
import { MetaLine } from '../shared/MetaLine'
import { ArtworkButton } from './ArtworkButton'
import { dateLabel, releaseFacts } from './browse'
import type { ReleaseData } from './loaders'
import { FORMAT_LABEL, SECTIONS, releaseLink, sectionCrumb, sectionOf, type Part } from './sections'

const PARTS: { part: Part; label: string; icon: LucideIcon }[] = [
  { part: 'summary', label: 'Summary', icon: Sparkles },
  { part: 'details', label: 'Details', icon: ScrollText },
  { part: 'artwork', label: 'Artwork & Canvas', icon: Images },
  { part: 'tracks', label: 'Tracks', icon: ListMusic },
]

/**
 * Inside a release: its header, and its parts (Summary, Details, Artwork & Canvas, Tracks) beside it as a panel
 * when there's room, or as a strip of tabs under the header when there isn't. The list pages never show it.
 */
export function ReleaseLayout({ release, tracks }: ReleaseData) {
  const section = sectionOf(release)
  const { isDesktop } = useShellMode()
  const [artFailure, setArtFailure] = useState<string | null>(null)
  // The summary says the facts in full; every other part keeps them under the title.
  const onSummary = useLocation({ select: (l) => l.pathname.replace(/\/$/, '').endsWith(release.id) })
  const count = release.format === 'single' ? null : tracks.length

  return (
    <>
      {isDesktop && (
        <aside aria-label={release.title} className="flex h-full w-64 shrink-0 flex-col border-r border-line">
          <div className="flex h-(--shell-header-h) shrink-0 flex-col justify-center gap-1 border-b border-line px-5">
            <p className="readout text-accent">{FORMAT_LABEL[release.format]} · {SECTIONS[section].label}</p>
            <p className="truncate font-display text-sm font-semibold text-ink-soft">{release.title}</p>
          </div>
          <ScrollArea.Root className="flex-1">
            <ScrollArea.Viewport>
              <nav aria-label="Release parts">
                <ul className="space-y-0.5 p-2">
                  {PARTS.map(({ part, label, icon: Icon }) => (
                    <li key={part}>
                      <Link
                        {...releaseLink(section, release.id, part)}
                        activeOptions={{ exact: part === 'summary' }}
                        className="group press relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-ink-soft transition-colors hover:bg-accent-dim hover:text-ink data-[status=active]:bg-accent-soft data-[status=active]:font-medium data-[status=active]:text-ink"
                      >
                        {({ isActive }) => (
                          <>
                            <Led lit={isActive} className={cn('absolute left-0.5', !isActive && 'opacity-0')} />
                            <Icon size={17} aria-hidden="true" className={isActive ? 'text-accent' : 'text-ink-muted group-hover:text-ink-soft'} />
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            {part === 'tracks' && count !== null && <span className="readout text-ink-muted">{String(count).padStart(2, '0')}</span>}
                          </>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar>
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
          {section === 'upcoming' && (
            <div className="border-t border-line p-3">
              <MoveToReleases />
            </div>
          )}
        </aside>
      )}
      <Page
        title={release.title}
        crumbs={[sectionCrumb(section)]}
        lead={<ArtworkButton releaseId={release.id} title={release.title} artworkId={release.artwork_id} onFailure={setArtFailure} />}
        meta={
          artFailure ? (
            <p role="alert" className="truncate text-[13px] text-feedback-error">
              {artFailure} Tap the cover to try again.
            </p>
          ) : onSummary ? null : (
            <MetaLine facts={[dateLabel(section, release, deviceZone()), ...releaseFacts(release, FORMAT_LABEL[release.format])]} />
          )
        }
        actions={!isDesktop && section === 'upcoming' ? <MoveToReleases compact /> : undefined}
      >
        {!isDesktop && (
          <nav aria-label="Release parts" className="-mx-4 -mt-2 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
            {PARTS.map(({ part, label, icon: Icon }) => (
              <Link
                key={part}
                {...releaseLink(section, release.id, part)}
                activeOptions={{ exact: part === 'summary' }}
                className="surface-control press flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line/40 px-4 text-sm text-ink-soft data-[status=active]:border-accent/40 data-[status=active]:bg-accent-soft data-[status=active]:font-medium data-[status=active]:text-ink"
              >
                <Icon size={15} aria-hidden="true" className="text-accent" />
                {label}
              </Link>
            ))}
          </nav>
        )}
        <Outlet />
      </Page>
    </>
  )
}

/** Stamping a release out of Upcoming. Not built yet: the button holds its place and says so. */
function MoveToReleases({ compact }: { compact?: boolean }) {
  const label = 'Move to Releases'
  return (
    <Tip label="Coming next: stamps it released, with exactly what shipped">
      <Button variant="cardPrimary" aria-disabled="true" aria-label={compact ? label : undefined} onClick={() => {}} className={cn('cursor-default', compact ? 'size-11 px-0' : 'w-full')}>
        <Disc3 size={16} aria-hidden="true" />
        {!compact && label}
      </Button>
    </Tip>
  )
}
