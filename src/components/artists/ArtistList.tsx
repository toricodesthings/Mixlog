import { Link, useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { ChevronRight, LayoutGrid, LayoutList, ListMusic, UserRoundPlus } from 'lucide-react'
import { useRef, useState } from 'react'

import type { ArtistRow } from '#/server/artists'
import { Button, Meter, toast, useHoverSlide } from '../primitives'
import { SearchField } from '../primitives/SearchField'
import { SegmentedControl } from '../primitives/SegmentedControl'
import { Page } from '../layout/Page'
import { EmptyState } from '../shared/EmptyState'
import { MetaLine } from '../shared/MetaLine'
import { AddArtistDialog, type ArtistDraft } from './AddArtistDialog'
import { ArtistAvatar } from './ArtistAvatar'
import { artistSearch, matchArtists, tracksOf, type ArtistSearch } from './browse'

const VIEWS = [
  { value: 'cards', label: <span className="max-sm:sr-only">Cards</span>, icon: <LayoutGrid size={16} aria-hidden="true" /> },
  { value: 'list', label: <span className="max-sm:sr-only">List</span>, icon: <LayoutList size={16} aria-hidden="true" /> },
] as const

/** Artists: everyone who can be on a track. Search (name or role) and the view above them, as portrait cards
 *  (the default) or a list; all of it in the URL (`?q=&view=&add`), like Upcoming. */
export function ArtistList({ artists }: { artists: ArtistRow[] }) {
  const router = useRouter()
  const navigate = useNavigate()
  const search: ArtistSearch = useSearch({ strict: false })
  // Refining replaces the entry (typing shouldn't flood Back); opening Add pushes one, so Back closes it.
  const set = (next: Partial<ArtistSearch>, replace = true) =>
    void navigate({ to: '.', search: (prev: ArtistSearch) => artistSearch({ ...prev, ...next }), replace, resetScroll: false })
  const query = search.q ?? ''
  const view = search.view ?? 'cards'
  const addArtist = () => set({ add: true }, false)
  // Artists still being saved: in the list at once, replaced by the real ones when the reload lands.
  const [drafts, setDrafts] = useState<ArtistDraft[]>([])
  // The dialog settles with the callback from before its draft was added: read the drafts as they are now
  const draftsNow = useRef(drafts)
  draftsNow.current = drafts
  const settleDraft = (id: string, problem?: string) => {
    const draft = draftsNow.current.find((d) => d.id === id)
    const done = () => (setDrafts((all) => all.filter((d) => d.id !== id)), draft?.image && URL.revokeObjectURL(draft.image))
    if (!problem) return void router.invalidate().then(done)
    done()
    toast.error(`Couldn’t add ${draft?.name ?? 'the artist'}`, { description: problem })
  }
  const all: (ArtistRow & { draft?: true })[] = [...artists, ...drafts.map((d) => ({ id: d.id, name: d.name, role: d.role, profile_image_url: d.image, track_count: 0, draft: true as const }))]
  const shown = matchArtists(all, query)
  const slide = useHoverSlide()
  const add = (
    <Button onClick={addArtist} aria-label="Add Artist" className="max-sm:w-11 max-sm:px-0">
      <UserRoundPlus size={16} aria-hidden="true" />
      <span className="max-sm:hidden">Add Artist</span>
    </Button>
  )

  return (
    <Page title="Artists" actions={all.length > 0 && add}>
      <AddArtistDialog open={search.add === true} onOpenChange={(open) => !open && set({ add: undefined })} onDraft={(draft) => setDrafts((d) => [...d, draft])} onSettled={settleDraft} />
      {all.length === 0 ? (
        <EmptyState title="No artists yet" readout="Ch 01 · No talkback" flat action={add}>
          Add the people you make music with, then add them to a track from its Details.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <SearchField value={query} onValueChange={(q) => set({ q })} aria-label="Search artists" placeholder="Search by name or role" className="flex-1 sm:max-w-md" />
            <SegmentedControl ariaLabel="View" value={view} onChange={(v) => set({ view: v === 'list' ? 'list' : undefined })} options={VIEWS} />
          </div>

          <p className="readout -mb-2 px-1 text-ink-muted" aria-live="polite">
            {shown.length} of {all.length} · A–Z
          </p>

          {shown.length === 0 ? (
            <EmptyState title="Nobody matches" readout="0 found" flat action={<Button variant="secondary" onClick={() => set({ q: undefined })}>Show everyone</Button>}>
              No artist has “{query.trim()}” in their name or role.
            </EmptyState>
          ) : view === 'list' ? (
            <ul className="surface-card relative flex flex-col gap-1 rounded-3xl p-2" {...slide.group}>
              {slide.light}
              {shown.map((artist) => (
                <li key={artist.id} className="relative" {...slide.row}>
                  <ArtistLink artist={artist} className="group playhead-sweep press flex min-h-18 items-center gap-4 rounded-2xl p-2 pr-3">
                    <ArtistAvatar id={artist.id} name={artist.name} src={artist.profile_image_url} size="row" className="size-14" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate font-display text-lg font-semibold tracking-tight text-ink">{artist.name}</span>
                      <MetaLine facts={[artist.role, tracksOf(artist.track_count)]} className="text-sm" />
                    </span>
                    <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-muted transition-[translate,color] group-hover:translate-x-0.5 group-hover:text-accent" />
                  </ArtistLink>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] sm:gap-4">
              {shown.map((artist) => (
                <li key={artist.id}>
                  <ArtistLink artist={artist} data-meter-host className="group flex flex-col items-center gap-3 rounded-[1.75rem] px-2 pt-3 pb-2 text-center outline-hidden">
                    {/* The circle is the artist, as in a streaming app: no card around it. It rises and lights on hover. */}
                    <span className="relative w-full transition-[translate] duration-(--duration-smooth) ease-(--ease-out-expo) group-hover:-translate-y-1">
                      <span aria-hidden="true" className="absolute -inset-2 rounded-full border border-line-light opacity-60 transition-[border-color,opacity,box-shadow] duration-(--duration-normal) group-hover:border-accent/60 group-hover:opacity-100 group-hover:shadow-[0_14px_36px_-12px_color-mix(in_srgb,var(--accent)_45%,transparent)] group-focus-visible:border-accent group-focus-visible:opacity-100" />
                      <ArtistAvatar id={artist.id} name={artist.name} src={artist.profile_image_url} size="card" className="[&_img]:transition-[scale] [&_img]:duration-(--duration-smooth) group-hover:[&_img]:scale-105" />
                      <span aria-hidden="true" className="glass absolute right-[4%] bottom-[4%] flex items-center rounded-full px-2 py-1.5 opacity-0 transition-opacity duration-(--duration-normal) group-hover:opacity-100 group-focus-visible:opacity-100">
                        <Meter className="h-3" />
                      </span>
                    </span>
                    <span className="mt-1 flex w-full min-w-0 flex-col gap-0.5">
                      <span className="truncate font-display text-base font-semibold tracking-tight text-ink transition-colors group-hover:text-accent">{artist.name}</span>
                      <span className="readout truncate text-ink-muted">{artist.role ?? 'Artist'}</span>
                    </span>
                    <span className="surface-item flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
                      <ListMusic size={13} aria-hidden="true" className="text-accent" />
                      <span data-numeric className="text-[0.8125rem] font-semibold text-ink">{tracksOf(artist.track_count)}</span>
                    </span>
                  </ArtistLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Page>
  )
}

/** An artist's page; one still being saved can't open yet, and says so to a screen reader. */
function ArtistLink({ artist, ...props }: { artist: ArtistRow & { draft?: true } } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { [data: `data-${string}`]: unknown }) {
  return <Link {...props} to="/artists/$artistId" params={{ artistId: artist.id }} disabled={artist.draft} aria-busy={artist.draft} />
}
