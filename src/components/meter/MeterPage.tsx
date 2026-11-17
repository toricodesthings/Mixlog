import { Activity, FileAudio, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { isMeasured, type Measured } from '#/server/loudness'
import { useAppearance } from '../../hooks/ui/use-appearance'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { measure } from '../../lib/meter'
import { cn } from '../../lib/utils'
import { Reading, reading } from '../meters/Readings'
import { WaveBars } from '../player/LoudnessWave'
import { BrandMark, Button, Led, Meter, Scope, Tip, Transfer, Tuning } from '../primitives'
import { formatLength } from '../releases/browse'
import { formatOf } from '../releases/stacks'
import { sizeOf } from '../uploads/progress'

const ACCEPT = 'audio/*,.wav,.aif,.aiff,.flac,.m4a,.ogg,.opus'

type State =
  | { step: 'waiting' }
  | { step: 'measuring'; file: File; share: number }
  | { step: 'read'; file: File; a: Measured }
  | { step: 'unreadable' | 'failed'; file: File }
  | { step: 'unsupported' }

/**
 * The public meter: drop a bounce, Mixlog's meter reads it on this device, and the reading is laid out as the meter
 * bridge lays it out. Nothing is uploaded, stored or counted: the file goes to a Web Worker and the reading lives in
 * this component's state only, gone on leaving or reloading.
 */
export function MeterPage() {
  const [state, setState] = useState<State>({ step: 'waiting' })
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const job = useRef<AbortController | null>(null)
  const { isPhone } = useShellMode()

  const start = async (file: File) => {
    job.current?.abort()
    if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return setState({ step: 'unsupported' })
    const controller = (job.current = new AbortController())
    setState({ step: 'measuring', file, share: 0 })
    const a = await measure(
      file,
      (share) => !controller.signal.aborted && setState({ step: 'measuring', file, share }),
      controller.signal,
    )
    if (controller.signal.aborted) return
    setState(isMeasured(a) ? { step: 'read', file, a } : { step: a ? 'unreadable' : 'failed', file })
  }
  const choose = () => input.current?.click()
  useEffect(() => () => job.current?.abort(), [])

  // A file dragged anywhere over the page arms the input; dropping it anywhere measures it.
  useEffect(() => {
    let depth = 0
    const files = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
    const enter = (event: DragEvent) => files(event) && (depth++, setDragging(true))
    const leave = (event: DragEvent) => files(event) && --depth <= 0 && ((depth = 0), setDragging(false))
    const over = (event: DragEvent) => files(event) && event.preventDefault()
    const drop = (event: DragEvent) => {
      if (!files(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      const file = event.dataTransfer?.files[0]
      if (file) void start(file)
    }
    addEventListener('dragenter', enter)
    addEventListener('dragleave', leave)
    addEventListener('dragover', over)
    addEventListener('drop', drop)
    return () => {
      removeEventListener('dragenter', enter)
      removeEventListener('dragleave', leave)
      removeEventListener('dragover', over)
      removeEventListener('drop', drop)
    }
  })

  const chooseButton = (label: string) => (
    <Button size="lg" onClick={choose} className={cn('gap-2', isPhone && 'w-full')}>
      <FileAudio size={18} aria-hidden="true" />
      {label}
    </Button>
  )

  return (
    <div className="flex min-h-dvh flex-col safe-top safe-bottom px-4">
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void start(file)
        }}
      />
      <header className="mx-auto flex w-full max-w-[48rem] items-center justify-between">
        <BrandMark className="h-8 w-auto" />
        <ModeToggle />
      </header>

      <main className="@container mx-auto flex w-full max-w-[48rem] flex-1 flex-col py-6">
        {state.step === 'waiting' && (
          <Still
            readout="CH 01 · −∞ dB"
            title="Meter"
            heading="h1"
            action={isPhone ? null : chooseButton('Choose a file')}
          >
            Drop a bounce, or choose one. It’s measured on this device and never leaves it.
          </Still>
        )}
        {state.step === 'measuring' && <Measuring file={state.file} share={state.share} />}
        {state.step === 'read' && (
          <Read file={state.file} a={state.a} onAnother={isPhone ? undefined : () => setState({ step: 'waiting' })} />
        )}
        {(state.step === 'unreadable' || state.step === 'failed') && (
          <Still readout="No signal" title="No reading" action={isPhone ? null : chooseButton('Choose another')}>
            {state.step === 'unreadable'
              ? 'Mixlog can’t read this format yet. WAV, AIFF, FLAC, MP3, M4A, OGG and Opus work.'
              : 'Couldn’t measure this file. Try it again, or another.'}
          </Still>
        )}
        {state.step === 'unsupported' && (
          <Still readout="No signal" title="No reading">
            This browser can’t run the meter.
          </Still>
        )}
      </main>

      {/* On a phone the one action sits in the thumb's reach. */}
      {isPhone && state.step !== 'measuring' && state.step !== 'unsupported' && (
        <div className="sticky bottom-4 mx-auto w-full max-w-[48rem] pb-4">
          {state.step === 'read' ? (
            <Button variant="secondary" size="lg" onClick={() => setState({ step: 'waiting' })} className="w-full">
              Measure another
            </Button>
          ) : (
            chooseButton(state.step === 'waiting' ? 'Choose a file' : 'Choose another')
          )}
        </div>
      )}
      {/* Wraps between its parts, never inside one. */}
      <footer className="readout mx-auto flex flex-wrap justify-center gap-x-2 pb-2 text-center text-ink-muted">
        <span>MIXLOG METER · v{__APP_VERSION__} ·</span>
        <span>NOTHING LEAVES THIS DEVICE</span>
      </footer>

      {dragging && (
        <div
          aria-hidden="true"
          className="layer-route-overlay pointer-events-none fixed inset-0 flex items-center justify-center bg-room-void/55 p-6 backdrop-blur-sm pop [--pop-from:1]"
        >
          <div className="pointer-events-none absolute inset-4 rounded-[2rem] border-2 border-dashed border-accent/60 glow-accent sm:inset-6" />
          <div className="surface-dialog glass-edge flex max-w-sm flex-col items-center gap-4 rounded-[2rem] px-10 py-9 text-center pop">
            <Meter live className="h-12 gap-1 [&>span]:w-2" />
            <p className="readout flex items-center gap-2 text-ink-muted">
              <Led />
              Input armed
            </p>
            <p className="font-display text-2xl font-semibold tracking-tight text-ink">Drop to measure</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** Waiting, or no reading: a flat scope, a readout, the title, one line and the one next step. Focus lands on the title. */
function Still({
  readout,
  title,
  heading: H = 'h2',
  action,
  children,
}: {
  readout: string
  title: string
  heading?: 'h1' | 'h2'
  action?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [title])
  return (
    <section className="my-auto flex flex-col items-center gap-3 py-10 text-center">
      <Scope flat className="mb-3" />
      <p className="readout text-accent">{readout}</p>
      <H ref={ref} tabIndex={-1} className="font-display text-4xl font-semibold tracking-tight text-ink outline-hidden">
        {title}
      </H>
      <p role="status" className="max-w-sm text-balance text-ink-soft">
        {children}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </section>
  )
}

function Measuring({ file, share }: { file: File; share: number }) {
  const reading = share < 1
  return (
    <section className="my-auto flex flex-col items-center gap-3 py-10 text-center">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink break-all">{file.name}</h2>
      <p data-numeric className="readout text-ink-muted">
        {sizeOf(file.size)}
      </p>
      <p role="status" className="readout mt-3 flex min-h-11 items-center gap-2 text-ink-muted">
        {reading ? <Transfer direction="down" value={share} className="size-5" /> : <Tuning />}
        Measuring
      </p>
    </section>
  )
}

function Read({ file, a, onAnother }: { file: File; a: Measured; onAnother?: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [file])
  const facts = [
    formatOf(file.name),
    a.format.bits && `${a.format.bits}-bit`,
    `${Math.round(a.format.rate / 100) / 10} kHz`,
    formatLength(a.ms),
    sizeOf(file.size),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Activity size={18} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2
            ref={ref}
            tabIndex={-1}
            className="flex items-center gap-2 font-display text-xl font-semibold leading-tight tracking-tight text-ink outline-hidden"
          >
            <span className="truncate">{file.name}</span>
            <Led />
          </h2>
          <p data-numeric className="readout truncate text-ink-muted">
            {facts}
          </p>
        </div>
        {onAnother && (
          <Button variant="secondary" size="sm" onClick={onAnother} className="shrink-0">
            Measure another
          </Button>
        )}
      </header>
      <p role="status" className="sr-only">
        Measured. {a.lufs === null ? 'Silent' : `${reading(a.lufs)} LUFS`}, {reading(a.truePeak, 1, true)} dB true peak.
      </p>
      <WaveBars wave={{ bars: a.wave, ms: a.ms, loudestMs: a.loudest?.atMs ?? null }} className="mt-2" />
      <Reading a={a} name={file.name} />
    </div>
  )
}

/** Blue Hour or Daylight for this device, on this origin; the system's until chosen. */
function ModeToggle() {
  // Subscribes to the choice; what's shown is read from <html>, where the boot script resolved "system".
  const { setTheme } = useAppearance()
  const daylight = document.documentElement.dataset.theme === 'daylight'
  const label = daylight ? 'Blue Hour' : 'Daylight'
  return (
    <Tip label={label} side="left">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(daylight ? 'blue-hour' : 'daylight')}
        aria-label={`Switch to ${label}`}
        className="rounded-full text-ink-muted"
      >
        {daylight ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
      </Button>
    </Tip>
  )
}
