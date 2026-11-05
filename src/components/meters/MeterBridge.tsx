import { useRouter } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, ArrowDown, ArrowUp, AudioWaveform, ChevronDown, Equal, FileAudio, Gauge, MoveVertical, Music, OctagonAlert, Scale, SlidersHorizontal, Spline, TrendingUp, Volume2, Waves, X } from 'lucide-react'
import { useId, useState, type ReactNode, type Ref } from 'react'
import { siApplemusic, siDeezer, siSpotify, siTidal, siYoutube, type SimpleIcon } from 'simple-icons'

import { PLATFORMS, deltaOf, isMeasured, normalizationOf, previousOf, type Delta, type Headline, type Measured } from '#/server/loudness'
import type { VersionRow as Version } from '#/server/releases'
import { SPRINGS, TWEENS } from '../../lib/constants/motion'
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
import { formatOf, nameOf, playableOf, versionLabel } from '../releases/stacks'
import { sizeOf } from '../uploads/progress'
import { measureAndSave } from './save'

/** A number as a meter reads it: a real minus sign, a plus when `signed`, fixed decimals. */
export const reading = (v: number, digits = 1, signed = false) => `${v < 0 ? '−' : signed && v > 0 ? '+' : ''}${Math.abs(v).toFixed(digits)}`
const spoken = (v: number, digits = 1) => `${v < 0 ? 'minus ' : ''}${Math.abs(v).toFixed(digits)}`
const along = (v: number, from: number, to: number) => `${Math.min(100, Math.max(0, ((v - from) / (to - from)) * 100))}%`

/**
 * A version's meters, read from the whole song: its loudness over time (a playhead too), then three folds, each a card
 * that opens and closes: Readings (open: loudness, true peak, phase, dynamics, in the order an engineer reads a
 * master), Penalty (what each platform does to its level) and More. Facts, never verdicts: louder isn't better, so a
 * change since the version before is Haze, never green or red. The same bridge unfolds under a row or fills the wide
 * panel.
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
    <section role="region" aria-label={`Meters, ${label}`} className={cn('meter-bridge @container flex flex-col', docked ? 'h-full' : 'gap-4')}>
      <header className={cn('flex items-center gap-3', docked && 'layer-shell-header signal-rule h-(--dock-header-h,var(--shell-header-h)) shrink-0 px-5')}>
        <span data-meters-jack className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Activity size={18} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h4 ref={headingRef} tabIndex={-1} className="truncate font-display text-xl font-semibold leading-tight tracking-tight text-ink outline-none">{nameOf(version)}</h4>
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
  const deltas = previous ? deltaOf(a, previous.analysis) : null
  const since = previous ? versionLabel(previous, t.section) : ''
  const delta = (key: Headline, unit: string, word: [string, string]) => deltas?.[key] && <DeltaLine d={deltas[key]!} unit={unit} word={word} since={since} number={previous!.number} />

  return (
    <>
      {item.wave && <LoudnessWave item={item} wave={item.wave} className="pt-2" />}
      <Group icon={<Activity size={16} />} title="Readings" summary={[a.lufs === null ? 'Silent' : `${reading(a.lufs)} LUFS`, `${reading(a.truePeak, 1, true)} dBTP`].join(' · ')} open>
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 @2xl:grid-cols-4">
          <Instrument name="Loudness" tip="Integrated loudness across the whole song" value={a.lufs} unit="LUFS" said={a.lufs === null ? 'silent' : `${spoken(a.lufs)} LUFS`} delta={delta('lufs', 'LU', ['louder', 'quieter'])}>
            {a.lufs !== null && <LoudnessScale lufs={a.lufs} />}
          </Instrument>
          <Instrument name="True peak" tip="The highest the waveform reaches between samples" value={a.truePeak} unit="dBTP" signed said={`${spoken(a.truePeak)} dB true peak`} delta={delta('truePeak', 'dB', ['higher', 'lower'])}>
            <PeakMeter dbtp={a.truePeak} />
          </Instrument>
          <Instrument
            name="Phase"
            tip="How alike left and right are: +1 the same, 0 unrelated, −1 cancelling"
            value={a.correlation?.mean ?? null}
            digits={2}
            signed
            empty="Mono"
            said={a.correlation ? `correlation ${spoken(a.correlation.mean, 2)}` : 'mono'}
            delta={delta('correlation', '', ['wider', 'narrower'])}
          >
            {a.correlation && (
              <PhaseMeter
                c={a.correlation}
                onLow={() => player.play(item, { at: a.correlation!.minAtMs / a.ms })}
              />
            )}
          </Instrument>
          <Instrument name="Dynamics" tip="Peak to loudness ratio: from the song's loudness up to its true peak" value={a.plr} unit="PLR" said={a.plr === null ? 'none' : `${spoken(a.plr)} dB peak to loudness`} delta={delta('plr', 'dB', ['more', 'less'])}>
            {a.lufs !== null && <CrestSpan lufs={a.lufs} dbtp={a.truePeak} />}
          </Instrument>
        </div>
      </Group>
      {a.lufs !== null && <Penalty a={a} />}
      <Group icon={<SlidersHorizontal size={16} />} title="More" summary="Peaks, range, DC and the file">
        <Technical version={version} a={a} />
      </Group>
    </>
  )
}

/**
 * A fold of the bridge: a card whose header (an icon tile, its name, a one-line summary, a chevron) opens and closes
 * it, its body growing in place. Each opens on its own; Readings starts open.
 */
