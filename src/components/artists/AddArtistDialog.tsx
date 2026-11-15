import { BadgeCheck, Check, ImagePlus, UserRoundPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { createArtist } from '#/server/artists'
import { ARTWORK_ACCEPT, artworkProblem } from '#/server/files'
import { uploadArtistProfile } from '../../lib/files'
import { cn } from '../../lib/utils'
import { Input } from '../primitives'
import { Composer, ComposerRow, ComposerRows, ValueSelect } from '../shared/Composer'
import { useDropTarget } from '../../hooks/ui/use-drop-target'

export const ROLES = ['Artist', 'Producer', 'Songwriter', 'Composer', 'Engineer', 'Other'] as const
export const ROLE_OPTIONS = [{ value: 'none', label: 'No role' }, ...ROLES.map((r) => ({ value: r, label: r }))]

/** An artist on its way: in the list at once (`id` is its own until the server's lands). */
export type ArtistDraft = { id: string; name: string; role: string | null; image: string | null }

/** Save closes the dialog at once and hands the list a draft row; the create (and the picture, whose bytes can't be
 *  optimistic) go on behind it. `onSettled` says how it ended: `undefined` when it landed, else why it didn't. */
export function AddArtistDialog({ open, onOpenChange, onDraft, onSettled }: { open: boolean; onOpenChange: (open: boolean) => void; onDraft: (draft: ArtistDraft) => void; onSettled: (id: string, problem?: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [profile, setProfile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

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
  const close = () => onOpenChange(false)
  const save = () => {
    if (!name.trim()) return setProblem('Give the artist a name.')
    const draft = { id: crypto.randomUUID(), name: name.trim(), role: role || null, image: profile ? URL.createObjectURL(profile) : null }
    const file = profile
    onDraft(draft)
    onOpenChange(false)
    setName('')
    setRole('')
    setProfile(null)
    setProblem(null)
    createArtist({ data: { name: draft.name, role: draft.role } })
      .then(({ id }) => (file ? uploadArtistProfile(id, file, () => {}) : undefined))
      .then(() => onSettled(draft.id))
      .catch((error) => onSettled(draft.id, error instanceof Error ? error.message : 'Couldn’t add the artist.'))
  }

  return (
    <Composer
      open={open}
      onClose={close}
      title="Add Artist"
      icon={UserRoundPlus}
      submit={{ label: 'Save Artist', icon: Check, onSubmit: save }}
      className="gap-6 sm:max-w-lg"
    >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              {...drop.props}
              onClick={() => input.current?.click()}
              aria-label={profile ? 'Replace profile image' : 'Add profile image'}
              className={cn('group relative flex size-36 items-center justify-center overflow-hidden rounded-full border border-dashed border-line-strong bg-room-surface text-4xl font-display font-semibold text-accent transition-[border-color,box-shadow] hover:border-accent/60', drop.over && 'border-accent glow-accent')}
            >
              {preview ? <img src={preview} alt="" width={144} height={144} className="size-full object-cover" /> : <ImagePlus size={30} aria-hidden="true" />}
              <span className="absolute inset-0 flex items-center justify-center bg-room-void/65 text-sm text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Add image</span>
            </button>
            <p className="readout text-ink-muted">PNG or JPG · optional</p>
            <input ref={input} type="file" accept={ARTWORK_ACCEPT} hidden onChange={(event) => { pick(event.target.files?.[0]); event.target.value = '' }} />
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink">Name</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Artist name" autoFocus data-initial-focus />
          </label>

          <ComposerRows>
            <ComposerRow icon={BadgeCheck} label="Role">
              <ValueSelect label="Role" value={role || 'none'} onChange={(next) => setRole(next === 'none' ? '' : next)} options={ROLE_OPTIONS} />
            </ComposerRow>
          </ComposerRows>
        </div>

        {problem && <p role="alert" className="text-sm text-feedback-error">{problem}</p>}
    </Composer>
  )
}
