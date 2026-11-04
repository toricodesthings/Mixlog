import { RotateCcw, X } from 'lucide-react'

import { cn } from '../../lib/utils'
import { Button, Led, Progress, Tip, Transfer, Tuning } from '../primitives'
import { sentOf, timeLeft } from './progress'
import type { Pending, Phase } from './use-lane-upload'

/** A file's bar and what it says: "12.4 of 48.0 MB · 20 s left", then, once it's all sent, MEASURING while the meter
 *  is still reading it and STORING while it's written. */
export function UploadProgress({ name, size, sent, startedAt, phase }: { name: string; size: number; sent: number; startedAt?: number; phase?: Phase }) {
  const left = startedAt ? timeLeft(sent * size, size, (performance.now() - startedAt) / 1000) : null
  const after = phase ?? (sent >= 1 ? 'storing' : undefined)
  return (
    <span className="flex flex-col gap-1 pt-1">
      <Progress value={sent} label={`Sending ${name}`} valueText={sentOf(sent, size)} />
      {after ? (
        <span className="readout flex items-center gap-2 text-ink-muted" role="status">
          <Tuning />
          {after === 'measuring' ? 'Measuring' : 'Storing'}
        </span>
      ) : (
        <span data-numeric className="truncate text-[12.5px] text-ink-muted">
          {[sentOf(sent, size), left].filter(Boolean).join(' · ')}
        </span>
      )}
    </span>
  )
}

/** A file on its way into a lane, where its version will land: the upload ring (a light while it waits its turn), its
 *  name, its bar. A failure keeps the row
 *  with its reason and Try again; nothing half-sent is kept. */
export function UploadRow({ pending, onRetry, onDismiss, className }: { pending: Pending; onRetry: () => void; onDismiss: () => void; className?: string }) {
  const { file, state, sent, startedAt, phase, error } = pending
  return (
    <li className={cn('surface-item flex min-h-14 items-center gap-3 rounded-2xl py-2 pr-1 pl-4', className)}>
      <span className="flex size-5 shrink-0 items-center justify-center">
        {state === 'sending' ? <Transfer direction="up" value={sent} className="size-5" /> : <Led lit={state !== 'failed'} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-medium text-ink">{file.name}</span>
        {state === 'failed' ? (
          <span role="alert" className="text-[13px] text-feedback-error">{error}</span>
        ) : state === 'queued' ? (
          <span className="readout text-ink-muted">Waiting its turn</span>
        ) : (
          <UploadProgress name={file.name} size={file.size} sent={sent} startedAt={startedAt} phase={phase} />
        )}
      </span>
      {state === 'failed' && (
        <>
          <Button variant="secondary" size="sm" onClick={onRetry} className="gap-1.5">
            <RotateCcw size={14} aria-hidden="true" />
            Try again
          </Button>
          <Tip label="Leave it out">
            <Button variant="ghost" size="icon" onClick={onDismiss} aria-label={`Leave out ${file.name}`}>
              <X size={15} aria-hidden="true" />
            </Button>
          </Tip>
        </>
      )}
    </li>
  )
}
