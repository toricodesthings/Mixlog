import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { CalendarClock, Disc3, Images, ListMusic, LogOut, ScrollText, Sparkles, type LucideIcon } from 'lucide-react'
import { useState, type CSSProperties } from 'react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { moveToUpcoming } from '#/server/releases'
import { moveBackWindow } from '#/server/shipping'
import { dayOf, deviceZone, formatDay, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button, Led, Tip, Tuning, useHoverSlide } from '../primitives'
import * as ScrollArea from '../primitives/ScrollArea'
import { Page } from '../layout/Page'
import { DOCK } from '../meters/MetersPanel'
import { UploadButton } from '../uploads/UploadDialog'
import { useRoomStyle } from '../scene/palette'
import { MetaLine } from '../shared/MetaLine'
import { ArtworkButton } from './ArtworkButton'
import { dateLabel, releaseFacts } from './browse'
import type { ReleaseData } from './loaders'
import { MoveToReleasesDialog, useMoveParam } from './MoveToReleasesDialog'
import { DETAILS_FORM } from './ReleaseDetailsForm'
import { FORMAT_LABEL, releaseLink, SECTIONS, sectionCrumb, sectionOf, type Part, type Section } from './sections'

const PARTS: { part: Part; label: string; icon: LucideIcon }[] = [
  { part: 'summary', label: 'Summary', icon: Sparkles },
  { part: 'details', label: 'Details', icon: ScrollText },
  { part: 'artwork', label: 'Artwork & Canvas', icon: Images },
  { part: 'tracks', label: 'Tracks', icon: ListMusic },
]

/**
 * Inside a release: its header, and its parts (Summary, Details, Artwork & Canvas, Tracks) beside it as a panel
 * when there's room, or as a strip of tabs under the header when there isn't. The list pages never show it.
 * The release is its own room: its artwork's colours (`useRoomStyle`, `.art-room` in app.css) retint the
 * grounds and the accent of everything here, while the rail and dock outside keep the studio's Signal blue.
 */
