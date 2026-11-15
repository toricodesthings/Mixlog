import { Link, useRouter } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, BadgePlus, ChevronRight, Download, ImagePlus, ListMusic, Plus, Save, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { updateArtist, type ArtistProfile } from '#/server/artists'
import { ARTWORK_ACCEPT, artworkProblem } from '#/server/files'
import { useDropTarget } from '../../hooks/ui/use-drop-target'
import { uploadArtistProfile } from '../../lib/files'
import { SPRINGS } from '../../lib/constants/motion'
import { cn } from '../../lib/utils'
import { Button, Input, Led, Scope, Tip, Transfer, useHoverSlide } from '../primitives'
import { Page } from '../layout/Page'
import { ComposerRow, ComposerRows, ValueSelect, ValuesSelect } from '../shared/Composer'
import { useLeaveGuard } from '../shared/LeaveGuard'
import { ReleaseArt } from '../releases/ReleaseArt'
import { MetaLine } from '../shared/MetaLine'
import { ImageStage, ViewButton, Viewer, ViewerButton, useFullParam } from '../shared/Viewer'
import { sectionOf, trackLink } from '../releases/sections'
import { ROLES, ROLE_OPTIONS } from './AddArtistDialog'
import { ArtistAvatar } from './ArtistAvatar'
import { tracksOf } from './browse'
import { SocialIcon, asLink, linkLabel, platformIn, socialOf } from './socials'

