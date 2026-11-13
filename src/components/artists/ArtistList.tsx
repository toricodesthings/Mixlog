import { Link } from '@tanstack/react-router'
import { UserRoundPlus } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import type { ArtistRow } from '#/server/artists'
import { Button } from '../primitives'
import { Page } from '../layout/Page'
import { EmptyState } from '../shared/EmptyState'
import { toast } from '../primitives'
import { AddArtistDialog, type ArtistDraft } from './AddArtistDialog'

/** View-only artist management until artist creation and editing are wired to the schema. */
export function ArtistList({ artists }: { artists: ArtistRow[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const addArtist = () => setAdding(true)
  // Artists still being saved: in the list at once, replaced by the real ones when the reload lands.
  const [drafts, setDrafts] = useState<ArtistDraft[]>([])
  const settle = (id: string, problem?: string) => {
    const draft = drafts.find((d) => d.id === id)
    const done = () => (setDrafts((all) => all.filter((d) => d.id !== id)), draft?.image && URL.revokeObjectURL(draft.image))
    if (!problem) return void router.invalidate().then(done)
    done()
    toast.error(`Couldn’t add ${draft?.name ?? 'the artist'}`, { description: problem })
  }
  const shown: ArtistRow[] = [
    ...artists,
    ...drafts.map((d) => ({ id: d.id, name: d.name, role: d.role, profile_image_url: d.image, track_count: 0 })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Page
      title="Artists"
      actions={
        <Button onClick={addArtist} aria-label="Add Artist" className="max-sm:w-11 max-sm:px-0">
          <UserRoundPlus size={16} aria-hidden="true" />
          <span className="max-sm:hidden">Add Artist</span>
        </Button>
      }
    >
      <AddArtistDialog open={adding} onOpenChange={setAdding} onDraft={(draft) => setDrafts((all) => [...all, draft])} onSettled={settle} />
      {shown.length === 0 ? (
        <EmptyState title="No artists yet" readout="No signal" flat action={<Button onClick={addArtist}>Add Artist</Button>}>
          Artists will appear here once they are connected to a track.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {shown.map((artist) => (
            <li key={artist.id} className="min-w-0">
              <Link
                disabled={drafts.some((d) => d.id === artist.id)}
                aria-busy={drafts.some((d) => d.id === artist.id) || undefined}
                to="/artists/$artistId"
                params={{ artistId: artist.id }}
                data-lift
                className="group flex min-w-0 flex-col items-center text-center outline-hidden"
              >
                <span className="relative block aspect-square w-full max-w-48 overflow-hidden rounded-full border border-line-strong bg-room-surface shadow-[inset_0_1px_rgba(255,255,255,0.12)] transition-[border-color,box-shadow,transform] duration-(--duration-normal) group-hover:-translate-y-1 group-hover:border-accent/60 group-hover:shadow-[0_12px_30px_color-mix(in_srgb,var(--accent)_18%,transparent)] group-focus-visible:ring-2 group-focus-visible:ring-accent/60">
                  {artist.profile_image_url ? (
                    <img src={artist.profile_image_url} alt="" loading="lazy" decoding="async" width={192} height={192} className="size-full object-cover transition-transform duration-(--duration-smooth) group-hover:scale-105" />
                  ) : (
                    <span aria-hidden="true" className="flex size-full items-center justify-center text-[clamp(2rem,5vw,4rem)] font-display font-semibold tracking-tight text-accent">
                      {initialsOf(artist.name)}
                    </span>
                  )}
                  <span aria-hidden="true" className="absolute inset-0 bg-accent/10 opacity-0 transition-opacity duration-(--duration-normal) group-hover:opacity-100" />
                </span>
                <h2 className="mt-4 max-w-full truncate font-display text-base font-semibold tracking-tight text-ink transition-colors group-hover:text-accent">{artist.name}</h2>
                <p className="mt-1 readout text-ink-muted">
                  {artist.track_count} {artist.track_count === 1 ? 'track' : 'tracks'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

function initialsOf(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
  return initials.toUpperCase() || '?'
}
