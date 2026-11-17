import { FileAudio, Info, Music, Moon, Pause, Play, RotateCcw, RotateCw, Sun } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { isMeasured, type Measured } from '#/server/loudness'
import { useAppearance } from '../../hooks/ui/use-appearance'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { measure } from '../../lib/meter'
import { cn } from '../../lib/utils'
import { Reading, reading } from '../meters/Readings'
import { WaveBars } from '../player/LoudnessWave'
import { Boot, Outside } from '../layout/Boot'
import { BrandMark, Button, IconSwitch, Led, Meter, Progress, Scope, Tip } from '../primitives'
import { formatLength } from '../releases/browse'
import { formatOf } from '../releases/stacks'
import { sizeOf } from '../uploads/progress'

/** Walking up to the dropzone's window until it's the whole screen (`.meter-window`'s transition), before the boot. */
const ZOOM_MS = 800
const zoomMs = () => (document.documentElement.dataset.motion === 'reduced' ? 0 : ZOOM_MS)

const ACCEPT = 'audio/*,.wav,.aif,.aiff,.flac,.m4a,.ogg,.opus'

type State =
  | { step: 'waiting' }
  | { step: 'measuring'; file: File; share: number }
  | { step: 'read'; file: File; a: Measured }
  | { step: 'unreadable' | 'failed'; file: File }
  | { step: 'many' | 'unsupported' }

/**
 * The public meter: drop a bounce, Mixlog's meter reads it on this device, and the reading is laid out as the meter
 * bridge lays it out, and it plays from the file itself. Nothing is uploaded, stored or counted: the file goes to a
 * Web Worker and the reading lives in this component's state only, gone on leaving or reloading.
 */
