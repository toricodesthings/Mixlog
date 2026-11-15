import { useNavigate, useSearch } from '@tanstack/react-router'
import { Check, UserRoundPlus, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { createArtist, listArtists, type ArtistRow, type TrackArtist, type TrackArtistRole } from '#/server/artists'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { cn, fold } from '../../lib/utils'
import { Button, Led, Skeleton, Tuning } from '../primitives'
import { SearchField } from '../primitives/SearchField'
import { SegmentedControl } from '../primitives/SegmentedControl'
import { Composer } from '../shared/Composer'
import { ArtistAvatar } from './ArtistAvatar'
import { matchArtists, tracksOf } from './browse'

type Search = { artists?: string }
export type OnTrack = Omit<TrackArtist, 'track_id'>

const ROLES = [
  { value: 'artist', label: 'Main' },
  { value: 'featured', label: 'Feat.' },
] as const

/** `?artists=<trackId>` opens the artists on that track over Details, so a refresh or Back behaves. */
export function useArtistsParam() {
  const navigate = useNavigate()
  return {
    open: useSearch({ strict: false }).artists ?? null,
    show: (trackId: string) => navigate({ to: '.', search: (prev: Search) => ({ ...prev, artists: trackId }), resetScroll: false }),
    close: () => navigate({ to: '.', search: ({ artists: _, ...rest }: Search) => rest, resetScroll: false }),
  }
}

const CHIP =
  'press group flex min-h-11 max-w-full items-center gap-2.5 rounded-full border py-1 pr-4 pl-1.5 text-left transition-[border-color,background-color] hover:border-accent/50 hover:bg-accent-dim focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50'

/** A track's artists in Details: one chip each (face, name, and Main or Feat. under it), then Add artist. Any chip
 *  opens the picker, where one is changed or taken off and more are added. */
export function TrackArtistsButton({ trackId, lineup, label }: { trackId: string; lineup: OnTrack[]; label: string }) {
  const { show } = useArtistsParam()
  const open = () => void show(trackId)
  return (
    <ul aria-label={label} className="flex flex-wrap items-center gap-2">
      {lineup.map((a) => (
        <li key={a.id} className="min-w-0">
          <button type="button" onClick={open} aria-label={`${a.name}, ${a.role === 'featured' ? 'featured' : 'main artist'}. Change`} className={cn(CHIP, 'border-line-light bg-white/[0.04]')}>
            <ArtistAvatar id={a.id} name={a.name} src={a.profile_image_url} size="chip" className="size-8" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-ink">{a.name}</span>
              <span className="text-[0.6875rem] text-ink-muted">{a.role === 'featured' ? 'Feat.' : 'Main'}</span>
            </span>
          </button>
        </li>
      ))}
      <li>
        <button type="button" onClick={open} className={cn(CHIP, 'border-dashed border-line-strong text-ink-muted hover:text-ink')}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-accent">
            <UserRoundPlus size={14} aria-hidden="true" />
          </span>
          <span className="text-sm">{lineup.length ? 'Add artist' : 'Add artists'}</span>
        </button>
      </li>
    </ul>
  )
}

/**
 * The artists on a track, picked from the roster as cards with their faces, never a bare dropdown. Tap a card to add
 * them (main by default), Main or Feat. beside each name, and a name that isn't on the roster yet is one tap to add.
 * Nothing is saved until Done, which hands the artists back at once; the save runs behind it.
 */
export function ArtistPicker({ trackTitle, number, lineup, onDone }: { trackTitle: string; number: number; lineup: OnTrack[]; onDone: (lineup: OnTrack[]) => void }) {
  const { close } = useArtistsParam()
  const { isTouch } = useShellMode()
  const [roster, setRoster] = useState<ArtistRow[] | null>(null)
  const [chosen, setChosen] = useState(lineup)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listArtists()
      .then((rows) => live && setRoster(rows))
      .catch(() => live && (setRoster([]), setProblem('Couldn’t read the artists. Close and try again.')))
    return () => void (live = false)
  }, [])

  const shown = matchArtists(roster ?? [], query)
  const name = query.trim()
  const exact = (roster ?? []).some((a) => fold(a.name) === fold(name))
  const toggle = (a: OnTrack) => setChosen((all) => (all.some((c) => c.id === a.id) ? all.filter((c) => c.id !== a.id) : [...all, { ...a, role: 'artist' }]))
  const setRole = (id: string, role: TrackArtistRole) => setChosen((all) => all.map((c) => (c.id === id ? { ...c, role } : c)))
  const addNew = () => {
    setAdding(true)
    setProblem(null)
    createArtist({ data: { name, role: null } })
      .then(({ id }) => {
        const row = { id, name, role: null, profile_image_url: null, track_count: 0 }
        setRoster((all) => [...(all ?? []), row].sort((a, b) => a.name.localeCompare(b.name)))
        setChosen((all) => [...all, { id, name, role: 'artist', profile_image_url: null }])
        setQuery('')
      })
      .catch((error) => setProblem(error instanceof Error ? error.message : 'Couldn’t add the artist.'))
      .finally(() => setAdding(false))
  }
  const done = () => {
    onDone([...chosen.filter((c) => c.role === 'artist'), ...chosen.filter((c) => c.role === 'featured')])
    void close()
  }

  return (
    <Composer
      onClose={() => void close()}
      title="Artists"
      icon={UsersRound}
      eyebrow={
        <>
          <Led lit={chosen.length > 0} />
          <span className="truncate">Trk {String(number).padStart(2, '0')} · {trackTitle}</span>
        </>
      }
      submit={{ label: 'Done', icon: Check, onSubmit: done }}
      className="gap-5 sm:max-w-2xl [&>*]:min-w-0"
    >
      <section aria-label="On this track" className="flex flex-col gap-2">
        {chosen.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-3.5 text-sm text-ink-muted">Tap an artist below to add them to this track.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {chosen.map((a) => (
              <li key={a.id} className="surface-item flex min-h-14 items-center gap-3 rounded-2xl py-1.5 pr-1.5 pl-2">
                <ArtistAvatar id={a.id} name={a.name} src={a.profile_image_url} size="chip" className="size-9" />
                <span className="min-w-0 flex-1 truncate font-display text-[0.9375rem] font-semibold">{a.name}</span>
                <SegmentedControl ariaLabel={`${a.name} as main or featured`} value={a.role} onChange={(role) => setRole(a.id, role)} options={ROLES} size="sm" />
                <Button variant="ghost" size="icon" aria-label={`Take ${a.name} off this track`} onClick={() => toggle(a)} className="size-9 shrink-0">
                  <X size={15} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <SearchField value={query} onValueChange={setQuery} aria-label="Search artists" placeholder="Search or add an artist" autoFocus={!isTouch} />
        <ul className="grid max-h-[min(22rem,45dvh)] grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-4" aria-busy={roster === null || undefined}>
          {roster === null
            ? Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="flex flex-col items-center gap-2 p-3">
                  <Skeleton className="size-16 rounded-full" style={{ '--sweep-delay': `${i * 80}ms` } as React.CSSProperties} />
                  <Skeleton className="h-3 w-16 rounded-full" />
                </li>
              ))
            : shown.map((a) => {
                const on = chosen.some((c) => c.id === a.id)
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle({ id: a.id, name: a.name, role: 'artist', profile_image_url: a.profile_image_url })}
                      className={cn(
                        'press relative flex w-full flex-col items-center gap-2 rounded-2xl border px-2 pt-3 pb-2.5 text-center transition-[border-color,background-color,box-shadow] duration-(--duration-normal) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50',
                        on ? 'border-accent/60 bg-accent/[0.08] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]' : 'border-transparent hover:border-line hover:bg-white/[0.04]',
                      )}
                    >
                      <ArtistAvatar id={a.id} name={a.name} src={a.profile_image_url} size="pick" />
                      <span className="w-full truncate text-[0.8125rem] font-semibold text-ink">{a.name}</span>
                      <span className="readout -mt-1.5 w-full truncate text-ink-muted">{a.role ?? tracksOf(a.track_count)}</span>
                      {on && <Check size={18} strokeWidth={3} aria-hidden="true" className="absolute top-2 right-2 rounded-full bg-accent p-0.5 text-on-accent" />}
                    </button>
                  </li>
                )
              })}
          {roster !== null && name && !exact && (
            <li>
              <button
                type="button"
                onClick={addNew}
                disabled={adding}
                className="press flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong px-2 pt-3 pb-2.5 text-center transition-colors hover:border-accent/60 hover:bg-accent-dim focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-white/[0.05] text-accent">{adding ? <Tuning /> : <UserRoundPlus size={22} aria-hidden="true" />}</span>
                <span className="w-full truncate text-[0.8125rem] font-semibold text-ink">{name}</span>
                <span className="readout -mt-1.5 text-accent">New artist</span>
              </button>
            </li>
          )}
        </ul>
        {roster !== null && roster.length === 0 && !name && <p className="px-1 text-sm text-ink-muted">No artists yet. Type a name to add the first.</p>}
        {roster !== null && roster.length > 0 && shown.length === 0 && exact && <p className="px-1 text-sm text-ink-muted">Nobody else matches “{name}”.</p>}
      </div>
      {problem && <p role="alert" className="text-sm text-feedback-error">{problem}</p>}
    </Composer>
  )
}
