// A reading laid out as the meter bridge reads it: the same instruments in the release room and on the public meter.
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, ArrowDown, ArrowUp, AudioLines, AudioWaveform, ChevronDown, Equal, FileAudio, Gauge, MoveVertical, Music, OctagonAlert, Scale, SlidersHorizontal, Spline, TrendingUp, Volume2, Waves, type LucideIcon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { siApplemusic, siDeezer, siSpotify, siTidal, siYoutube, type SimpleIcon } from 'simple-icons'

import { PLATFORMS, normalizationOf, type Delta, type Headline, type Measured } from '#/server/loudness'
import { SPRINGS, TWEENS } from '../../lib/constants/motion'
import { cn } from '../../lib/utils'
import { Tip } from '../primitives'
import { formatLength } from '../releases/browse'
import { formatOf } from '../releases/stacks'

const clockOf = (seconds: number) => formatLength(seconds * 1000)
/** A number as a meter reads it: a real minus sign, a plus when `signed`, fixed decimals. */
export const reading = (v: number, digits = 1, signed = false) => `${v < 0 ? '−' : signed && v > 0 ? '+' : ''}${Math.abs(v).toFixed(digits)}`
const spoken = (v: number, digits = 1) => `${v < 0 ? 'minus ' : ''}${Math.abs(v).toFixed(digits)}`
const along = (v: number, from: number, to: number) => `${Math.min(100, Math.max(0, ((v - from) / (to - from)) * 100))}%`

/** What a reading's instruments say and how far they've moved: the release room passes the version before. */
export type Deltas = { by: Partial<Record<Headline, Delta>>; since: string; number: number }

/** The facts behind each instrument, said once and shared by the bridge and the public meter. */
const TIP = {
  lufs: 'Integrated loudness across the whole song. Most platforms play at −14 LUFS and turn louder songs down.',
  truePeak: 'The highest the waveform reaches between samples. Above −1 dBTP, lossy encoding can clip.',
  correlation: 'How alike left and right are: +1 the same, 0 unrelated, −1 cancelling. Below 0, parts of the mix cancel in mono.',
  plr: 'Peak to loudness ratio: from the song’s loudness up to its true peak. How far the peaks stand above the loudness.',
}
const LOW_TIP = 'The share of the song’s energy below 120 Hz. There’s no right amount; compare it with records you know.'

/**
 * A reading's three folds, each a card that opens and closes: Readings (open: loudness, true peak, phase, dynamics, in
 * the order an engineer reads a master), Penalty (what each platform does to its level) and More. Facts, never
 * verdicts: louder isn't better, so a change since the version before is Haze, never green or red. The release room
 * passes `deltas` and `onLowPhase` (play from the lowest phase); the public meter passes neither.
 */
export function Reading({ a, name, deltas, onLowPhase }: { a: Measured; name: string; deltas?: Deltas | null; onLowPhase?: () => void }) {
  const delta = (key: Headline, unit: string, word: [string, string]) =>
    deltas?.by[key] && <DeltaLine d={deltas.by[key]!} unit={unit} word={word} since={deltas.since} number={deltas.number} />
  return (
    <>
      <Group icon={<Activity size={16} />} title="Readings" summary={[a.lufs === null ? 'Silent' : `${reading(a.lufs)} LUFS`, `${reading(a.truePeak, 1, true)} dBTP`].join(' · ')} open>
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 @2xl:grid-cols-4">
          <Instrument name="Loudness" tip={TIP.lufs} value={a.lufs} unit="LUFS" said={a.lufs === null ? 'silent' : `${spoken(a.lufs)} LUFS`} delta={delta('lufs', 'LU', ['louder', 'quieter'])}>
            {a.lufs !== null && <LoudnessScale lufs={a.lufs} />}
          </Instrument>
          <Instrument name="True peak" tip={TIP.truePeak} value={a.truePeak} unit="dBTP" signed said={`${spoken(a.truePeak)} dB true peak`} delta={delta('truePeak', 'dB', ['higher', 'lower'])}>
            <PeakMeter dbtp={a.truePeak} />
          </Instrument>
          <Instrument
            name="Phase"
            tip={TIP.correlation}
            value={a.correlation?.mean ?? null}
            digits={2}
            signed
            empty="Mono"
            said={a.correlation ? `correlation ${spoken(a.correlation.mean, 2)}` : 'mono'}
            delta={delta('correlation', '', ['wider', 'narrower'])}
          >
            {a.correlation && <PhaseMeter c={a.correlation} onLow={onLowPhase} />}
          </Instrument>
          <Instrument name="Dynamics" tip={TIP.plr} value={a.plr} unit="PLR" said={a.plr === null ? 'none' : `${spoken(a.plr)} dB peak to loudness`} delta={delta('plr', 'dB', ['more', 'less'])}>
            {a.lufs !== null && <CrestSpan lufs={a.lufs} dbtp={a.truePeak} />}
          </Instrument>
        </div>
      </Group>
      {a.lufs !== null && <Penalty a={a} />}
      <Group icon={<SlidersHorizontal size={16} />} title="More" summary="Peaks, range, low end, DC and the file">
        <Technical name={name} a={a} />
      </Group>
    </>
  )
}

