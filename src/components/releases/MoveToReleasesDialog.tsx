import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { ChevronDown, Disc3, FileAudio } from 'lucide-react'
import { useRef, useState } from 'react'

import { isFinal } from '#/server/files'
import { makeCurrent, moveToReleases, type TrackRow, type VersionRow } from '#/server/releases'
import { finalMasterOf, mastersOf, moveBackWindow, prunedOf } from '#/server/shipping'
import { audioTypeOf } from '#/server/files'
import { readDuration, uploadAudio } from '../../lib/files'
import { dayOf, deviceZone, formatDay, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button, Input, Led, Progress } from '../primitives'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../primitives/Dialog'
import * as DropdownMenu from '../primitives/DropdownMenu'
import type { ReleaseData } from './loaders'
import { releaseLink } from './sections'
import { formatOf } from './stacks'

type Search = { move?: true }

/** What a final can be sent as: the lossless formats. */
const FINAL_ACCEPT = '.wav,.aif,.aiff,.flac'

/** `?move` opens Move to Releases over the release, so Back closes it. */
export function useMoveParam() {
  const navigate = useNavigate()
  return {
    open: useSearch({ strict: false }).move === true,
    show: () => navigate({ to: '.', search: (prev: Search) => ({ ...prev, move: true as const }), resetScroll: false }),
    close: () => navigate({ to: '.', search: ({ move: _, ...rest }: Search) => rest, resetScroll: false }),
  }
}

/**
 * Move to Releases: every track's final master (lossless, picked from its masters newest first; a picked MP3 test asks
 * for its WAV), the day it went out, and what happens to the rest said plainly before anything moves. What ships is
 * stamped; older versions and mixes are pruned, erased after the keep window (Settings → Releases) unless it moves back
 * before then, or kept as they are when Settings keeps everything.
 */