function Group({ icon, title, summary, open: initially = false, children }: { icon: ReactNode; title: string; summary: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initially)
  const id = `${useId()}-body`
  return (
    <section className="surface-item rounded-2xl border border-line/40">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id} className="press flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">{icon}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-[15px] font-semibold text-ink">{title}</span>
          <span data-numeric className="truncate text-[13px] text-ink-muted">{summary}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className={cn('shrink-0 text-ink-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={id} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1, transition: SPRINGS.GLIDE }} exit={{ height: 0, opacity: 0, transition: TWEENS.FADE }} className="overflow-hidden">
            <div className="border-t border-line/40 px-4 pt-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function Instrument({ name, tip, value, unit, digits = 1, signed, empty = '—', said, delta, children }: {
  name: string; tip: string; value: number | null; unit?: string; digits?: number; signed?: boolean; empty?: string; said: string; delta?: ReactNode; children?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Tip label={tip} side="top">
        <span tabIndex={0} className="readout w-fit rounded text-ink-muted">{name}</span>
      </Tip>
      <p className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span aria-hidden="true" data-numeric className="font-display text-2xl font-semibold tracking-tight text-ink">{value === null ? empty : reading(value, digits, signed)}</span>
        {unit && value !== null && <span aria-hidden="true" className="readout text-ink-muted">{unit}</span>}
        <span className="sr-only">{said}</span>
      </p>
      <div className="h-5">{children}</div>
      <div className="min-h-4 empty:hidden">{delta}</div>
    </div>
  )
}

function DeltaLine({ d, unit, word, since, number }: { d: Delta; unit: string; word: [string, string]; since: string; number: number }) {
  const Icon = d.same ? Equal : d.by > 0 ? ArrowUp : ArrowDown
  const sentence = d.same ? `The same as ${since}` : `${Math.abs(d.by)} ${unit} ${d.by > 0 ? word[0] : word[1]} than ${since}`.replace('  ', ' ')
  return (
    <Tip label={`Since ${since}`} side="bottom">
      <span tabIndex={0} className="readout flex w-fit items-center gap-1 rounded text-accent-tertiary">
        <Icon size={12} aria-hidden="true" />
        {!d.same && <span aria-hidden="true" data-numeric>{Math.abs(d.by).toFixed(unit ? 1 : 2)}</span>}
        <span aria-hidden="true" className="text-ink-muted">v{number}</span>
        <span className="sr-only">{sentence}</span>
      </span>
    </Tip>
  )
}

/** −24 to −6 LUFS, a tick at each headline platform's target (−16, −14), the song a lit dot. */
function LoudnessScale({ lufs }: { lufs: number }) {
  return (
    <span aria-hidden="true" className="meter-rule">
      {[-16, -14].map((at) => <span key={at} className="meter-tick" style={{ left: along(at, -24, -6) }} />)}
      <span className="meter-dot" style={{ left: along(lufs, -24, -6) }} />
    </span>
  )
}

/** LED segments from −6 to +1 dBTP in half-dB steps, the ceiling at −1; over it, the warm Tube light. */
function PeakMeter({ dbtp }: { dbtp: number }) {
  const steps = Array.from({ length: 14 }, (_, i) => -6 + i * 0.5)
  return (
    <span aria-hidden="true" className="flex h-full items-center gap-[2px]">
      {steps.map((at) => (
        <span key={at} className={cn('meter-segment', at < dbtp && (at >= -1 ? 'meter-segment-over' : 'meter-segment-lit'), at === -1 && 'meter-ceiling')} />
      ))}
    </span>
  )
}

/** −1 to +1, a mark at 0; the needle at the song's mean settles from the centre once, the lowest 3 s a hollow mark. */
function PhaseMeter({ c, onLow }: { c: NonNullable<Measured['correlation']>; onLow: () => void }) {
  return (
    <span className="meter-rule">
      <span aria-hidden="true" className="meter-tick" style={{ left: '50%' }} />
      <motion.span aria-hidden="true" className="meter-needle" initial={{ left: '50%' }} animate={{ left: along(c.mean, -1, 1) }} transition={SPRINGS.SNAP} />
      <Tip label={`Lowest ${reading(c.min, 2, true)} at ${clock(c.minAtMs / 1000)}`} side="bottom">
        <button
          type="button"
          onClick={onLow}
          aria-label={`Play from the lowest phase, ${clock(c.minAtMs / 1000)}`}
          className="meter-low"
          style={{ left: along(c.min, -1, 1) }}
        />
      </Tip>
    </span>
  )
}

/** The crest: two marks on one rule (−30 to +3 dB), loudness and true peak; the lit gap between them is the PLR. */
function CrestSpan({ lufs, dbtp }: { lufs: number; dbtp: number }) {
  return (
    <span aria-hidden="true" className="meter-rule">
      <span className="meter-span" style={{ left: along(lufs, -30, 3), right: `calc(100% - ${along(dbtp, -30, 3)})` }} />
      <span className="meter-dot" style={{ left: along(lufs, -30, 3) }} />
      <span className="meter-dot" style={{ left: along(dbtp, -30, 3) }} />
    </span>
  )
}

/** What each platform's normalization does to its level at default settings: every platform a row, its logo, where
 *  it plays, and the change in dB: a fact, never a verdict. */
function Penalty({ a }: { a: Measured }) {
  const bys = PLATFORMS.map((p) => normalizationOf(a, p) ?? 0)
  const [low, high] = [Math.min(...bys), Math.max(...bys)]
  const summary = low === high ? (low === 0 ? 'Played as it is' : `${reading(low, 1, true)} dB everywhere`) : `${reading(low, 1, true)} to ${reading(high, 1, true)} dB`
  return (
    <Group icon={<Volume2 size={16} />} title="Penalty" summary={summary} open>
      <ul className="-my-2 flex flex-col divide-y divide-line/40">
        {PLATFORMS.map((p, i) => {
          const by = bys[i]
          const Icon = by < 0 ? ArrowDown : by > 0 ? ArrowUp : Equal
          const said = by === 0 ? `${p.name} leaves it as it is` : `${p.name} turns it ${by < 0 ? 'down' : 'up'} ${Math.abs(by).toFixed(1)} dB`
          return (
            <li key={p.name} className="flex min-h-14 items-center gap-3 py-2">
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-ink-soft">
                <Logo icon={LOGO[p.name]} />
              </span>
              <span aria-hidden="true" className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-medium text-ink">{p.name}</span>
                <span data-numeric className="text-[12.5px] text-ink-muted">Plays at {reading(p.target, 0)} LUFS</span>
              </span>
              <span aria-hidden="true" className="flex items-baseline gap-1 text-ink">
                <Icon size={13} className="self-center text-accent" />
                <span data-numeric className="font-display text-lg font-semibold">{by === 0 ? '0.0' : Math.abs(by).toFixed(1)}</span>
                <span className="readout text-ink-muted">dB</span>
              </span>
              <span className="sr-only">{said}</span>
            </li>
          )
        })}
      </ul>
    </Group>
  )
}

/** Each platform's mark, in the room's ink, never its brand colour. Amazon Music has none in simple-icons. */
const LOGO: Record<string, SimpleIcon | undefined> = { Spotify: siSpotify, 'Apple Music': siApplemusic, YouTube: siYoutube, Tidal: siTidal, Deezer: siDeezer }

function Logo({ icon }: { icon: SimpleIcon | undefined }) {
  if (!icon) return <Music size={14} aria-hidden="true" className="shrink-0" />
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 shrink-0 fill-current">
      <path d={icon.path} />
    </svg>
  )
}

