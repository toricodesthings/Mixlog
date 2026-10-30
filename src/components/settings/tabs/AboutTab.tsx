import { AudioWaveform, ExternalLink, LogOut } from 'lucide-react'

import { Button } from '../../primitives'
import { SettingsList, SettingsRow, SettingsSection } from '../SettingsLayout'

/** Cloudflare Access ends the session here; Mixlog keeps none of its own. */
export const SIGN_OUT_URL = '/cdn-cgi/access/logout'
const SOURCE_URL = 'https://github.com/toricodesthings/Mixlog'

export function AboutTab() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="glow-accent flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-line-light bg-room-surface text-accent">
          <AudioWaveform size={36} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">About Mixlog</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">Every version, one place, any room.</p>
        </div>
        <span data-numeric className="rounded-full border border-line-light px-3 py-1 text-xs text-ink-soft">
          v{__APP_VERSION__}
        </span>
      </div>

      <SettingsSection title="Your Mixlog">
        <SettingsList>
          <SettingsRow title="Open source" description="AGPL-3.0. Read exactly how your music is stored, or fork your own." inline>
            <Button asChild variant="secondary" size="md">
              <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="gap-2">
                Source <ExternalLink size={14} aria-hidden="true" />
              </a>
            </Button>
          </SettingsRow>
          <SettingsRow title="Signed in with Cloudflare Access" description="Mixlog never sees a password. Signing out ends the session on this device." inline>
            <Button asChild variant="secondary" size="md">
              <a href={SIGN_OUT_URL} className="gap-2">
                <LogOut size={14} aria-hidden="true" /> Sign out
              </a>
            </Button>
          </SettingsRow>
        </SettingsList>
      </SettingsSection>
    </div>
  )
}
