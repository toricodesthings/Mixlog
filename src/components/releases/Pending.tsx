import { useLocation, useSearch } from '@tanstack/react-router'
import type { CSSProperties } from 'react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { Skeleton, Tuning } from '../primitives'
import { Page } from '../layout/Page'
import type { ListSearch } from './browse'
import { SECTIONS, sectionCrumb, type Section } from './sections'

/** Pages on their way, drawn in the shape they'll land in, so nothing jumps when they arrive. The light passes the
 *  clips in reading order (`--sweep-delay`). */

const sweep = (i: number) => ({ '--sweep-delay': `${i * 90}ms` }) as CSSProperties

/**
 * The router's one pending page (`router.tsx`). It reads the URL rather than belonging to a route: on a first load the
 * outermost waiting route renders it (`/upcoming`, not `/upcoming/`), so it must know the page underneath.
 */
export function PagePending() {
  const [, top, releaseId] = useLocation({ select: (l) => l.pathname.split('/') })
  const section: Section | null = top === 'upcoming' ? 'upcoming' : top === 'releases' ? 'released' : null
  if (section) return releaseId ? <ReleasePending section={section} /> : <ReleaseListPending section={section} />
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loading>Loading</Loading>
    </div>
  )
}

/** Said once per pending page, where its facts will be: the room tuning in. */
function Loading({ children }: { children: string }) {
  return (
    <span role="status" className="readout flex items-center gap-2 text-ink-muted">
      <Tuning />
      {children}
    </span>
  )
}

/** Upcoming or Releases on its way, in the view it was left in: Panels' cards or List's rows. */
function ReleaseListPending({ section }: { section: Section }) {
  const { view }: ListSearch = useSearch({ strict: false })
  return (
    <Page title={SECTIONS[section].label}>
      <div aria-busy="true" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-11 basis-full rounded-full sm:basis-64 sm:flex-1" />
          <Skeleton className="h-11 w-60 rounded-full" />
          <Skeleton className="size-11 rounded-xl" />
          <Skeleton className="h-11 w-32 rounded-full" />
        </div>
        <span className="-mb-2 px-1">
          <Loading>{`Loading ${SECTIONS[section].label}`}</Loading>
        </span>
        {view === 'list' ? (
          <div className="surface-card flex flex-col gap-1 rounded-3xl p-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} style={sweep(i)} className="flex min-h-18 items-center gap-4 p-2 pr-3">
                <Skeleton className="size-14 rounded-xl" />
                <span className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4.5 w-1/2 max-w-64 rounded-md" />
                  <Skeleton className="h-3 w-2/3 max-w-80 rounded-md" />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] sm:gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={sweep(i)} className="surface-card glass-edge flex flex-col gap-2.5 rounded-[1.5rem] p-2.5">
                <Skeleton className="aspect-square w-full rounded-[1.4rem]" />
                <span className="flex flex-col gap-1.5 px-1">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/3 rounded-md" />
                </span>
                <span className="flex gap-1.5">
                  <Skeleton className="h-7.5 w-16" />
                  <Skeleton className="h-7.5 w-10" />
                  <Skeleton className="h-7.5 w-14" />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  )
}

/** A release on its way: its parts beside (or above) it, its header, then the shape of the part it opens on. */
function ReleasePending({ section }: { section: Section }) {
  const { isDesktop } = useShellMode()
  const part = useLocation({ select: (l) => l.pathname.split('/')[3] })
  return (
    <div aria-busy="true" className="flex min-w-0 flex-1">
      {isDesktop && (
        <aside className="flex h-full w-64 shrink-0 flex-col gap-0.5 border-r border-line/60 p-2 pt-4">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} style={sweep(i)} className="flex h-12 items-center gap-3 px-3">
              <Skeleton className="size-4.5 rounded-md" />
              <Skeleton className="h-3.5 w-28 rounded-md" />
            </span>
          ))}
        </aside>
      )}
      <Page
        title={
          <>
            <span className="sr-only">Loading the release</span>
            <Skeleton className="my-1 h-6 w-48 rounded-lg sm:w-64" />
          </>
        }
        crumbs={[sectionCrumb(section)]}
        lead={<Skeleton className="size-14 rounded-2xl" />}
        meta={<Loading>Loading</Loading>}
        bar={
          !isDesktop && (
            <div className="-mx-4 -mt-2 mb-5 flex gap-2 overflow-hidden px-4 pb-1 sm:-mx-6 sm:px-6">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} style={sweep(i)} className="h-11 w-28 shrink-0 rounded-full" />
              ))}
            </div>
          )
        }
      >
        <PartPending part={part} />
      </Page>
    </div>
  )
}

function PartPending({ part }: { part?: string }) {
  if (part === 'artwork') return <Skeleton className="aspect-square w-full max-w-md rounded-[1.4rem]" />
  if (part === 'details')
    return (
      <div className="flex max-w-2xl flex-col gap-5">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} style={sweep(i)} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-11 w-full" />
          </span>
        ))}
        <Skeleton style={sweep(4)} className="h-32 w-full rounded-2xl" />
      </div>
    )
  if (part === 'tracks')
    return (
      <div className="surface-card flex flex-col gap-4 rounded-3xl p-3">
        {Array.from({ length: 3 }, (_, lane) => (
          <div key={lane} style={sweep(lane * 2)} className="flex flex-col gap-1 pl-4">
            <Skeleton className="my-4 h-3 w-20 rounded-md" />
            {Array.from({ length: lane === 0 ? 1 : 2 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ))}
      </div>
    )
  // The Summary: its night, then its tracklist.
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="min-h-[45dvh] w-full rounded-[2rem]" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} style={sweep(i + 1)} className="h-14 w-full rounded-2xl" />
      ))}
    </div>
  )
}
