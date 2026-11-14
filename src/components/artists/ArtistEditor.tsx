import { Link, useRouter } from '@tanstack/react-router'
import { BadgeCheck, ChevronRight, ImagePlus, ListMusic, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { updateArtist, type ArtistProfile } from '#/server/artists'
import { ARTWORK_ACCEPT, artworkProblem } from '#/server/files'
import { useDropTarget } from '../../hooks/ui/use-drop-target'
import { uploadArtistProfile } from '../../lib/files'
import { cn } from '../../lib/utils'
import { Button, Input, Led, Scope, Transfer, useHoverSlide } from '../primitives'
import { Page } from '../layout/Page'
import { ComposerRow, ComposerRows, ValueSelect } from '../shared/Composer'
import { MetaLine } from '../shared/MetaLine'
import { sectionOf, trackLink } from '../releases/sections'
import { ROLE_OPTIONS } from './AddArtistDialog'
import { ArtistAvatar } from './ArtistAvatar'

/** An artist's page: their portrait, name and role (saved together), then every track they're on, each a link to it. */
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
  const slide = useHoverSlide()
  const dirty = name.trim() !== shownName || role !== (artist.role ?? '') || profile !== null

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
    if (!issue) (setProfile(file), setSaved(false))
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
        <Button onClick={save} disabled={!dirty || busy} aria-label="Save" className="max-sm:w-11 max-sm:px-0">
          <Save size={16} aria-hidden="true" />
          <span className="max-sm:hidden">Save</span>
        </Button>
      }
    >
      <div className="mx-auto grid w-full max-w-6xl items-start gap-4 lg:grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)] lg:gap-6">
        <section aria-label="Profile" className="surface-card glass-edge flex flex-col gap-5 rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-col items-center gap-3 pt-2">
            <button
              type="button"
              {...drop.props}
              onClick={() => input.current?.click()}
              aria-label={artist.profile_image_url || preview ? 'Change the picture' : 'Add a picture'}
              className={cn('group press relative rounded-full', drop.over && 'ring-2 ring-accent')}
            >
              <span aria-hidden="true" className="absolute -inset-3 rounded-full border border-line-light" />
              <span aria-hidden="true" className="absolute -inset-6 rounded-full border border-line/50" />
              <ArtistAvatar id={artist.id} name={shownName} src={preview ?? artist.profile_image_url} size="profile" className="glow-accent" />
              <span className={cn('absolute inset-0 flex items-center justify-center rounded-full bg-room-void/60 text-ink transition-opacity duration-(--duration-normal)', drop.over ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100')}>
                <ImagePlus size={24} aria-hidden="true" />
              </span>
              {busy && profile && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-room-void/60">
                  <Transfer direction="up" value={sent} label="Sending the picture" className="text-4xl" />
                </span>
              )}
            </button>
            <p className="readout mt-3 text-ink-muted">{preview ? 'New picture · saved with Save' : 'PNG or JPG · click or drop'}</p>
            <input ref={input} type="file" accept={ARTWORK_ACCEPT} hidden onChange={(event) => (pick(event.target.files?.[0]), (event.target.value = ''))} />
          </div>

          <label className="flex flex-col gap-2">
            <span className="readout text-ink-muted">Name</span>
            <Input value={name} maxLength={200} onChange={(event) => (setName(event.target.value), setSaved(false))} className="font-display text-base font-semibold" />
          </label>
          <ComposerRows>
            <ComposerRow icon={BadgeCheck} label="Role">
              <ValueSelect label="Role" value={role || 'none'} onChange={(next) => (setRole(next === 'none' ? '' : next), setSaved(false))} options={ROLE_OPTIONS} />
            </ComposerRow>
          </ComposerRows>
          {problem ? (
            <p role="alert" className="text-sm text-feedback-error">{problem}</p>
          ) : (
            saved && !dirty && (
              <p className="readout flex items-center gap-2 text-ink-muted" aria-live="polite">
                <Led />
                Saved
              </p>
            )
          )}
        </section>

        <section aria-labelledby="artist-tracks" className="surface-card flex min-w-0 flex-col gap-3 rounded-[2rem] p-3 sm:p-4">
          <div className="flex items-baseline justify-between gap-3 px-3 pt-2">
            <h2 id="artist-tracks" className="font-display text-xl font-semibold tracking-tight">Tracks</h2>
            <p className="readout text-ink-muted">{artist.tracks.length} {artist.tracks.length === 1 ? 'track' : 'tracks'}</p>
          </div>
          {artist.tracks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 pt-4 pb-8 text-center">
              <Scope flat className="opacity-70" />
              <p className="max-w-xs text-sm leading-relaxed text-ink-soft">Not on a track yet. Add them from a track’s Details, under its title.</p>
            </div>
          ) : (
            <ol className="relative flex flex-col gap-0.5" {...slide.group}>
              {slide.light}
              {artist.tracks.map((track) => {
                const body = (
                  <>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-accent">
                      <ListMusic size={18} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-display font-semibold text-ink">{track.title}</span>
                      <MetaLine facts={[track.release_format === 'single' ? 'Single' : track.release_title, track.released_at ? 'Released' : 'Upcoming']} className="text-[0.8125rem]" />
                    </span>
                    <span className={cn('readout shrink-0', track.role === 'featured' ? 'text-accent-tertiary' : 'text-accent')}>{track.role === 'featured' ? 'Feat.' : 'Main'}</span>
                  </>
                )
                return (
                  <li key={track.id} className="relative" {...slide.row}>
                    {track.release_id ? (
                      <Link {...trackLink(sectionOf(track), track.release_id, track.id)} className="group playhead-sweep press flex min-h-16 items-center gap-3 rounded-2xl px-3 py-2">
                        {body}
                        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-ink-muted transition-[translate,color] group-hover:translate-x-0.5 group-hover:text-accent" />
                      </Link>
                    ) : (
                      <div className="flex min-h-16 items-center gap-3 px-3 py-2">{body}</div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </Page>
  )
}
