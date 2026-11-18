import { Link } from '@tanstack/react-router'
import { ArrowUpRight, ChevronDown, CircleAlert, Code2, ScrollText, Scale, Tag, EyeOff, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { siGithub } from 'simple-icons'

import { cn } from '../../../lib/utils'
import { BrandMark, Button } from '../../primitives'
import { SettingsSection } from '../SettingsLayout'

const SOURCE_URL = 'https://github.com/toricodesthings/Mixlog'

const PILL = 'inline-flex items-center gap-1.5 rounded-full border border-line-light bg-white/[0.04] px-3 py-1 readout text-ink-soft'

function Pill({ icon: Icon, accent, children }: { icon: LucideIcon; accent?: boolean; children: ReactNode }) {
  return (
    <span className={cn(PILL, accent && 'border-accent/25 bg-accent/10 text-accent')}>
      <Icon size={12} aria-hidden="true" />
      {children}
    </span>
  )
}

/** One of the four equal links under the description: an icon over its name, the same box each. */
const LINK_CARD = 'min-h-20 flex-col gap-2 px-3 text-center'

/** `meter`: shown over the public meter, whose host serves no other page, so no changelog link. */
export function AboutTab({ meter = false }: { meter?: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <span data-meter-host className="glass-edge glow-accent relative flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-line-light bg-room-surface">
          <BrandMark live className="h-12 w-12" />
        </span>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">About Mixlog</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">Every version, one place, any room.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Pill icon={Tag} accent>
            v{__APP_VERSION__}
          </Pill>
          <Pill icon={Code2}>Open source</Pill>
          <Pill icon={EyeOff}>No telemetry</Pill>
        </div>
      </div>

      <SettingsSection title="Product" className="mb-0">
        <div className="flex flex-col gap-3 rounded-[1.4rem] border border-white/[0.04] bg-white/[0.02] p-5 text-sm leading-6 text-ink-soft">
          <p className={expanded ? undefined : 'line-clamp-3'}>
            Hey, this is Tori! I made Mixlog because I was tired of digging through chats and folders called final_FINAL_v3 to find the right bounce. I wanted one place for my music in progress: every bounce, master, artwork, Canvas and video, versioned and playable anywhere, so I can open it, tap a track, and just hear the right version.
          </p>
          {/* Opens by sliding its height, never a jump; reduced motion changes it in place. */}
          <div className={cn('-mt-3 grid transition-[grid-template-rows] duration-(--duration-normal) ease-(--ease-out-expo)', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')} aria-hidden={!expanded}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col gap-3 pt-3">
              <p>
                I built it open source so you can fork it: your copy runs on your own Cloudflare account, behind your own sign-in, with your files in a private bucket nothing else can reach. I made sure it never overwrites a bounce, and I don’t collect any analytics.
              </p>
              <p>
                Found a bug, or have an idea? I’d love to hear it: the repository is on GitHub. If Mixlog is useful to you, the best way to support me is to star the repository and show it to another artist. Thanks for being here!
              </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1 self-start rounded-md text-xs font-semibold text-accent transition-colors hover:text-accent/80 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-hidden"
          >
            {expanded ? 'Show less' : 'Show more'}
            <ChevronDown size={14} aria-hidden="true" className={cn('transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>

        <div className={cn('grid grid-cols-2 gap-3', meter ? 'sm:grid-cols-3' : 'sm:grid-cols-4')}>
          <Button asChild variant="secondary" className={LINK_CARD}>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              <svg aria-hidden="true" viewBox="0 0 24 24" width={20} height={20} className="shrink-0 fill-accent">
                <path d={siGithub.path} />
              </svg>
              <span className="inline-flex items-center gap-1">
                Repository <ArrowUpRight size={13} aria-hidden="true" />
              </span>
            </a>
          </Button>
          {!meter && (
          <Button asChild variant="secondary" className={LINK_CARD}>
            <Link to="/changelog">
              <ScrollText size={20} className="text-accent" aria-hidden="true" />
              Changelog
            </Link>
          </Button>
          )}
          <Button asChild variant="secondary" className={LINK_CARD}>
            <a href={`${SOURCE_URL}/issues`} target="_blank" rel="noreferrer">
              <CircleAlert size={20} className="text-accent" aria-hidden="true" />
              <span className="inline-flex items-center gap-1">
                Report an issue <ArrowUpRight size={13} aria-hidden="true" />
              </span>
            </a>
          </Button>
          <Button asChild variant="secondary" className={LINK_CARD}>
            <a href={`${SOURCE_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
              <Scale size={20} className="text-accent" aria-hidden="true" />
              <span className="inline-flex items-center gap-1">
                AGPL-3.0 <ArrowUpRight size={13} aria-hidden="true" />
              </span>
            </a>
          </Button>
        </div>
      </SettingsSection>
    </div>
  )
}
