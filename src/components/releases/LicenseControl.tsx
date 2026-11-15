import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { Download, FileBadge, FilePlus2 } from 'lucide-react'
import { Suspense, lazy, useRef, useState } from 'react'

import { LICENSE_ACCEPT, licenseProblem, licenseTypeOf } from '#/server/files'
import type { TrackRow, VersionRow } from '#/server/releases'
import { useDropTarget } from '../../hooks/ui/use-drop-target'
import { downloadUrl, uploadLicense } from '../../lib/files'
import { deviceZone, formatMoment, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button, Transfer } from '../primitives'
import { SegmentedControl } from '../primitives/SegmentedControl'
import { Viewer, ViewerButton } from '../shared/Viewer'
import { sizeOf } from '../uploads/progress'
import { formatOf, licensesOf } from './stacks'

// pdf.js and the Word reader are big: they load the first time a license opens, never with the page.
const LicenseDocument = lazy(() => import('./LicenseDocument'))

type Search = { license?: string }

/** `?license=<versionId>` opens that license over Details, so a refresh or a pasted link lands on it. */
function useLicenseParam() {
  const navigate = useNavigate()
  const open = useSearch({ strict: false }).license ?? null
  return {
    open,
    /** Opening adds a history entry; switching versions replaces it, so Back closes the license. */
    show: (id: string) => navigate({ to: '.', search: (prev: Search) => ({ ...prev, license: id }), replace: open !== null, resetScroll: false }),
    close: () => navigate({ to: '.', search: ({ license: _, ...rest }: Search) => rest, resetScroll: false }),
  }
}

/** Sends a picked or dropped file as the track's next license. `onStored` gets the new version's ID. */
function useLicenseUpload(trackId: string, onStored: (id: string) => void) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<{ status: 'idle' } | { status: 'sending'; sent: number } | { status: 'failed'; message: string }>({ status: 'idle' })
  const sending = state.status === 'sending'

  const send = async (file: File | undefined) => {
    if (!file) return
    const problem = licenseProblem(licenseTypeOf(file.name), file.size)
    if (problem) return setState({ status: 'failed', message: problem })
    setState({ status: 'sending', sent: 0 })
    try {
      const { id } = await uploadLicense(trackId, file, (sent) => setState({ status: 'sending', sent }))
      await router.invalidate()
      setState({ status: 'idle' })
      onStored(id)
    } catch (error) {
      setState({ status: 'failed', message: error instanceof Error ? error.message : 'Couldn’t add the license.' })
    }
  }
  const { over, props: drop } = useDropTarget({
    onFiles: (files) => (files.length > 1 ? setState({ status: 'failed', message: 'One license at a time: drop a single PDF or Word document.' }) : void send(files[0])),
    enabled: !sending,
  })
  const picker = (
    <input ref={input} type="file" accept={LICENSE_ACCEPT} hidden onChange={(e) => (void send(e.target.files?.[0]), (e.target.value = ''))} />
  )
  return { state, sending, over, drop, picker, pick: () => input.current?.click() }
}

/** A track's license in Details: Add license (click, or drop a PDF or Word document on it) until there is one, then
 *  the license itself, which opens to read. A new version goes on top from there; every earlier one is kept. */
export function LicenseControl({ trackId, licenses }: { trackId: string; licenses: VersionRow[] }) {
  const { show } = useLicenseParam()
  const upload = useLicenseUpload(trackId, show)
  const top = licenses[0]
  return (
    <span className="flex flex-wrap items-center gap-2">
      {top ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => void show(top.id)} {...upload.drop} className={cn('gap-1.5', upload.over && 'ring-2 ring-accent glow-accent')}>
          <FileBadge size={14} aria-hidden="true" />
          License
          <span className="readout text-ink-muted">v{top.number} · {formatOf(top.filename)}</span>
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={upload.pick}
          disabled={upload.sending}
          aria-busy={upload.sending}
          {...upload.drop}
          className={cn('gap-1.5', upload.over && 'ring-2 ring-accent glow-accent')}
        >
          <FilePlus2 size={14} aria-hidden="true" />
          {upload.sending ? 'Sending' : 'Add license'}
        </Button>
      )}
      {upload.picker}
      <UploadState state={upload.state} />
    </span>
  )
}

function UploadState({ state }: { state: ReturnType<typeof useLicenseUpload>['state'] }) {
  if (state.status === 'sending')
    return (
      <span className="flex items-center gap-2">
        <Transfer direction="up" value={state.sent} label="Sending the license" className="text-lg" />
        <span data-numeric className="readout w-14 text-ink-muted">{state.sent < 1 ? `${Math.round(state.sent * 100)}%` : 'Storing'}</span>
      </span>
    )
  if (state.status === 'failed') return <span role="alert" className="text-sm text-feedback-error">{state.message}</span>
  return null
}

/** The open license (`?license=`), read in place: a PDF page by page, a Word document as text. Its earlier versions
 *  are a switch away, Download saves it as uploaded, and New version stacks one on top. */
export function LicenseDialog({ tracks, versions }: { tracks: TrackRow[]; versions: VersionRow[] }) {
  const { open, show, close } = useLicenseParam()
  const version = versions.find((v) => v.id === open && v.kind === 'license')
  return version ? <LicenseSheet version={version} track={tracks.find((t) => t.id === version.track_id)} stack={licensesOf(version.track_id!, versions)} show={show} close={() => void close()} /> : null
}

/** The license full size (`Viewer`): which version on top, the license below on its desk. */
function LicenseSheet({ version, track, stack, show, close }: { version: VersionRow; track?: TrackRow; stack: VersionRow[]; show: (id: string) => void; close: () => void }) {
  const upload = useLicenseUpload(version.track_id!, show)
  const zone = deviceZone()
  return (
    <Viewer
      kind="License"
      name={track?.title}
      icon={FileBadge}
      onClose={close}
      readout={
        <>
          v{version.number} · {formatOf(version.filename)} · {sizeOf(version.size)}
          <span className="max-sm:hidden"> · Added {formatMoment(version.created_at, zone, todayIn(zone))}</span>
        </>
      }
      band={stack.length > 1 && <SegmentedControl ariaLabel="License version" size="sm" value={version.id} onChange={show} options={stack.map((v) => ({ value: v.id, label: `v${v.number}` }))} />}
      status={
        <>
          <UploadState state={upload.state} />
          {upload.picker}
        </>
      }
      actions={
        <>
          {/* Takes a dropped PDF or Word document too. */}
          <ViewerButton icon={FilePlus2} label="New version" variant="ghost" onClick={upload.pick} disabled={upload.sending} {...upload.drop} className={cn(upload.over && 'ring-2 ring-accent')} />
          <ViewerButton icon={Download} label="Download" name={`Download ${version.filename}`} href={downloadUrl(version.id)} download={version.filename} />
        </>
      }
    >
      <Suspense fallback={<Reading arrived={0} />}>
        <LicenseDocument key={version.id} version={version} />
      </Suspense>
    </Viewer>
  )
}

/** While the license opens: its bytes coming in (`arrived`, the share here so far), then held full while the first
 *  page draws. One look from the click to the page, so opening never flickers between loaders. */
export function Reading({ arrived, className }: { arrived: number; className?: string }) {
  return (
    <div role="status" className={cn('flex size-full flex-col items-center justify-center gap-4 p-8 text-center', className)}>
      <Transfer direction="down" value={arrived} className="text-5xl" />
      <p className="readout text-ink-muted">
        Reading the license
        <span aria-hidden="true" data-numeric> · {Math.round(arrived * 100)}%</span>
      </p>
    </div>
  )
}