export function MeterPage() {
  const [state, setState] = useState<State>({ step: 'waiting' })
  /** Files over the window: how many (0 when the browser won't say until the drop). */
  const [dragging, setDragging] = useState<number | null>(null)
  /** The boot flying off the reading, once measured. */
  const [leaving, setLeaving] = useState(false)
  const left = useCallback(() => setLeaving(false), [])
  /** Through the window: the boot's mark comes up a quarter of the way in, so it has
   *  finished arriving (`.boot-through`) as the zoom lands. */
  const [arrived, setArrived] = useState(false)
  const [box, setBox] = useState<HTMLElement | null>(null)
  const clip = useWindow(box)
  const input = useRef<HTMLInputElement>(null)
  const job = useRef<AbortController | null>(null)
  const { isPhone, isTouch } = useShellMode()

  const start = async (file: File) => {
    job.current?.abort()
    setLeaving(false)
    if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return setState({ step: 'unsupported' })
    const controller = (job.current = new AbortController())
    setState({ step: 'measuring', file, share: 0 })
    // A quick file still waits out the zoom and a beat of the boot, so the walk through the window never cuts short.
    const [a] = await Promise.all([
      measure(file, (share) => !controller.signal.aborted && setState({ step: 'measuring', file, share }), controller.signal),
      new Promise((done) => setTimeout(done, zoomMs() + 300)),
    ])
    if (controller.signal.aborted) return
    setState(isMeasured(a) ? { step: 'read', file, a } : { step: a ? 'unreadable' : 'failed', file })
    setLeaving(true)
  }
  const choose = () => input.current?.click()
  useEffect(() => () => job.current?.abort(), [])
  const through = state.step === 'measuring'
  useEffect(() => {
    if (!through) return
    const timer = setTimeout(() => setArrived(true), zoomMs() * 0.25)
    return () => (clearTimeout(timer), setArrived(false))
  }, [through])

  // A file dragged anywhere over the page arms the input; dropping one anywhere measures it, more than one is refused.
  useEffect(() => {
    let depth = 0
    const files = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
    const enter = (event: DragEvent) => files(event) && (depth++, setDragging(event.dataTransfer?.items.length ?? 0))
    const leave = (event: DragEvent) => files(event) && --depth <= 0 && ((depth = 0), setDragging(null))
    const over = (event: DragEvent) => files(event) && event.preventDefault()
    const drop = (event: DragEvent) => {
      if (!files(event)) return
      event.preventDefault()
      depth = 0
      setDragging(null)
      const dropped = event.dataTransfer?.files ?? []
      if (dropped.length > 1) setState({ step: 'many' })
      else if (dropped[0]) void start(dropped[0])
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
    <Button
      size="lg"
      onClick={choose}
      className={cn('gap-2', isPhone && 'w-full')}
    >
      <FileAudio size={18} aria-hidden="true" />
      {label}
    </Button>
  )
  const failed = state.step === 'unreadable' || state.step === 'failed'
  const measuring = state.step === 'measuring' || leaving
  /** Measured: the night flies off with the boot, onto the reading. Unread, the window just closes back to the dropzone. */
  const outward = leaving && state.step === 'read'
  // The room fades past as the window comes up to meet you.
  const passing = cn('[transition:opacity_500ms_var(--ease-out-quart),scale_var(--spring-window)]', through && 'scale-105 opacity-0')

  return (
    <div className="flex min-h-dvh flex-col safe-top safe-bottom px-4 sm:px-8">
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
      {/* The night through the dropzone's window, clipped to it; fixed and first, so the page paints over it (its
          positioned parts, at least: the dropzone's content). It
          is the boot's own night: come through, the boot draws only its mark over it, and leaves with it. */}
      {(state.step !== 'read' || leaving) && (
        <div
          aria-hidden="true"
          className={cn(
            'meter-window boot bg-atmosphere pointer-events-none fixed inset-0 overflow-hidden',
            (arrived || outward) && 'layer-loading-screen',
            outward && 'boot-leaving',
          )}
          data-through={through || outward ? '' : undefined}
          style={{ clipPath: through || outward ? 'inset(0 round 0)' : clip }}
        >
          <Outside />
        </div>
      )}
      <header className={cn(passing, 'mx-auto flex w-full max-w-6xl items-center justify-between py-4')}>
        <h1 data-meter-host className="flex items-center gap-2.5">
          <BrandMark className="size-9" />
          <span className="font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-ink sm:text-2xl">Mixlog</span>
          <span className="font-display text-[1.375rem] font-medium leading-tight tracking-tight text-accent sm:text-2xl">LoudorNot</span>
        </h1>
        <ModeSwitch />
      </header>

      <main className="@container mx-auto flex w-full max-w-6xl flex-1 flex-col py-4">
        {state.step === 'read' ? (
          <Read file={state.file} a={state.a} onAnother={isPhone ? undefined : () => setState({ step: 'waiting' })} />
        ) : (
          <Dropzone
            through={through}
            boxRef={setBox}
            over={dragging !== null && !measuring ? (dragging > 1 ? 'many' : 'one') : null}
            readout={failed || state.step === 'unsupported' ? 'No signal' : 'CH 01 · −∞ dB'}
            title={
              state.step === 'many'
                ? 'One at a time'
                : failed || state.step === 'unsupported'
                  ? 'No reading'
                  : isTouch
                    ? 'Choose a bounce'
                    : 'Drop a bounce'
            }
            action={isPhone || state.step === 'unsupported' ? null : chooseButton(failed ? 'Choose another' : 'Choose a file')}
          >
            {state.step === 'unreadable'
              ? 'Mixlog can’t read this format yet. WAV, AIFF, FLAC, MP3, M4A, OGG and Opus work.'
              : state.step === 'failed'
                ? 'Couldn’t measure this file. Try it again, or another.'
                : state.step === 'unsupported'
                  ? 'This browser can’t run the meter.'
                  : state.step === 'many'
                    ? 'Drop a single bounce to measure it.'
                    : 'Measured on this device. Nothing is uploaded.'}
          </Dropzone>
        )}
      </main>

      {/* On a phone the one action sits in the thumb's reach. */}
      {isPhone && state.step !== 'unsupported' && (
        <div className={cn(passing, 'sticky bottom-4 mx-auto w-full pb-4')}>
          {state.step === 'read' ? (
            <Button variant="secondary" size="lg" onClick={() => setState({ step: 'waiting' })} className="w-full">
              Measure another
            </Button>
          ) : (
            chooseButton(failed ? 'Choose another' : 'Choose a file')
          )}
        </div>
      )}
      <footer className={cn(passing, 'readout mx-auto pb-2 text-center text-ink-muted')}>v{__APP_VERSION__}</footer>

      {((through && arrived) || leaving) && (
        <Boot leaving={leaving} onLeft={left} scene={false}>
          <Measuring
            name={'file' in state ? state.file.name : ''}
            share={state.step === 'measuring' ? state.share : 1}
          />
        </Boot>
      )}

      {/* Over a reading, the whole page is the input. */}
      {dragging !== null && state.step === 'read' && !measuring && (
        <div
          aria-hidden="true"
          className="layer-route-overlay pointer-events-none fixed inset-0 flex items-center justify-center bg-room-void/55 p-6 backdrop-blur-sm pop [--pop-from:1]"
        >
          <div className="pointer-events-none absolute inset-4 rounded-[2rem] border-2 border-dashed border-accent/60 glow-accent sm:inset-6" />
          <div className="surface-dialog glass-edge flex max-w-sm flex-col items-center gap-4 rounded-[2rem] px-10 py-9 text-center pop">
            <Meter live className="h-12 gap-1 [&>span]:w-2" />
            <p className="readout flex items-center gap-2 text-ink-muted">
              <Led tone="phantom" />
              +48V · Input armed
            </p>
            <p className="font-display text-2xl font-semibold tracking-tight text-ink">
              {dragging > 1 ? 'One at a time' : 'Drop to measure'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The middle of the page, waiting for a bounce: dashed like an empty lane, lit while a file is over the window, its
 * meter dancing like a channel catching signal. It's a window onto the night the boot is drawn in, frosted; a bounce
 * in (`through`), the window comes up to fill the screen and clears, and the boot is outside. Focus lands on the title
 * as it changes.
 */
function Dropzone({
  readout,
  title,
  over,
  through,
  boxRef,
  action,
  children,
}: {
  through: boolean
  boxRef: (el: HTMLElement | null) => void
  readout: string
  title: string
  over: 'one' | 'many' | null
  action?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [title])
  const lit = over === 'one'
  return (
    <>
      <section
        ref={boxRef}
        data-meter-host
        data-over={lit ? '' : undefined}
        className={cn(
          'drop-slot group relative my-auto flex min-h-[min(30rem,52dvh)] w-full flex-col items-center justify-center gap-3 rounded-[2rem] px-6 py-12 text-center',
          lit && 'meter-live',
          // The frame and its tint go as you pass through it
        through && 'border-transparent! bg-transparent! shadow-none!',
        )}
      >
        <div className={cn('flex flex-col items-center gap-3 [transition:opacity_400ms_var(--ease-out-quart),scale_var(--spring-window)]', through && 'scale-110 opacity-0')}>
        {over ? <Meter live={lit} className="mb-3 h-10 gap-1 [&>span]:w-2" /> : <Scope flat className="mb-3" />}
        <p className="readout flex items-center gap-2 text-accent">
          {lit && <Led tone="phantom" />}
          {lit ? '+48V · Input armed' : readout}
        </p>
        <h2
          ref={ref}
          tabIndex={-1}
          className="font-display text-3xl font-semibold tracking-tight text-ink outline-hidden sm:text-4xl"
        >
          {over === 'many' ? 'One at a time' : lit ? 'Drop to measure' : title}
        </h2>
        <p role="status" className="max-w-sm text-balance text-ink-soft">
          {over === 'many' ? 'Drop a single bounce to measure it.' : children}
        </p>
        {action && <div className="mt-5">{action}</div>}
        </div>
      </section>
    </>
  )
}

/** The dropzone's box as a clip on the whole screen, kept in step with resizes and scrolling. */
function useWindow(el: HTMLElement | null) {
  const [clip, setClip] = useState<string>()
  useLayoutEffect(() => {
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const { clientWidth: w, clientHeight: h } = document.documentElement
      const b = 1.5 // inside the dashed border, so the frame stays drawn over the view
      setClip(`inset(${r.top + b}px ${w - r.right + b}px ${h - r.bottom + b}px ${r.left + b}px round ${32 - b}px)`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    addEventListener('resize', measure)
    addEventListener('scroll', measure, { capture: true, passive: true })
    return () => (observer.disconnect(), removeEventListener('resize', measure), removeEventListener('scroll', measure, { capture: true }))
  }, [el])
  return clip
}

/** Under the boot's mark: how far the meter has read, then the file it's reading. */
function Measuring({ name, share }: { name: string; share: number }) {
  return (
    <div className="boot-wordmark flex w-64 max-w-[80vw] flex-col items-center gap-3 text-center">
      <Progress value={share} label="Measuring" valueText={`${Math.round(share * 100)}%`} className="w-full" />
      <p className="readout text-ink-muted">Measuring</p>
      <p className="w-full truncate text-sm text-ink-soft">{name}</p>
    </div>
  )
}

/**
 * The file itself, played on this device: an object URL to the dropped file, never a copy sent anywhere. Its own
 * section, seeking the way the listening room's wave does (lit to the playhead, the time under the pointer, ←/→ 5 s),
 * with Play between back and ahead 10 s under it.
 */
function Listen({ file, a }: { file: File; a: Measured }) {
  const audio = useRef<HTMLAudioElement>(null)
  // Made, given to the audio and revoked in one effect, so a re-run never leaves it pointing at a revoked URL.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (audio.current) audio.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  const box = useRef<HTMLDivElement>(null)
  const { isTouch } = useShellMode()
  const [playing, setPlaying] = useState(false)
  const [unplayable, setUnplayable] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  // Whole seconds only, so the clock re-renders once a second; the playhead itself is painted every frame.
  const [second, setSecond] = useState(0)
  const length = a.ms / 1000
  const paint = () => {
    const t = audio.current?.currentTime ?? 0
    for (const el of box.current?.querySelectorAll<HTMLElement>('[data-playhead-read]') ?? []) {
      el.style.setProperty('--fill', `${length ? Math.min(100, (t / length) * 100) : 0}%`)
      el.style.setProperty('--hover', `${(hover ?? 0) * 100}%`)
    }
    setSecond(Math.floor(t))
  }
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- only the pointer moving repaints the ghost
  useLayoutEffect(paint, [hover])
  useEffect(() => {
    if (!playing) return
    let frame = requestAnimationFrame(function tick() {
      paint()
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  })
  const toggle = () => {
    const el = audio.current
    if (!el) return
    if (el.paused) void el.play().catch(() => setPlaying(false))
    else el.pause()
  }
  const seekTo = (t: number) => {
    if (!audio.current) return
    audio.current.currentTime = Math.min(length, Math.max(0, t))
    paint()
  }
  const keys = (event: KeyboardEvent) => {
    const by = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -30, PageUp: 30 }[event.key]
    if (by === undefined) return
    event.preventDefault()
    seekTo((audio.current?.currentTime ?? 0) + by)
  }
  const skip = (by: number) => {
    const label = `${by < 0 ? 'Back' : 'Ahead'} ${Math.abs(by)} seconds`
    const Icon = by < 0 ? RotateCcw : RotateCw
    return (
      <button
        type="button"
        onClick={() => seekTo((audio.current?.currentTime ?? 0) + by)}
        disabled={unplayable}
        aria-label={label}
        className="press relative flex size-12 shrink-0 items-center justify-center rounded-full text-ink-soft hover:text-ink disabled:opacity-40"
      >
        <Icon size={30} strokeWidth={1.6} aria-hidden="true" />
        <span aria-hidden="true" data-numeric className="absolute pt-px text-[0.59375rem] font-semibold">
          {Math.abs(by)}
        </span>
      </button>
    )
  }
  return (
    <section aria-label="Listen" className="surface-item flex flex-col items-center gap-4 rounded-2xl border border-line/40 px-4 pt-8 pb-4">
      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => (setPlaying(false), seekTo(0))}
        onError={(event) => event.currentTarget.src && setUnplayable(true)}
      />
      <div className="flex w-full items-center gap-3">
        <span data-numeric className="w-10 shrink-0 text-right text-xs text-ink-muted">
          {formatLength(second * 1000)}
        </span>
        <div ref={box} className="min-w-0 flex-1">
          <WaveBars
            wave={{ bars: a.wave, ms: a.ms, loudestMs: a.loudest?.atMs ?? null }}
            size="room"
            data-active
            data-playhead
            onPointerMove={
              isTouch
                ? undefined
                : (event) => {
                    const r = event.currentTarget.getBoundingClientRect()
                    setHover(Math.min(1, Math.max(0, (event.clientX - r.left) / r.width)))
                  }
            }
            onPointerLeave={() => setHover(null)}
            onDrawn={paint}
            layers={(bars) => (
              <>
                {hover !== null && bars('wave-layer wave-hover', { read: true })}
                {bars('wave-layer wave-lit', { lit: true, read: true })}
              </>
            )}
          >
            <span aria-hidden="true" data-signal data-playhead-read className="wave-playhead" />
            {hover !== null && (
              <span aria-hidden="true" data-playhead-read className="wave-ghost">
                <span data-numeric className="readout surface-control rounded-full px-1.5 py-0.5 text-ink">
                  {formatLength(hover * a.ms)}
                </span>
              </span>
            )}
            <input
              type="range"
              min={0}
              max={1000}
              value={length ? Math.round((second / length) * 1000) : 0}
              disabled={unplayable}
              onChange={(event) => seekTo((Number(event.target.value) / 1000) * length)}
              onKeyDown={keys}
              aria-label={`Playhead, ${file.name}`}
              aria-valuetext={`${formatLength(second * 1000)} of ${formatLength(a.ms)}`}
              className="wave-range"
            />
          </WaveBars>
        </div>
        <span data-numeric className="w-10 shrink-0 text-xs text-ink-muted">
          {formatLength(a.ms)}
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        {skip(-10)}
        <button
          type="button"
          onClick={toggle}
          disabled={unplayable}
          aria-label={playing ? 'Pause' : 'Play'}
          className="accent-fill press flex size-14 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
        >
          {playing ? (
            <Pause size={22} aria-hidden="true" fill="currentColor" />
          ) : (
            <Play size={22} aria-hidden="true" fill="currentColor" className="translate-x-[1.5px]" />
          )}
        </button>
        {skip(10)}
      </div>
      {unplayable && <p role="status" className="text-[0.8125rem] text-ink-muted">This browser can’t play this format.</p>}
    </section>
  )
}

function Read({ file, a, onAnother }: { file: File; a: Measured; onAnother?: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [file])
  // What you'd ask first (the song, its format and length) up front; the file's specs one layer down, under (i).
  const title = file.name.replace(/\.[^.]+$/, '')
  const specs = [a.format.bits && `${a.format.bits}-bit`, `${Math.round(a.format.rate / 100) / 10} kHz`, sizeOf(file.size)]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Music size={22} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2
            ref={ref}
            tabIndex={-1}
            title={file.name}
            className="truncate font-display text-2xl font-semibold leading-tight tracking-tight text-ink outline-hidden"
          >
            {title}
          </h2>
          <p data-numeric className="readout flex items-center gap-2 text-ink-muted">
            <span>
              {formatOf(file.name)} · {formatLength(a.ms)}
            </span>
            <Tip label={specs} side="bottom" toggle>
              <button
                type="button"
                aria-label={`File details: ${specs}`}
                className="press -m-3 flex size-11 items-center justify-center rounded-full text-ink-muted hover:text-accent"
              >
                <Info size={14} aria-hidden="true" />
              </button>
            </Tip>
          </p>
        </div>
        {onAnother && (
          <Button onClick={onAnother} className="shrink-0">
            <FileAudio size={16} aria-hidden="true" />
            Measure another
          </Button>
        )}
      </header>
      <p role="status" className="sr-only">
        Measured. {a.lufs === null ? 'Silent' : `${reading(a.lufs)} LUFS`}, {reading(a.truePeak, 1, true)} dB true peak.
      </p>
      <Listen file={file} a={a} />
      <Reading a={a} name={file.name} />
    </div>
  )
}

/** Blue Hour or Daylight for this device, on this origin; the system's until chosen. */
function ModeSwitch() {
  // Subscribes to the choice; what's shown is read from <html>, where the boot script resolved "system".
  const { setTheme } = useAppearance()
  const daylight = document.documentElement.dataset.theme === 'daylight'
  return (
    <IconSwitch
      checked={daylight}
      onCheckedChange={(on) => setTheme(on ? 'daylight' : 'blue-hour')}
      aria-label="Daylight"
    >
      {daylight ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
    </IconSwitch>
  )
}
