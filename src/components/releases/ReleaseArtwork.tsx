import { Clapperboard, FolderOpen, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { dayOf, deviceZone, formatDay, todayIn } from '../../lib/time'
import { Scope } from '../primitives'
import { MetaLine } from '../shared/MetaLine'
import { ArtworkButton } from './ArtworkButton'
import type { ReleaseData } from './loaders'
import { formatOf } from './stacks'

/** Artwork & Canvas: the cover large (click it, or drop a PNG or JPG on it; one per release), and the places
 *  Canvas and the release's other material will go. */
export function ReleaseArtwork({ release, versions }: ReleaseData) {
  const [failure, setFailure] = useState<string | null>(null)
  const artwork = versions.find((v) => v.kind === 'artwork' && v.is_current)
  const zone = deviceZone()
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section aria-labelledby="artwork" className="surface-card glass-edge flex flex-col gap-4 rounded-[2rem] p-4 sm:p-5" data-meter-host>
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="artwork" className="font-display text-lg font-semibold tracking-tight">Artwork</h2>
          <p className="readout text-ink-muted">PNG or JPG · one per release</p>
        </div>
        <ArtworkButton releaseId={release.id} title={release.title} artworkId={release.artwork_id} onFailure={setFailure} size="panel" />
        {failure ? (
          <p role="alert" className="px-1 text-[13px] text-feedback-error">{failure} Try the cover again.</p>
        ) : artwork ? (
          <MetaLine className="px-1" facts={[formatOf(artwork.filename), `${(artwork.size / 1024 ** 2).toFixed(1)} MB`, `Added ${formatDay(dayOf(artwork.created_at, zone), todayIn(zone))}`, artwork.filename]} />
        ) : (
          <p className="px-1 text-[13px] text-ink-muted">No artwork yet: click the cover or drop a PNG or JPG on it. A new one replaces it.</p>
        )}
      </section>
      <div className="flex flex-col gap-4">
        <Later icon={Clapperboard} title="Canvas" readout="Loop · 3–8 s · 9:16">
          The short vertical loop Spotify plays behind a track. Its place is here; uploading it comes next.
        </Later>
        <Later icon={FolderOpen} title="Other material" readout="Press · lyrics · extras">
          Press photos, lyric sheets, a visualiser: whatever else goes out with it. Coming next.
        </Later>
      </div>
    </div>
  )
}

/** A place held for something not built yet: a flat scope, no signal, and a plain line about what's coming. */
function Later({ icon: Icon, title, readout, children }: { icon: LucideIcon; title: string; readout: string; children: string }) {
  return (
    <section className="surface-card flex flex-1 flex-col gap-3 rounded-[2rem] p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full border border-line bg-room-surface text-ink-muted">
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <p className="readout text-ink-muted">{readout}</p>
        </div>
      </div>
      <Scope flat className="w-full opacity-70" />
      <p className="text-sm leading-relaxed text-ink-soft">{children}</p>
    </section>
  )
}