/**
 * A fold of the bridge: a card whose header (an icon tile, its name, a one-line summary, a chevron) opens and closes
 * it, its body growing in place. Each opens on its own; Readings starts open.
 */
export function Group({ icon, title, summary, open: initially = false, children }: { icon: ReactNode; title: string; summary: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initially)
  const id = `${useId()}-body`
  return (
    <section className="surface-item rounded-2xl border border-line/40">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id} className="press flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent">{icon}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-[0.9375rem] font-semibold text-ink">{title}</span>
          <span data-numeric className="truncate text-[0.8125rem] text-ink-muted">{summary}</span>
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
      <Tip label={tip} side="top" toggle>
        <button type="button" className="readout w-fit rounded text-ink-muted">{name}</button>
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
    <Tip label={`Since ${since}`} side="bottom" toggle>
      <button type="button" className="readout flex w-fit items-center gap-1 rounded text-accent-tertiary">
        <Icon size={12} aria-hidden="true" />
        {!d.same && <span aria-hidden="true" data-numeric>{Math.abs(d.by).toFixed(unit ? 1 : 2)}</span>}
        <span aria-hidden="true" className="text-ink-muted">v{number}</span>
        <span className="sr-only">{sentence}</span>
      </button>
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
function PhaseMeter({ c, onLow }: { c: NonNullable<Measured['correlation']>; onLow?: () => void }) {
  return (
    <span className="meter-rule">
      <span aria-hidden="true" className="meter-tick" style={{ left: '50%' }} />
      <motion.span aria-hidden="true" className="meter-needle" initial={{ left: '50%' }} animate={{ left: along(c.mean, -1, 1) }} transition={SPRINGS.SNAP} />
      {onLow ? <Tip label={`Lowest ${reading(c.min, 2, true)} at ${clockOf(c.minAtMs / 1000)}`} side="bottom">
        <button
          type="button"
          onClick={onLow}
          aria-label={`Play from the lowest phase, ${clockOf(c.minAtMs / 1000)}`}
          className="meter-low"
          style={{ left: along(c.min, -1, 1) }}
        />
      </Tip> : <span aria-hidden="true" className="meter-low" style={{ left: along(c.min, -1, 1) }} />}
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
export function Penalty({ a }: { a: Measured }) {
  const rows = PLATFORMS.map((p) => ({ p, by: normalizationOf(a, p) ?? 0 }))
  const bys = rows.map((r) => r.by)
  const [low, high] = [Math.min(...bys), Math.max(...bys)]
  const summary = low === high ? (low === 0 ? 'Played as it is' : `${reading(low, 1, true)} dB everywhere`) : `${reading(low, 1, true)} to ${reading(high, 1, true)} dB`
  return (
    <Group icon={<Volume2 size={16} />} title="Penalty" summary={summary} open>
      {/* In short runs, by what happens to the song, the biggest change first (a platform with no change is left as is). */}
      <div className="-my-2 flex flex-col gap-3">
        {[
          { title: 'Turned down', rows: rows.filter((r) => r.by < 0).sort((x, y) => x.by - y.by) },
          { title: 'Turned up', rows: rows.filter((r) => r.by > 0).sort((x, y) => y.by - x.by) },
          { title: 'Left as is', rows: rows.filter((r) => r.by === 0) },
        ]
          .filter((g) => g.rows.length > 0)
          .map(({ title, rows: group }) => (
            <section key={title} aria-label={title}>
              <h4 aria-hidden="true" className="readout pt-2 text-ink-muted">{title}</h4>
              <ul className="flex flex-col divide-y divide-line/40">
                {group.map(({ p, by }) => {
                  const Icon = by < 0 ? ArrowDown : by > 0 ? ArrowUp : Equal
                  const said = by === 0 ? `${p.name} leaves it as it is` : `${p.name} turns it ${by < 0 ? 'down' : 'up'} ${Math.abs(by).toFixed(1)} dB`
                  return (
                    <li key={p.name} className="flex min-h-14 items-center gap-3 py-2">
                      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-ink-soft">
                        <Logo icon={LOGO[p.name]} />
                      </span>
                      <span aria-hidden="true" className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[0.875rem] font-medium text-ink">{p.name}</span>
                        <span data-numeric className="text-[0.78125rem] text-ink-muted">Plays at {reading(p.target, 0)} LUFS</span>
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
            </section>
          ))}
      </div>
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
function Technical({ name, a }: { name: string; a: Measured }) {
  const db = (v: number | null, unit: string, digits = 1, signed = false): [string, string] => (v === null ? ['—', ''] : [reading(v, digits, signed), unit])
  const rows: [LucideIcon, string, [string, string], boolean?, string?][] = [
    [MoveVertical, 'Sample peak', db(a.samplePeak, 'dBFS', 1, true)],
    [OctagonAlert, 'Clips', [`${a.clipped}`, '']],
    [Gauge, 'Momentary max', db(a.momentaryMax, 'LUFS')],
    [TrendingUp, 'Short-term max', db(a.shortTermMax, 'LUFS')],
    [AudioWaveform, 'LRA', db(a.lra, 'LU')],
    [Scale, 'DR', [a.dr === null ? '—' : `${a.dr}`, '']],
    [Waves, 'DC', [a.dc.map((d) => reading(d)).join(' · '), 'dB']],
    [AudioLines, 'Low end', a.low == null ? ['—', ''] : [`${Math.round(a.low * 100)} %`, '< 120 Hz'], false, LOW_TIP],
    ...(a.correlation ? [[Spline, 'Phase low', [reading(a.correlation.min, 2, true), `at ${clockOf(a.correlation.minAtMs / 1000)}`]] as [LucideIcon, string, [string, string]]] : []),
    // Meter takes one cell beside Phase low, else two, so every row of the grid fills at two and four across.
    [Activity, 'Meter', [`${a.meter}`, a.source === 'device' ? 'on this device' : 'overnight'], !a.correlation],
    [FileAudio, 'File', [[formatOf(name), a.format.bits && `${a.format.bits}-bit`, `${Math.round(a.format.rate / 100) / 10} kHz`, a.format.kbps && `${a.format.kbps} kbps`, a.format.channels === 1 ? 'mono' : a.format.channels === 2 ? 'stereo' : `${a.format.channels} ch`].filter(Boolean).join(' · '), ''], true],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-6 @2xl:grid-cols-4">
      {rows.map(([Icon, k, [v, unit], wide, tip]) => (
        <div key={k} className={cn('flex min-w-0 items-start gap-2.5', wide && 'col-span-2')}>
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent"><Icon size={15} /></span>
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="readout truncate text-ink-muted">
              {tip ? (
                <Tip label={tip} side="top" toggle>
                  <button type="button" className="readout w-fit rounded text-ink-muted">{k}</button>
                </Tip>
              ) : (
                k
              )}
            </dt>
            <dd className="flex min-w-0 items-baseline gap-1.5">
              <span data-numeric className={cn('text-ink', wide ? 'text-[0.875rem]' : 'font-display text-lg leading-none font-semibold')}>{v}</span>
              {unit && <span className="readout text-ink-muted">{unit}</span>}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
