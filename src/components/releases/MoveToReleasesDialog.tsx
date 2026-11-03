import { useNavigate, useSearch } from '@tanstack/react-router'
import { Disc3 } from 'lucide-react'
import { useState } from 'react'

import { lanesOf } from '#/server/lanes'
import { moveToReleases, type TrackRow } from '#/server/releases'
import { moveBackWindow, prunedOf } from '#/server/shipping'
import { dayOf, deviceZone, formatDay, todayIn } from '../../lib/time'
import { Button, Input, Tuning } from '../primitives'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../primitives/Dialog'
import { Lane, useTrack } from './Lane'
import type { ReleaseData } from './loaders'
import { releaseLink } from './sections'

type Search = { move?: true }

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
 * Move to Releases: every track's Final lane (the same as on Tracks, so a missing final is dropped, picked or sent right
 * here), the day it went out, and what happens to the rest said plainly before anything moves. What ships is stamped;
 * the other masters and every mix are set aside, erased after the keep window (Settings → Releases) unless it moves
 * back before then, or kept set aside for good when Settings keeps everything.
 */
export function MoveToReleasesDialog(data: ReleaseData) {
  const { release, tracks, versions, keepDays } = data
  const { open, close } = useMoveParam()
  const navigate = useNavigate()
  const zone = deviceZone()
  const today = todayIn(zone)
  const [releasedOn, setReleasedOn] = useState(today)
  const [state, setState] = useState<{ status: 'idle' | 'moving' } | { status: 'failed'; message: string }>({ status: 'idle' })
  const ready = tracks.length > 0 && tracks.every((t) => lanesOf(t.id, versions).final) && releasedOn !== '' && releasedOn <= today
  const pruned = prunedOf(versions).length
  const until = moveBackWindow(Date.now(), keepDays)?.until

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
          <DialogDescription>Stamps exactly what shipped. Each track goes out with its final.</DialogDescription>
        </DialogHeader>

        <ol className="-mx-1 flex flex-col gap-2 overflow-y-auto px-1">
          {tracks.map((track, i) => (
            <TrackFinal key={track.id} data={data} track={track} number={i + 1} title={release.format === 'single' ? release.title : track.title} />
          ))}
        </ol>

        <label className="flex flex-wrap items-center gap-3">
          <span className="readout text-ink-muted">Out on</span>
          <Input type="date" value={releasedOn} max={today} required onChange={(e) => setReleasedOn(e.target.value)} className="h-10 w-auto" />
        </label>

        <p className="surface-row rounded-2xl px-4 py-3 text-sm text-ink-soft">
          Keeps each final, the current instrumental, acapella, stems, Canvas and video, the licenses and the artwork.{' '}
          {pruned === 0 ? (
            'Nothing else is on its tracks, so nothing is set aside.'
          ) : (
            <>
              The other <span data-numeric className="font-medium text-ink">{pruned}</span> {pruned === 1 ? 'version' : 'versions'} (other masters and mixes){' '}
              {pruned === 1 ? 'is' : 'are'} set aside.{' '}
              {keepDays === null || !until
                ? 'Settings keeps everything, so none of it is erased and it can always move back with all of them.'
                : `They're erased after ${keepDays} days. Until ${formatDay(dayOf(until, zone), today)} you can move it back to Upcoming with all of them.`}
            </>
          )}
        </p>

        {state.status === 'failed' && <p role="alert" className="text-[13px] text-feedback-error">{state.message}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => void close()} disabled={state.status === 'moving'}>
            Cancel
          </Button>
          <Button onClick={() => void move()} disabled={!ready || state.status === 'moving'} aria-busy={state.status === 'moving'} className="gap-2">
            {state.status === 'moving' ? <Tuning className="text-current" /> : <Disc3 size={16} aria-hidden="true" />}
            {state.status === 'moving' ? 'Moving' : 'Move to Releases'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One track's Final lane, the same as on Tracks: lit when it has its final; otherwise a slot that takes a drop, a
 *  click or a Pick, and a test's WAV. */
function TrackFinal({ data, track, number, title }: { data: ReleaseData; track: TrackRow; number: number; title: string }) {
  const t = useTrack(data, track)
  return (
    <li>
      <Lane
        t={t}
        lane="final"
        size="compact"
        lit={Boolean(t.lanes.final)}
        heading={
          <span className="flex min-w-0 shrink items-center gap-3">
            <span className="readout w-6 shrink-0 text-accent">{String(number).padStart(2, '0')}</span>
            <span className="truncate text-[15px] font-medium">{title}</span>
          </span>
        }
      />
      {t.picker}
      <p aria-live="polite" className="sr-only">{t.said}</p>
    </li>
  )
}