export function ReleaseLayout(data: ReleaseData) {
  const { release, tracks } = data
  const section = sectionOf(release)
  const { isDesktop } = useShellMode()
  const [artFailure, setArtFailure] = useState<string | null>(null)
  // The summary says the facts in full; every other part keeps them under the title.
  const path = useLocation({ select: (l) => l.pathname.replace(/\/$/, '') })
  const onSummary = path.endsWith(release.id)
  // Upload sits in the header wherever one track's lanes are the page: a single's Tracks, or a track of an EP or album.
  const oneTrack = section === 'upcoming' && (/\/tracks\/[^/]+$/.test(path) || (release.format === 'single' && path.endsWith('/tracks')))
  const count = release.format === 'single' ? null : tracks.length
  const slide = useHoverSlide('rounded-xl bg-accent-dim')
  const room = useRoomStyle(release.title, release.artwork_id)
  const cover = <ArtworkButton releaseId={release.id} title={release.title} artworkId={release.artwork_id} onFailure={setArtFailure} />
  const facts = artFailure ? (
    <p role="alert" className="truncate text-[13px] text-feedback-error">
      {artFailure} Tap the cover to try again.
    </p>
  ) : (
    <MetaLine wrap={!isDesktop} className={isDesktop ? 'text-xs' : undefined} facts={[dateLabel(section, release, deviceZone()), ...releaseFacts(release, FORMAT_LABEL[release.format])]} />
  )

  return (
    <div className="art-room flex min-w-0 flex-1" style={isDesktop ? ({ ...room, '--shell-header-h': 'calc(5.5rem + 1px)' } as CSSProperties) : room}>
      {isDesktop && (
        <aside aria-label={release.title} className="flex h-full w-64 shrink-0 flex-col border-r border-line/60">
          {/* The release itself, on every part: its cover, title and facts, level with the page's header beside it (the
              room's headers are 5.5rem plus the rule on desktop: 16px around the cover on every side).
              Summary's scene says the title as the page's h1, so here it's only a name there. */}
          <header className="surface-shell layer-shell-header signal-rule flex h-(--shell-header-h) shrink-0 items-center gap-2.5 px-4">
            {cover}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {onSummary ? (
                <p className="truncate font-display text-lg font-semibold leading-tight tracking-tight">{release.title}</p>
              ) : (
                <h1 className="truncate font-display text-lg font-semibold leading-tight tracking-tight">{release.title}</h1>
              )}
              {facts}
            </div>
          </header>
          <ScrollArea.Root className="flex-1">
            <ScrollArea.Viewport>
          <nav aria-label="Release parts">
            <ul className="relative space-y-0.5 p-2 pt-4" {...slide.group}>
              {slide.light}
              {PARTS.map(({ part, label, icon: Icon }) => (
                <li key={part} className="relative" {...slide.row}>
                  <Link
                    {...releaseLink(section, release.id, part)}
                    activeOptions={{ exact: part === 'summary' }}
                    className="group press relative flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] text-ink-soft transition-colors hover:text-ink data-[status=active]:bg-accent-soft data-[status=active]:font-medium data-[status=active]:text-ink"
                  >
                    {({ isActive }) => (
                      <>
                        <Led lit={isActive} className={cn('absolute left-0.5', !isActive && 'opacity-0')} />
                        <Icon size={18} aria-hidden="true" className={isActive ? 'text-accent' : 'text-ink-muted group-hover:text-ink-soft'} />
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
          <div className="flex flex-col gap-2 border-t border-line p-3">
            <SaveAndExit section={section} />
            {section === 'upcoming' ? <MoveToReleases /> : <MoveBack {...data} />}
          </div>
        </aside>
      )}
      <Page
        // On desktop the release is named in the parts panel's header, so the page's keeps only the way back up.
        title={isDesktop ? undefined : release.title}
        crumbs={[sectionCrumb(section)]}
        lead={onSummary || isDesktop ? undefined : cover}
        meta={onSummary && !artFailure ? null : isDesktop ? undefined : facts}
        actions={
          isDesktop ? (
            oneTrack && <UploadButton />
          ) : (
            <>
              {oneTrack && <UploadButton />}
              <SaveAndExit section={section} compact />
              {section === 'upcoming' ? <MoveToReleases compact /> : <MoveBack {...data} compact />}
            </>
          )
        }
        bleed={onSummary}
        bar={
          !isDesktop && (
                <nav aria-label="Release parts" className={cn('edge-fade-x flex shrink-0 snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] sm:px-6', onSummary ? 'pb-3' : '-mx-4 -mt-2 mb-5 sm:-mx-6')}>
                  {PARTS.map(({ part, label, icon: Icon }) => (
                    <Link
                      key={part}
                      {...releaseLink(section, release.id, part)}
                      activeOptions={{ exact: part === 'summary' }}
                      className="surface-control press flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border border-line/40 px-4 text-sm text-ink-soft data-[status=active]:border-accent/40 data-[status=active]:bg-accent-soft data-[status=active]:font-medium data-[status=active]:text-ink"
                    >
                      <Icon size={15} aria-hidden="true" className="text-accent" />
                      {label}
                    </Link>
                  ))}
                </nav>
          )
        }
      >
        <Outlet />
      </Page>
      <div id={DOCK} className="contents" />
      {section === 'upcoming' && <MoveToReleasesDialog {...data} />}
    </div>
  )
}

/**
 * Saves and leaves for the release's list. On Details it submits that form (the `form` attribute), which saves and
 * then leaves, or stays and says why; every other part has nothing unsaved (lyrics and artwork save themselves).
 */
function SaveAndExit({ section, compact }: { section: Section; compact?: boolean }) {
  const navigate = useNavigate()
  const label = 'Save and exit'
  return (
    <Tip label={`Save, then back to ${SECTIONS[section].label}`}>
      <Button
        type="submit"
        form={DETAILS_FORM}
        data-exit
        variant="secondary"
        aria-label={compact ? label : undefined}
        onClick={(e) => {
          if (document.getElementById(DETAILS_FORM)) return
          e.preventDefault()
          void navigate(SECTIONS[section].index)
        }}
        className={cn('gap-2', compact ? 'size-11 px-0' : 'w-full')}
      >
        <LogOut size={16} aria-hidden="true" />
        {!compact && label}
      </Button>
    </Tip>
  )
}

/** Stamps a release out of Upcoming: opens Move to Releases (`?move`), which picks each final master first. */
function MoveToReleases({ compact }: { compact?: boolean }) {
  const { show } = useMoveParam()
  const label = 'Move to Releases'
  return (
    <Tip label="Stamp it released, with exactly what shipped">
      <Button variant="cardPrimary" aria-label={compact ? label : undefined} onClick={() => void show()} className={compact ? 'size-11 px-0' : 'w-full'}>
        <Disc3 size={16} aria-hidden="true" />
        {!compact && label}
      </Button>
    </Tip>
  )
}

/** Back to Upcoming, only while the keep window is open (always, when Settings keeps everything): the stamps come off
 *  and every pruned version comes back. */
function MoveBack({ release, pruned, keepDays, compact }: ReleaseData & { compact?: boolean }) {
  const navigate = useNavigate()
  const [state, setState] = useState<{ status: 'idle' | 'moving' } | { status: 'failed'; message: string }>({ status: 'idle' })
  const back = release.released_at ? moveBackWindow(release.released_at, keepDays) : null
  if (!back) return null
  const zone = deviceZone()
  const label = 'Move back to Upcoming'
  const tip =
    state.status === 'failed'
      ? state.message
      : back.until
        ? `Until ${formatDay(dayOf(back.until, zone), todayIn(zone))}${pruned ? `, with the ${pruned} older ${pruned === 1 ? 'version' : 'versions'} waiting to be erased` : ''}`
        : `Back to Upcoming as it was${pruned ? `, with the ${pruned} older ${pruned === 1 ? 'version' : 'versions'} set aside` : ''}`
  const move = async () => {
    setState({ status: 'moving' })
    try {
      await moveToUpcoming({ data: release.id })
      await navigate({ ...releaseLink('upcoming', release.id, 'tracks'), replace: true })
    } catch (error) {
      setState({ status: 'failed', message: (error instanceof Error && error.message) || 'Couldn’t move it back. Try again.' })
    }
  }
  return (
    <Tip label={tip}>
      <Button
        variant="secondary"
        aria-label={compact ? label : undefined}
        aria-busy={state.status === 'moving'}
        disabled={state.status === 'moving'}
        onClick={() => void move()}
        className={cn('gap-2', compact ? 'size-11 px-0' : 'w-full', state.status === 'failed' && 'ring-2 ring-feedback-error/60')}
      >
        {state.status === 'moving' ? <Tuning /> : <CalendarClock size={16} aria-hidden="true" />}
        {!compact && label}
      </Button>
    </Tip>
  )
}