/** The technical layer: every other reading, an icon, a label and a value each, no deltas; two across, four when wide. */
function Technical({ version, a }: { version: Version; a: Measured }) {
  const db = (v: number | null, unit: string, digits = 1, signed = false): [string, string] => (v === null ? ['—', ''] : [reading(v, digits, signed), unit])
  const rows: [ReactNode, string, [string, string], boolean?][] = [
    [<MoveVertical size={15} />, 'Sample peak', db(a.samplePeak, 'dBFS', 1, true)],
    [<OctagonAlert size={15} />, 'Clips', [`${a.clipped}`, '']],
    [<Gauge size={15} />, 'Momentary max', db(a.momentaryMax, 'LUFS')],
    [<TrendingUp size={15} />, 'Short-term max', db(a.shortTermMax, 'LUFS')],
    [<AudioWaveform size={15} />, 'LRA', db(a.lra, 'LU')],
    [<Scale size={15} />, 'DR', [a.dr === null ? '—' : `${a.dr}`, '']],
    [<Waves size={15} />, 'DC', [a.dc.map((d) => reading(d)).join(' · '), 'dB']],
    ...(a.correlation ? [[<Spline size={15} />, 'Phase low', [reading(a.correlation.min, 2, true), `at ${clock(a.correlation.minAtMs / 1000)}`]] as [ReactNode, string, [string, string]]] : []),
    [<FileAudio size={15} />, 'File', [[formatOf(version.filename), a.format.bits && `${a.format.bits}-bit`, `${Math.round(a.format.rate / 100) / 10} kHz`, a.format.kbps && `${a.format.kbps} kbps`, a.format.channels === 1 ? 'mono' : a.format.channels === 2 ? 'stereo' : `${a.format.channels} ch`].filter(Boolean).join(' · '), ''], true],
    [<Activity size={15} />, 'Meter', [`${a.meter}`, a.source === 'device' ? 'on this device' : 'overnight'], true],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-6 @2xl:grid-cols-4">
      {rows.map(([icon, k, [v, unit], wide]) => (
        <div key={k} className={cn('flex min-w-0 items-start gap-2.5', wide && 'col-span-2')}>
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">{icon}</span>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="readout truncate text-ink-muted">{k}</dt>
            <dd className="flex min-w-0 items-baseline gap-1.5">
              <span data-numeric className={cn('text-ink', wide ? 'text-[14px]' : 'font-display text-lg leading-none font-semibold')}>{v}</span>
              {unit && <span className="readout text-ink-muted">{unit}</span>}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  )
}

function Unread() {
  return (
    <div className="flex flex-col items-start gap-2">
      <Scope flat className="h-8 w-40" />
      <Tip label="Mixlog can’t read this format yet." side="bottom">
        <span tabIndex={0} className="readout rounded text-ink-muted">No reading</span>
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
      {state.step === 'failed' && <p role="alert" className="text-[13px] text-feedback-error">Couldn’t measure it. Try again.</p>}
    </div>
  )
}
