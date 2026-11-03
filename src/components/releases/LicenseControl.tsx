import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { Download, FileBadge, FilePlus2 } from 'lucide-react'
import { Suspense, lazy, useRef, useState } from 'react'

import { LICENSE_ACCEPT, licenseProblem, licenseTypeOf } from '#/server/files'
import type { TrackRow, VersionRow } from '#/server/releases'
import { downloadUrl, uploadLicense } from '../../lib/files'
import { dayOf, deviceZone, formatDay, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button, Progress, Scope } from '../primitives'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../primitives/Dialog'
import { SegmentedControl } from '../primitives/SegmentedControl'
import { formatOf, licensesOf, sizeOf } from './stacks'
import { useCoverDrop } from './use-cover-drop'

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

const dropProblem = (files: FileList) =>
  files.length > 1 ? 'One license at a time: drop a single PDF or Word document.' : licenseProblem(licenseTypeOf(files[0]?.name ?? ''), files[0]?.size ?? 0)

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
  const { over, props: drop } = useCoverDrop((file) => void send(file), (message) => setState({ status: 'failed', message }), !sending, dropProblem)
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
      <span className="flex min-w-28 items-center gap-2">
        <Progress value={state.sent} label="Sending the license" className="h-1.5 flex-1" />
        <span data-numeric className="readout text-ink-muted">{state.sent < 1 ? `${Math.round(state.sent * 100)}%` : 'Storing'}</span>
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
  return (
    <Dialog open={Boolean(version)} onOpenChange={(next) => !next && void close()}>
      {version && <LicenseSheet version={version} track={tracks.find((t) => t.id === version.track_id)} stack={licensesOf(version.track_id!, versions)} show={show} />}
    </Dialog>
  )
}

function LicenseSheet({ version, track, stack, show }: { version: VersionRow; track?: TrackRow; stack: VersionRow[]; show: (id: string) => void }) {
  const upload = useLicenseUpload(version.track_id!, show)
  const zone = deviceZone()
  return (
    <DialogContent className="flex max-h-[92dvh] w-[min(56rem,calc(100vw-2rem))] max-w-none flex-col gap-4">
      <DialogHeader className="gap-1 pr-10">
        <DialogTitle>License{track ? ` · ${track.title}` : ''}</DialogTitle>
        <p className="readout text-ink-muted">
          v{version.number} · {formatOf(version.filename)} · {sizeOf(version.size)} · Added {formatDay(dayOf(version.created_at, zone), todayIn(zone))}
        </p>
      </DialogHeader>
      {stack.length > 1 && (
        <SegmentedControl ariaLabel="License version" size="sm" value={version.id} onChange={show} options={stack.map((v) => ({ value: v.id, label: `v${v.number}` }))} />
      )}
      <div className="surface-item min-h-[50dvh] flex-1 overflow-y-auto overscroll-contain rounded-2xl">
        <Suspense fallback={<Reading />}>
          <LicenseDocument key={version.id} version={version} />
        </Suspense>
      </div>
      <DialogFooter className="flex-wrap items-center gap-2" {...upload.drop}>
        <span className="mr-auto min-w-0 truncate text-sm text-ink-muted">{version.filename}</span>
        <UploadState state={upload.state} />
        <Button type="button" variant="ghost" onClick={upload.pick} disabled={upload.sending} className={cn('gap-1.5', upload.over && 'ring-2 ring-accent')}>
          <FilePlus2 size={16} aria-hidden="true" />
          New version
        </Button>
        <Button asChild variant="secondary" className="gap-1.5">
          <a href={downloadUrl(version.id)} download={version.filename}>
            <Download size={16} aria-hidden="true" />
            Download
          </a>
        </Button>
        {upload.picker}
      </DialogFooter>
    </DialogContent>
  )
}

/** While the document loads: the scope tracing in, and the words. */
export function Reading({ children = 'Reading the license' }: { children?: string }) {
  return (
    <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center gap-4 p-8 text-center">
      <Scope />
      <p className="readout text-ink-muted" aria-live="polite">{children}</p>
    </div>
  )
}