export function MoveToReleasesDialog({ release, tracks, versions, keepDays }: ReleaseData) {
  const { open, close } = useMoveParam()
  const navigate = useNavigate()
  const zone = deviceZone()
  const today = todayIn(zone)
  const [releasedOn, setReleasedOn] = useState(today)
  const [state, setState] = useState<{ status: 'idle' | 'moving' } | { status: 'failed'; message: string }>({ status: 'idle' })
  const ready = tracks.length > 0 && tracks.every((t) => finalMasterOf(t.id, versions)) && releasedOn !== '' && releasedOn <= today
  const pruned = keepDays === null ? 0 : prunedOf(versions).length
  const until = moveBackWindow(Date.now(), keepDays)?.until
  // The first track still without a final opens its picker, so the one decision left is already in front of you.
  const firstMissing = tracks.find((t) => !finalMasterOf(t.id, versions) && mastersOf(t.id, versions).length > 0)?.id

  const move = async () => {
    setState({ status: 'moving' })
    try {
      await moveToReleases({ data: { id: release.id, releasedOn, zone } })
      await navigate({ ...releaseLink('released', release.id, 'tracks'), replace: true })
    } catch (error) {
      setState({ status: 'failed', message: (error instanceof Error && error.message) || 'Couldn’t move it. Nothing changed; try again.' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && state.status !== 'moving' && void close()}>
      <DialogContent className="flex max-h-[92dvh] w-[min(40rem,calc(100vw-2rem))] max-w-none flex-col gap-5">
        <DialogHeader className="gap-1 pr-10">
          <DialogTitle>Move to Releases</DialogTitle>
          <DialogDescription>Stamps exactly what shipped. Each track goes out with its final master.</DialogDescription>
        </DialogHeader>

        <ol className="-mx-1 flex flex-col gap-2 overflow-y-auto px-1">
          {tracks.map((track, i) => (
            <FinalMaster key={track.id} track={track} number={i + 1} versions={versions} title={release.format === 'single' ? release.title : track.title} openFirst={track.id === firstMissing} />
          ))}
        </ol>

        <label className="flex flex-wrap items-center gap-3">
          <span className="readout text-ink-muted">Out on</span>
          <Input type="date" value={releasedOn} max={today} required onChange={(e) => setReleasedOn(e.target.value)} className="h-10 w-auto" />
        </label>

        <p className="surface-row rounded-2xl px-4 py-3 text-sm text-ink-soft">
          Keeps each final master, the current instrumental, acapella, stems, Canvas and video, the licenses and the artwork.{' '}
          {keepDays === null ? (
            'Every older version and mix stays too: Settings keeps everything after a release.'
          ) : pruned > 0 && until ? (
            <>
              The other <span data-numeric className="font-medium text-ink">{pruned}</span> {pruned === 1 ? 'version' : 'versions'} (older bounces and mixes) are
              erased after {keepDays} days. Until {formatDay(dayOf(until, zone), today)} you can move it back to Upcoming with all of them.
            </>
          ) : (
            'Nothing else is on its tracks, so nothing is erased.'
          )}
        </p>

        {state.status === 'failed' && <p role="alert" className="text-[13px] text-feedback-error">{state.message}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => void close()} disabled={state.status === 'moving'}>
            Cancel
          </Button>
          <Button onClick={() => void move()} disabled={!ready || state.status === 'moving'} aria-busy={state.status === 'moving'} className="gap-2">
            <Disc3 size={16} aria-hidden="true" />
            {state.status === 'moving' ? 'Moving…' : 'Move to Releases'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One track's final master: lit when its current master is lossless, otherwise a picker of its masters, newest first.
 *  Picking a final makes it current; picking a test asks for its WAV, which lands on top as the final. */
function FinalMaster({ track, number, versions, title, openFirst }: { track: TrackRow; number: number; versions: VersionRow[]; title: string; openFirst: boolean }) {
  const router = useRouter()
  const zone = deviceZone()
  const masters = mastersOf(track.id, versions)
  const final = finalMasterOf(track.id, versions)
  const current = masters.find((v) => v.is_current)
  const [wavOf, setWavOf] = useState<VersionRow | null>(null)
  const [state, setState] = useState<{ status: 'idle' | 'picking' } | { status: 'sending'; sent: number } | { status: 'failed'; message: string }>({ status: 'idle' })
  const input = useRef<HTMLInputElement>(null)
  const busy = state.status === 'picking' || state.status === 'sending'
  const asking = !final && (wavOf ?? (masters.length === 0 ? null : current && !isFinal(current.content_type) ? current : null))

  const pick = async (id: string) => {
    const version = masters.find((v) => v.id === id)!
    if (!isFinal(version.content_type)) return (setWavOf(version), setState({ status: 'idle' }))
    setWavOf(null)
    setState({ status: 'picking' })
    try {
      await makeCurrent({ data: { versionId: id } })
      await router.invalidate()
      setState({ status: 'idle' })
    } catch (error) {
      setState({ status: 'failed', message: (error instanceof Error && error.message) || 'Couldn’t pick it. Try again.' })
    }
  }

  const send = async (file: File | undefined) => {
    if (!file) return
    const contentType = audioTypeOf(file.name, file.type)
    if (!contentType || !isFinal(contentType)) return setState({ status: 'failed', message: 'A final is a WAV, AIFF or FLAC.' })
    setState({ status: 'sending', sent: 0 })
    try {
      const note = asking ? `Final of v${asking.number}` : undefined
      const { id } = await uploadAudio({ trackId: track.id, kind: 'master', file, contentType, durationMs: await readDuration(file), note }, (sent) => setState({ status: 'sending', sent }))
      await makeCurrent({ data: { versionId: id } })
      await router.invalidate()
      setWavOf(null)
      setState({ status: 'idle' })
    } catch (error) {
      setState({ status: 'failed', message: (error instanceof Error && error.message) || 'Couldn’t send it. Try again.' })
    }
  }

  return (
    <li className={cn('surface-item flex flex-col gap-2.5 rounded-2xl p-3', final ? 'ring-1 ring-accent/30' : 'ring-1 ring-line')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="readout w-6 shrink-0 text-accent">{String(number).padStart(2, '0')}</span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{title}</span>
        {masters.length > 0 && (
          <DropdownMenu.Root defaultOpen={openFirst}>
            <DropdownMenu.Trigger asChild disabled={busy}>
              <Button variant={final ? 'secondary' : 'primary'} size="sm" className="gap-1.5" aria-label={final ? `Final master: v${final.number}. Change it` : `Pick the final master of ${title}`}>
                {final ? (
                  <>
                    <Led />
                    <span className="readout">Master v{final.number} · {formatOf(final.filename)}</span>
                  </>
                ) : (
                  'Pick the final master'
                )}
                <ChevronDown size={13} aria-hidden="true" className="opacity-70" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className="min-w-[16rem]">
              <p className="readout px-3 pt-2 pb-1 text-ink-muted">Masters · newest first</p>
              <DropdownMenu.RadioGroup value={final?.id ?? wavOf?.id ?? ''} onValueChange={(id) => void pick(id)}>
                {masters.map((v) => (
                  <DropdownMenu.RadioItem key={v.id} value={v.id} className="gap-2">
                    <span className="readout w-8 text-accent">v{v.number}</span>
                    <span className="flex-1">{formatOf(v.filename)} · {isFinal(v.content_type) ? 'final' : 'test'}</span>
                    <span className="text-xs text-ink-muted">{formatDay(dayOf(v.created_at, zone), todayIn(zone))}</span>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </div>
      {!final && (
        <div className="flex flex-wrap items-center gap-3 pl-9">
          <p className="min-w-0 flex-1 text-sm text-ink-soft">
            {masters.length === 0
              ? 'No master yet. Send its final WAV.'
              : asking
                ? `v${asking.number} is a test (${formatOf(asking.filename)}). Send its WAV, AIFF or FLAC as the final.`
                : 'Pick which master went out.'}
          </p>
          {(masters.length === 0 || asking) && (
            <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={busy} className="gap-1.5">
              <FileAudio size={14} aria-hidden="true" />
              Send the WAV
            </Button>
          )}
        </div>
      )}
      {state.status === 'sending' && (
        <div className="flex items-center gap-3 pl-9">
          <Progress value={state.sent} label={`Sending the final master of ${title}`} className="h-1.5 flex-1" />
          <span data-numeric className="readout text-ink-muted">{state.sent < 1 ? `${Math.round(state.sent * 100)}%` : 'Storing'}</span>
        </div>
      )}
      {state.status === 'failed' && <p role="alert" className="pl-9 text-[13px] text-feedback-error">{state.message}</p>}
      <input ref={input} type="file" accept={FINAL_ACCEPT} hidden onChange={(e) => (void send(e.target.files?.[0]), (e.target.value = ''))} />
    </li>
  )
}
