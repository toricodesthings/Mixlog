import { LogOut, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getProfile, saveDisplayName } from '#/server/settings'
import { Button, Input, Led, Skeleton, toast } from '../../primitives'
import { ArtistAvatar } from '../../artists/ArtistAvatar'
import { Composer } from '../../shared/Composer'
import { SettingsList, SettingsRow, SettingsSection } from '../SettingsLayout'

/** Cloudflare Access ends the session here; Mixlog keeps none of its own. */
export const SIGN_OUT_URL = '/cdn-cgi/access/logout'

type Profile = Awaited<ReturnType<typeof getProfile>>

/** The banner's waveform: the horizon, drawn as capsules rising from the card's floor, fading out to both sides. */
const WAVE = Array.from({ length: 56 }, (_, i) => 16 + 70 * Math.abs(Math.sin(i * 0.62) * Math.cos(i * 0.21 + 1)))

/** The name shown: the one they gave, else their default artist's, else the start of their email. */
const nameOf = ({ name, face, email }: Profile) => name ?? face?.name ?? email?.split('@')[0] ?? 'You'

/** Who's signed in, and the one door in: Cloudflare Access. Mixlog has no accounts, passwords or sessions of its own,
 *  so the email is Access's to say, the name is the only thing typed here, and the face is the default artist's. */
export function AccountTab() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProblem('Couldn’t read your profile. Close Settings and try again.'))
  }, [])

  /** The name changes at once and the server catches up behind it; a failure puts it back and says why. */
  const rename = () => {
    if (!profile) return
    const before = profile
    const next = draft.trim()
    setProfile({ ...profile, name: next || null })
    setRenaming(false)
    saveDisplayName({ data: next }).catch((error) => {
      setProfile(before)
      toast.error('Couldn’t save the name', { description: error instanceof Error ? error.message : 'Nothing changed; try again.' })
    })
  }

  const shown = profile ? nameOf(profile) : ''

  return (
    <div className="flex flex-col gap-10">
      <h2 className="font-display text-2xl font-semibold text-ink">Profile &amp; Security</h2>
      {problem && (
        <p role="alert" className="text-sm text-feedback-error">
          {problem}
        </p>
      )}

      <div className="surface-card glass-edge overflow-hidden rounded-3xl">
        <div className="relative isolate h-32 border-b border-line">
          <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden bg-room-surface">
            <div className="absolute -top-24 -right-24 size-96 rounded-full bg-accent opacity-[0.14] blur-[80px]" />
            <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent-tertiary opacity-[0.12] blur-[80px]" />
            <div className="absolute inset-x-0 bottom-0 flex h-full items-end justify-between gap-1 px-4 [mask-image:linear-gradient(90deg,transparent,black_30%,black_70%,transparent)]">
              {WAVE.map((height, i) => (
                <span key={i} style={{ height: `${height}%` }} className={i % 5 === 2 ? 'w-1 flex-1 rounded-full bg-accent-tertiary/30' : 'w-1 flex-1 rounded-full bg-accent/25'} />
              ))}
            </div>
          </div>
          <div className="absolute -bottom-10 left-6 z-10 rounded-full border-4 border-room-surface bg-room-base">
            {profile ? (
              <ArtistAvatar id={profile.face?.id ?? shown} name={shown} src={profile.face?.profile_image_url ?? null} size="pick" className="size-20 text-3xl shadow-none" />
            ) : (
              <Skeleton className="size-20 rounded-full" />
            )}
          </div>
        </div>
        <div className="relative px-6 pt-14 pb-6">
          {/* The avatar's 4px ring melts into the card, so the name lines up with the circle you see (24px + 4px). */}
          <h3 className="pl-1 font-display text-xl font-semibold break-words text-ink">{profile ? shown : <Skeleton className="h-7 w-40" />}</h3>

          <div className="mt-8 flex flex-col gap-4 rounded-xl border border-line bg-black/20 p-4">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <div className="min-w-0 break-words">
                <p className="readout mb-1 text-ink-muted">Display name</p>
                <p className="text-sm text-ink">{profile ? shown : '…'}</p>
              </div>
              <Button variant="ghost" size="sm" disabled={!profile} onClick={() => (setDraft(profile?.name ?? ''), setRenaming(true))}>
                Edit
              </Button>
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3 border-t border-line pt-4">
              <div className="min-w-0 break-words">
                <p className="readout mb-1 text-ink-muted">Email</p>
                <p className="text-sm text-ink">{profile ? (profile.email ?? 'Not signed in through Access') : '…'}</p>
              </div>
              <span className="readout shrink-0 text-ink-muted">Access</span>
            </div>
          </div>
        </div>
      </div>

      <SettingsSection title="Sign-in" className="mb-0">
        <SettingsList>
          <SettingsRow title="Cloudflare Access" description="The only door to your Mixlog. It never sees a password, and keeps no session or account of its own.">
            <span className="flex items-center gap-2 text-sm text-ink-soft">
              <Led /> {profile?.email ? 'Signed in' : 'Open on this machine'}
            </span>
          </SettingsRow>
          <SettingsRow title="Sign out" description="Ends the session on this device." inline>
            <Button asChild variant="secondary" size="md">
              <a href={SIGN_OUT_URL} className="gap-2">
                <LogOut size={14} aria-hidden="true" /> Sign out
              </a>
            </Button>
          </SettingsRow>
        </SettingsList>
      </SettingsSection>

      <Composer
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Display name"
        icon={ShieldCheck}
        description="Shown here only. Blank goes back to your default artist’s name."
        submit={{ label: 'Save', onSubmit: rename, disabled: !profile || draft.trim() === (profile.name ?? '') }}
      >
        <Input value={draft} maxLength={100} autoFocus aria-label="Display name" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), rename())} />
      </Composer>
    </div>
  )
}
