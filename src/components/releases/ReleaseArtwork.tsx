import { Download, FolderOpen, Image as ImageIcon, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { deviceZone, formatMoment, todayIn } from '../../lib/time'
import { Scope } from '../primitives'
import { MetaLine } from '../shared/MetaLine'
import { ImageStage, ViewButton, Viewer, ViewerButton, useFullParam } from '../shared/Viewer'
import { downloadUrl, fileUrl } from '../../lib/files'
import type { VersionRow } from '#/server/releases'
import { ArtworkButton } from './ArtworkButton'
import type { ReleaseData } from './loaders'
import { CanvasSection } from './ReleaseCanvas'
import { formatOf } from './stacks'

/** Artwork & Canvas: the cover large (click it, or drop a PNG or JPG on it; one per release), each track's Canvas
 *  beside it, and the place the release's other material will go. */
export function ReleaseArtwork(data: ReleaseData) {
  const { release, versions } = data
  const [failure, setFailure] = useState<string | null>(null)
  const artwork = versions.find((v) => v.kind === 'artwork' && v.is_current)
  const zone = deviceZone()
  const full = useFullParam()
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(18rem,32rem)_minmax(0,1fr)]">
      <section aria-labelledby="artwork" className="surface-card glass-edge flex flex-col gap-4 rounded-[2rem] p-4" data-meter-host>
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="artwork" className="font-display text-xl font-semibold tracking-tight">Artwork</h2>
          <p className="readout text-ink-muted">PNG or JPG · one per release</p>
        </div>
        <div className="relative">
          <ArtworkButton releaseId={release.id} title={release.title} artworkId={release.artwork_id} onFailure={setFailure} size="panel" />
          {artwork && <ViewButton label="View the artwork" onClick={() => void full.show()} className="absolute top-3 right-3" />}
        </div>
        {failure ? (
          <p role="alert" className="px-1 text-sm text-feedback-error">{failure} Try the cover again.</p>
        ) : artwork ? (
          <MetaLine wrap className="px-1" facts={[formatOf(artwork.filename), `${(artwork.size / 1024 ** 2).toFixed(1)} MB`, `Added ${formatMoment(artwork.created_at, zone, todayIn(zone))}`, artwork.filename]} />
        ) : (
          <p className="px-1 text-sm text-ink-muted">No artwork yet: click the cover or drop a PNG or JPG on it. A new one replaces it.</p>
        )}
      </section>
      {full.open && artwork && <ArtworkViewer release={release} artwork={artwork} onClose={() => void full.close()} />}
      <div className="flex flex-col gap-4">
        <CanvasSection {...data} />
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
          <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          <p className="readout text-ink-muted">{readout}</p>
        </div>
      </div>
      <Scope flat className="w-full opacity-70" />
      <p className="text-[0.9375rem] leading-relaxed text-ink-soft">{children}</p>
    </section>
  )
}

/** The cover full size (`?full`), with what's measured of it: format, size, and its pixels once it's here. */
function ArtworkViewer({ release, artwork, onClose }: { release: ReleaseData['release']; artwork: VersionRow; onClose: () => void }) {
  const [pixels, setPixels] = useState<string | null>(null)
  const zone = deviceZone()
  return (
    <Viewer
      kind="Artwork"
      name={release.title}
      icon={ImageIcon}
      onClose={onClose}
      readout={
        <>
          {formatOf(artwork.filename)}{pixels && ` · ${pixels}`}
          <span className="max-sm:hidden"> · {(artwork.size / 1024 ** 2).toFixed(1)} MB · Added {formatMoment(artwork.created_at, zone, todayIn(zone))}</span>
        </>
      }
      actions={<ViewerButton icon={Download} label="Download" name={`Download ${artwork.filename}`} href={downloadUrl(artwork.id)} download={artwork.filename} />}
    >
      <ImageStage src={fileUrl(artwork.id)} alt={`${release.title}’s artwork`} onMeasured={({ width, height }) => setPixels(`${width}×${height}`)} />
    </Viewer>
  )
}
