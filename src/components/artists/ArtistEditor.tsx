import { Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown, Disc3, Save, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { updateArtist, type ArtistProfile } from '#/server/artists'
import { ARTWORK_ACCEPT, artworkProblem } from '#/server/files'
import { uploadArtistProfile } from '../../lib/files'
import { cn } from '../../lib/utils'
import { Button, Input, Transfer } from '../primitives'
import * as DropdownMenu from '../primitives/DropdownMenu'
import { Page } from '../layout/Page'
import { useDropTarget } from '../../hooks/ui/use-drop-target'

const ROLES = ['Artist', 'Producer', 'Songwriter', 'Composer', 'Engineer', 'Other'] as const

export function ArtistEditor({ artist }: { artist: ArtistProfile }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(artist.name)
  const [role, setRole] = useState(artist.role ?? '')
  const [profile, setProfile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [sent, setSent] = useState(0)
  const [shownName, setShownName] = useState(artist.name) // the saved name, on the page at once
  const [busy, setBusy] = useState(false) // only the picture's bytes keep it busy
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile) return setPreview(null)
    const url = URL.createObjectURL(profile)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [profile])

  const pick = (file: File | undefined) => {
    if (!file) return
    const issue = artworkProblem(file.type, file.size)
    setProblem(issue)
    if (!issue) setProfile(file)
  }
  const drop = useDropTarget({ onFiles: (files) => pick(files[0]) })
  /** The name and role change at once and the server catches up behind them; a failure puts the name back and says why. */
  const save = () => {
    if (!name.trim()) return setProblem('Give the artist a name.')
    const before = shownName
    const picture = profile
    setProblem(null)
    setSaved(true)
    setShownName(name.trim())
    updateArtist({ data: { id: artist.id, name, role: role || null } })
      .then(async () => {
        if (!picture) return
        setBusy(true)
        setSent(0)
        await uploadArtistProfile(artist.id, picture, setSent)
        setProfile(null)
      })
      .then(() => router.invalidate())
      .catch((error) => {
        setShownName(before)
        setSaved(false)
        setProblem(error instanceof Error ? error.message : 'Couldn’t save the artist.')
      })
      .finally(() => setBusy(false))
  }

  return (
    <Page
      title={shownName}
      crumbs={[{ label: 'Artists', link: { to: '/artists' } }]}
      actions={
        <Button onClick={save}>
          <Save size={16} aria-hidden="true" />
          <span>Save</span>
        </Button>
      }
    >
      <div className="grid w-full min-w-0 gap-6 lg:h-[calc(100dvh-var(--shell-header-h)-3rem)] lg:min-h-0 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)] xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="surface-card glass-edge flex flex-col items-center gap-4 rounded-[2rem] p-5 text-center" aria-labelledby="artist-profile">
          <div className="flex items-center gap-2 self-start text-left">
            <UserRound size={17} aria-hidden="true" className="text-accent" />
            <h2 id="artist-profile" className="font-display text-lg font-semibold">Profile</h2>
          </div>
          <button
            type="button"
            {...drop.props}
            onClick={() => input.current?.click()}
            aria-label={profile ? 'Replace profile image' : 'Add profile image'}
            className={cn('group relative flex size-48 items-center justify-center overflow-hidden rounded-full border border-dashed border-line-strong bg-room-surface text-5xl font-display font-semibold text-accent transition-[border-color,box-shadow] hover:border-accent/60', drop.over && 'border-accent glow-accent')}
          >
            {preview ? (
              <img src={preview} alt="" width={192} height={192} className="size-full object-cover" />
            ) : artist.profile_image_url ? (
              <img src={artist.profile_image_url} alt="" decoding="async" width={192} height={192} className="size-full object-cover" />
            ) : (
              initialsOf(artist.name)
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-room-void/65 text-sm text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Change image</span>
          </button>
          <p className="readout text-ink-muted">PNG or JPG · optional</p>
          <input ref={input} type="file" accept={ARTWORK_ACCEPT} hidden onChange={(event) => { pick(event.target.files?.[0]); event.target.value = '' }} />
          {busy && profile && <Transfer direction="up" value={sent} label="Sending the profile image" className="text-3xl" />}
          </section>

          <section className="surface-card glass-edge flex min-w-0 flex-col gap-6 rounded-[2rem] p-5 sm:p-6 lg:p-8" aria-labelledby="artist-details">
          <div>
            <h2 id="artist-details" className="font-display text-xl font-semibold tracking-tight">Artist details</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">Main or featured billing is chosen on each track.</p>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink">Name</span>
            <Input value={name} onChange={(event) => { setName(event.target.value); setSaved(false) }} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink">Role <span className="font-normal text-ink-muted">· optional</span></span>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button type="button" variant="secondary" className="w-full justify-between">
                  <span>{role || 'Choose a role'}</span>
                  <ChevronDown size={16} aria-hidden="true" className="text-ink-muted" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" className="min-w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenu.RadioGroup value={role || 'none'} onValueChange={(next) => setRole(next === 'none' ? '' : next)}>
                  <DropdownMenu.RadioItem value="none">No role</DropdownMenu.RadioItem>
                  {ROLES.map((option) => <DropdownMenu.RadioItem key={option} value={option}>{option}</DropdownMenu.RadioItem>)}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </label>
          {problem && <p role="alert" className="text-sm text-feedback-error">{problem}</p>}
          {saved && <p role="status" className="text-sm text-feedback-success">Artist saved.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="readout text-ink-muted">{artist.track_count} {artist.track_count === 1 ? 'track' : 'tracks'}</p>
            <div className="flex gap-2">
              <Button variant="secondary" asChild>
                <Link to="/artists"><ArrowLeft size={16} aria-hidden="true" /> Back to Artists</Link>
              </Button>
              <Button onClick={save}><Save size={16} aria-hidden="true" /> Save</Button>
            </div>
          </div>
          </section>
        </div>

        <section className="surface-card glass-edge flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[2rem] p-5 sm:p-6 lg:p-8" aria-labelledby="artist-tracks">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Disc3 size={18} aria-hidden="true" className="text-accent" />
              <h2 id="artist-tracks" className="font-display text-xl font-semibold tracking-tight">Tracks</h2>
            </div>
            <span className="readout text-ink-muted">{artist.tracks.length} {artist.tracks.length === 1 ? 'track' : 'tracks'}</span>
          </div>
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
            {artist.tracks.length === 0 ? (
              <p className="py-8 text-sm leading-relaxed text-ink-muted">This artist is not attached to any tracks yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {artist.tracks.map((track) => (
                  <li key={track.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line/60 bg-room-surface-muted/50 px-3 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-room-surface text-accent">
                      <Disc3 size={16} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-display font-semibold text-ink">{track.title}</span>
                      <span className="truncate text-sm text-ink-muted">{track.release_title ?? 'No release'}</span>
                    </span>
                    <span className="readout shrink-0 text-ink-muted">{track.role === 'featured' ? 'Featured' : 'Main'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </Page>
  )
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '?'
}
