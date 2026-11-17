import { useRouter } from '@tanstack/react-router'
import { Activity, X } from 'lucide-react'
import { useState, type Ref } from 'react'

import { deltaOf, isMeasured, previousOf, type Measured } from '#/server/loudness'
import type { VersionRow as Version } from '#/server/releases'
import { deviceZone } from '../../lib/time'
import { cn } from '../../lib/utils'
import { clock } from '../player/controls'
import { LoudnessWave } from '../player/LoudnessWave'
import { usePlayer } from '../player/Player'
import { Button, Scope, Tip, Transfer, Tuning } from '../primitives'
import * as ScrollArea from '../primitives/ScrollArea'
import type { TrackState } from '../releases/Lane'

/** What the bridge reads from its track: a row's `TrackState`, or the wide panel's own. */
export type BridgeTrack = Pick<TrackState, 'data' | 'release' | 'track' | 'section'>
import { nameOf, playableOf, versionLabel } from '../releases/stacks'
import { sizeOf } from '../uploads/progress'
import { Reading } from './Readings'
import { measureAndSave } from './save'

/**
 * A version's meters, read from the whole song: its loudness over time (a playhead too), then its `Reading`. The same
 * bridge unfolds under a row or fills the wide panel.
 */
export function MeterBridge({ t, version, headingRef, onClose, docked }: {
  t: BridgeTrack
  version: Version
  headingRef?: Ref<HTMLHeadingElement>
  onClose?: () => void
  /** In the wide panel: the header is level with the page's, and the readings scroll under it. */
  docked?: boolean
}) {
  const label = versionLabel(version, t.section)
  const a = version.analysis
  const body = isMeasured(a) ? <Measurements t={t} version={version} a={a} /> : a ? <Unread /> : <Unmeasured version={version} />
  return (
    <section aria-label={`Meters, ${label}`} className={cn('meter-bridge @container flex flex-col', docked ? 'h-full' : 'gap-4')}>
      <header className={cn('flex items-center gap-3', docked && 'layer-shell-header signal-rule h-(--dock-header-h,var(--shell-header-h)) shrink-0 px-5')}>
        <span data-meters-jack className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Activity size={18} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 ref={headingRef} tabIndex={-1} className="truncate font-display text-xl font-semibold leading-tight tracking-tight text-ink outline-hidden">{nameOf(version)}</h4>
          <p className="readout truncate text-ink-muted">{label}{isMeasured(a) ? ` · ${clock(a.ms / 1000)}` : ''}</p>
        </div>
        {onClose && (
          <Tip label="Close" side="left">
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close the meters" className="shrink-0 rounded-full text-ink-muted">
              <X size={18} aria-hidden="true" />
            </Button>
          </Tip>
        )}
      </header>
      {docked ? (
        <ScrollArea.Root className="flex-1">
          <ScrollArea.Viewport>
            <div className="flex flex-col gap-5 p-5 pb-8">{body}</div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className="mr-1">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ) : (
        body
      )}
    </section>
  )
}

function Measurements({ t, version, a }: { t: BridgeTrack; version: Version; a: Measured }) {
  const player = usePlayer()
  const item = playableOf(t.release, t.track, version, deviceZone())
  const previous = t.section === 'upcoming' ? previousOf(version, t.data.versions) : null
  const by = previous ? deltaOf(a, previous.analysis) : null
  return (
    <>
      {item.wave && <LoudnessWave item={item} wave={item.wave} className="pt-2" />}
      <Reading
        a={a}
        name={version.filename}
        deltas={by && previous && { by, since: versionLabel(previous, t.section), number: previous.number }}
        onLowPhase={a.correlation ? () => player.play(item, { at: a.correlation!.minAtMs / a.ms }) : undefined}
      />
    </>
  )
}

function Unread() {
  return (
    <div className="flex flex-col items-start gap-2">
      <Scope flat className="h-8 w-40" />
      <Tip label="Mixlog can’t read this format yet." side="bottom" toggle>
        <button type="button" className="readout rounded text-ink-muted">No reading</button>
      </Tip>
    </div>
  )
}

/** Not measured yet (before 1.2.0, or its reading never landed): Measure reads it here; otherwise tonight's run does. */
function Unmeasured({ version }: { version: Version }) {
  const router = useRouter()
  const [state, setState] = useState<{ step: 'idle' | 'down' | 'reading' | 'failed'; share: number }>({ step: 'idle', share: 0 })
  const measure = async () => {
    setState({ step: 'down', share: 0 })
    const analysis = await measureAndSave(version, (share) => setState({ step: share >= 1 ? 'reading' : 'down', share })).catch(() => null)
    if (!analysis) return setState({ step: 'failed', share: 0 })
    await router.invalidate()
  }
  if (state.step === 'down' || state.step === 'reading') {
    return (
      <p className="readout flex min-h-11 items-center gap-2 text-ink-muted" role="status">
        {state.step === 'down' ? <Transfer direction="down" value={state.share} className="size-5" /> : <Tuning />}
        Measuring
      </p>
    )
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <Scope flat className="h-8 w-40" />
        <span className="readout text-ink-muted">Not measured</span>
      </div>
      <Tip label={`Downloads ${sizeOf(version.size)} to measure here. Otherwise tonight.`} side="bottom">
        <Button variant="secondary" size="sm" onClick={measure} className="gap-1.5">
          <Activity size={14} aria-hidden="true" />
          Measure
        </Button>
      </Tip>
      {state.step === 'failed' && <p role="alert" className="text-[0.8125rem] text-feedback-error">Couldn’t measure it. Try again.</p>}
    </div>
  )
}