/** An artist's page: their portrait, name and role (saved together), then every track they're on, each a link to it. */
export function ArtistEditor({ artist }: { artist: ArtistProfile }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(artist.name)
  const [role, setRole] = useState(artist.role ?? '')
  const [otherRoles, setOtherRoles] = useState(artist.other_roles)
  const [savedRoles, setSavedRoles] = useState(artist.other_roles)
  const [links, setLinks] = useState(artist.links)
  const [draft, setDraft] = useState('')
  const [profile, setProfile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [sent, setSent] = useState(0)
  const [shownName, setShownName] = useState(artist.name) // the saved name, on the page at once
  const [busy, setBusy] = useState(false) // only the picture's bytes keep it busy
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const typed = platformIn(draft)
  const slide = useHoverSlide()
  const full = useFullParam()
  const dirty = name.trim() !== shownName || role !== (artist.role ?? '') || otherRoles.join() !== savedRoles.join() || profile !== null || links.join() !== artist.links.join() || draft.trim() !== ''

  const { guard, allow } = useLeaveGuard(dirty && !busy, shownName)

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
  /** The pasted link joins the list (once); anything that isn't a web address stays in the box with a word on why. */
  const addLink = () => {
    if (!draft.trim()) return links
    const link = asLink(draft)
    if (!link) return (setProblem('That link doesn’t look right.'), null)
    const next = links.includes(link) ? links : [...links, link]
    setProblem(null)
    setLinks(next)
    setDraft('')
    setSaved(false)
    return next
  }
  /** The name and role change at once and the server catches up behind them; a failure puts the name back and says why. */
  const save = () => {
    if (!name.trim()) return setProblem('Give the artist a name.')
    const next = addLink()
    if (!next) return
    const before = shownName
    const picture = profile
    setProblem(null)
    setSaved(true)
    setShownName(name.trim())
    setSavedRoles(otherRoles)
    allow()
    updateArtist({ data: { id: artist.id, name, role: role || null, otherRoles, links: next } })
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
        setSavedRoles(artist.other_roles)
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
            <span className="relative">
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
              {artist.profile_image_url && !preview && <ViewButton label="View the picture" onClick={() => void full.show()} className="absolute right-1 bottom-1" />}
            </span>
            <p className="readout mt-3 text-ink-muted">{preview ? 'New picture · saved with Save' : 'PNG or JPG · click or drop'}</p>
            <input ref={input} type="file" accept={ARTWORK_ACCEPT} hidden onChange={(event) => (pick(event.target.files?.[0]), (event.target.value = ''))} />
          </div>

          <label className="flex flex-col gap-2">
            <span className="readout text-ink-muted">Name</span>
            <Input value={name} maxLength={200} onChange={(event) => (setName(event.target.value), setSaved(false))} className="font-display text-base font-semibold" />
          </label>
          <ComposerRows>
            <ComposerRow icon={BadgeCheck} label="Role">
              <ValueSelect label="Role" value={role || 'none'} onChange={(next) => (setRole(next === 'none' ? '' : next), setOtherRoles((all) => all.filter((r) => r !== next)), setSaved(false))} options={ROLE_OPTIONS} />
            </ComposerRow>
            <ComposerRow icon={BadgePlus} label="Also">
              <ValuesSelect label="Supporting roles" values={otherRoles} empty="None" options={ROLES.filter((r) => r !== role)} onChange={(next) => (setOtherRoles(next), setSaved(false))} />
            </ComposerRow>
          </ComposerRows>
          <div className="flex flex-col">
            <span className="readout mb-2 text-ink-muted">Links</span>
            <ul className="mb-2 flex flex-wrap gap-2 empty:hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                {links.map((url) => {
                  const name = socialOf(url).name
                  return (
                    <motion.li
                      key={url}
                      layout
                      initial={{ scale: 0.4, opacity: 0, filter: 'blur(6px)' }}
                      animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                      exit={{ scale: 0.4, opacity: 0, filter: 'blur(6px)' }}
                      transition={SPRINGS.GLIDE}
                      className="group relative"
                    >
                      <Tip side="top" label={<span className="flex flex-col"><span className="font-semibold">{name}</span><span className="text-ink-muted">{linkLabel(url)}</span></span>}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={name}
                          className="press flex size-11 items-center justify-center rounded-xl bg-white/[0.05] text-ink-soft transition-colors duration-(--duration-fast) hover:text-accent focus-visible:ring-1 focus-visible:ring-accent/40 focus-visible:outline-hidden"
                        >
                          <SocialIcon url={url} />
                        </a>
                      </Tip>
                      <button
                        type="button"
                        aria-label={`Remove ${name}`}
                        onClick={() => (setLinks(links.filter((l) => l !== url)), setSaved(false))}
                        className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-line-light bg-room-elevated text-ink-muted opacity-0 transition-[opacity,scale,color] duration-(--duration-fast) group-focus-within:opacity-100 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-accent/40 pointer-events-none focus-visible:outline-hidden group-focus-within:pointer-events-auto group-hover:pointer-events-auto pointer-coarse:pointer-events-auto pointer-coarse:opacity-100 before:absolute before:-inset-1 before:content-[''] pointer-coarse:before:-inset-2"
                      >
                        <X size={11} strokeWidth={2.5} aria-hidden="true" />
                      </button>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
            <div className="flex">
              <div className="group relative min-w-0 flex-1">
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-y-0 left-3.5 flex items-center transition-colors duration-(--duration-normal)',
                    typed ? 'text-accent' : 'text-ink-muted group-focus-within:text-ink-soft',
                  )}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={typed?.name ?? 'link'}
                      initial={{ scale: 0.3, opacity: 0, rotate: -20, filter: 'blur(4px)' }}
                      animate={{ scale: 1, opacity: 1, rotate: 0, filter: 'blur(0px)' }}
                      exit={{ scale: 0.3, opacity: 0, rotate: 20, filter: 'blur(4px)' }}
                      transition={SPRINGS.GLIDE}
                      className="flex"
                    >
                      <SocialIcon icon={typed?.icon ?? null} size={16} />
                    </motion.span>
                  </AnimatePresence>
                </span>
                <Input
                  value={draft}
                  inputMode="url"
                  maxLength={300}
                  placeholder="Paste a link"
                  aria-label={typed ? `Add a ${typed.name} link` : 'Add a link'}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addLink())}
                  className="pl-10"
                />
              </div>
              <AnimatePresence initial={false}>
                {draft.trim() && (
                  <motion.span
                    initial={{ width: 0, opacity: 0, scale: 0.8 }}
                    animate={{ width: 54, opacity: 1, scale: 1 }}
                    exit={{ width: 0, opacity: 0, scale: 0.8 }}
                    transition={SPRINGS.GLIDE}
                    className="-my-0.5 -mr-0.5 flex shrink-0 justify-end overflow-hidden py-0.5 pr-0.5"
                  >
                    <Button type="button" onClick={addLink} aria-label="Add the link" className="w-11 shrink-0 px-0">
                      <Plus size={16} aria-hidden="true" />
                    </Button>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
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
            <p className="readout text-ink-muted">{tracksOf(artist.tracks.length)}</p>
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
                    {track.artwork_id ? (
                      <ReleaseArt title={track.release_title ?? track.title} id={track.release_id ?? undefined} artworkId={track.artwork_id} size="row" className="size-11 rounded-xl" />
                    ) : (
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-accent">
                        <ListMusic size={18} aria-hidden="true" />
                      </span>
                    )}
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
                      <Link {...trackLink(sectionOf(track), track.release_id, track.id)} className="group playhead-sweep press flex min-h-16 items-center gap-3 rounded-[1.25rem] px-3 py-2 sm:rounded-2xl">
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
      {guard}
      {full.open && artist.profile_image_url && <PictureViewer name={shownName} src={artist.profile_image_url} onClose={() => void full.close()} />}
    </Page>
  )
}

/** The artist's picture full size (`?full`), uncropped, with its pixels once it's here. */
function PictureViewer({ name, src, onClose }: { name: string; src: string; onClose: () => void }) {
  const [pixels, setPixels] = useState<string | null>(null)
  return (
    <Viewer kind="Picture" name={name} icon={UserRound} onClose={onClose} readout={pixels ?? 'Picture'} actions={<ViewerButton icon={Download} label="Download" name={`Download ${name}’s picture`} href={src} download="" />}>
      <ImageStage src={src} alt={name} onMeasured={({ width, height }) => setPixels(`${width}×${height}`)} />
    </Viewer>
  )
}
