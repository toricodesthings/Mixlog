import { useRouter } from '@tanstack/react-router'
import { useReducedMotionConfig } from 'framer-motion'
import { Clapperboard, Download, Pause, Play, Replace, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { CANVAS_ACCEPT, canvasProblem } from '#/server/files'
import type { TrackRow, VersionRow } from '#/server/releases'
import { useDropTarget } from '../../hooks/ui/use-drop-target'
import { downloadUrl, fileUrl, uploadCanvas } from '../../lib/files'
import { cn } from '../../lib/utils'
import { Button, Led, Tip, Transfer } from '../primitives'
import { MetaLine } from '../shared/MetaLine'
import type { ReleaseData } from './loaders'
import { sectionOf } from './sections'

/** Spotify's Canvas: a loop of 3 to 8 seconds, 9:16. Measured and said as facts; never enforced. */
const SPEC = { min: 3, max: 8, ratio: 9 / 16 }

/** The frame's own controls, glass over the loop: big enough for a thumb, quiet enough to watch through. */
const GLASS_BUTTON = 'glass flex size-9 items-center justify-center rounded-full text-ink opacity-85 transition-opacity hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40 pointer-coarse:size-11'

/** Every track's Canvas, side by side like phones on a desk. A single's release is its track: one frame. */
export function CanvasSection({ release, tracks, versions }: ReleaseData) {
  const single = release.format === 'single'
  return (
    <section aria-labelledby="canvas" className="surface-card glass-edge flex flex-col gap-4 rounded-[2rem] p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id="canvas" className="font-display text-xl font-semibold tracking-tight">Canvas</h2>
        <p className="readout text-ink-muted">MP4 · 3–8 s · 9:16</p>
      </div>
      {tracks.length === 0 ? (
        <p className="px-1 text-sm text-ink-muted">Each track gets its own Canvas once the release has tracks.</p>
      ) : (
        <ul className={cn('grid gap-4', single ? 'max-w-60' : 'grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]')}>
          {tracks.map((track, i) => (
            <li key={track.id} className="min-w-0">
              <CanvasFrame track={track} number={single ? null : i + 1} released={sectionOf(release) === 'released'} versions={versions.filter((v) => v.track_id === track.id && v.kind === 'canvas')} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type Shape = { seconds: number; width: number; height: number }

/**
 * One track's Canvas in a phone-shaped frame, looping muted the way Spotify plays it (held still, with Play, when motion
 * is reduced). Click or drop an MP4 on the frame: in Upcoming it's the next version, every earlier one kept; in
 * Releases the slot holds one, so a new one asks first, naming both files.
 */
function CanvasFrame({ track, number, released, versions }: { track: TrackRow; number: number | null; released: boolean; versions: VersionRow[] }) {
  const router = useRouter()
  const reduced = Boolean(useReducedMotionConfig())
  const picker = useRef<HTMLInputElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const current = versions.find((v) => v.is_current) ?? null
  const [shape, setShape] = useState<{ id: string } & Shape | null>(null)
  const [playing, setPlaying] = useState(!reduced)
  const [sent, setSent] = useState<number | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<File | null>(null)

  const send = async (file: File, replaces?: string) => {
    setConfirm(null)
    setProblem(null)
    setSent(0)
    try {
      await uploadCanvas(track.id, file, setSent, replaces)
      await router.invalidate()
    } catch (error) {
      setProblem((error instanceof Error && error.message) || 'Couldn’t add the Canvas. Try again.')
    } finally {
      setSent(null)
    }
  }
  const take = (files: File[]) => {
    if (files.length > 1) return setProblem('One Canvas at a time: drop a single MP4.')
    const file = files[0]
    if (!file) return
    const issue = canvasProblem(file.type || (file.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : null), file.size)
    if (issue) return setProblem(issue)
    // Releases keep one per track: replacing asks first.
    if (released && current) return (setProblem(null), setConfirm(file))
    void send(file)
  }
  const busy = sent !== null
  const drop = useDropTarget({ onFiles: take, enabled: !busy })
  const toggle = () => {
    const el = video.current
    if (!el) return
    if (el.paused) void el.play().then(() => setPlaying(true)).catch(() => {})
    else (el.pause(), setPlaying(false))
  }
  const measured = shape && current && shape.id === current.id ? shape : null
  const facts = measured
    ? [`${measured.seconds.toFixed(1)} s`, ratioOf(measured), `${measured.width}×${measured.height}`]
    : []
  const offSpec = measured
    ? [
        (measured.seconds < SPEC.min || measured.seconds > SPEC.max) && 'Spotify plays 3–8 s',
        Math.abs(measured.width / measured.height - SPEC.ratio) > 0.01 && 'Spotify wants 9:16',
      ].filter((note): note is string => Boolean(note))
    : []
  const label = current ? (released ? 'Replace the Canvas' : 'Add a new version') : 'Add a Canvas'

  return (
    <div className="flex flex-col gap-2.5">
      <div
        {...drop.props}
        data-meter-host
        className={cn(
          'group relative aspect-[9/16] w-full overflow-hidden rounded-[1.6rem] border bg-room-void shadow-[0_18px_40px_-24px_rgb(0_0_0/0.7)] transition-[border-color,box-shadow] duration-(--duration-normal)',
          current ? 'border-line-light' : 'border-dashed border-line-strong',
          drop.over && 'border-accent glow-accent',
        )}
      >
        {current ? (
          <>
            <video
              key={current.id}
              ref={video}
              src={fileUrl(current.id)}
              muted
              loop
              playsInline
              autoPlay={!reduced}
              preload="auto"
              aria-label={`${track.title}’s Canvas`}
              onLoadedMetadata={(e) => setShape({ id: current.id, seconds: e.currentTarget.duration, width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight })}
              className="size-full object-cover"
            />
            {/* The scrim and the title sit over the loop the way a phone shows it, whatever the theme. */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-3 truncate font-display text-sm font-semibold text-white drop-shadow">
              {track.title}
            </span>
            <span className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
              <Tip label={playing ? 'Pause the loop' : 'Play the loop'}>
                <button type="button" onClick={toggle} aria-label={playing ? 'Pause the loop' : 'Play the loop'} className={GLASS_BUTTON}>
                  {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" className="translate-x-px" />}
                </button>
              </Tip>
              <Tip label={label}>
                <button type="button" onClick={() => picker.current?.click()} disabled={busy} aria-label={label} className={GLASS_BUTTON}>
                  {released ? <Replace size={14} aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                </button>
              </Tip>
              <Tip label={`Download ${current.filename}`}>
                <a href={downloadUrl(current.id)} download aria-label={`Download ${current.filename}`} className={GLASS_BUTTON}>
                  <Download size={14} aria-hidden="true" />
                </a>
              </Tip>
            </span>
          </>
        ) : (
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={busy}
            className="press flex size-full flex-col items-center justify-center gap-3 px-4 text-center transition-colors hover:bg-accent-dim focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-white/[0.05] text-accent">
              <Clapperboard size={20} aria-hidden="true" />
            </span>
            <span className="font-display text-[0.9375rem] font-semibold text-ink">{drop.over ? 'Let go to add it' : 'Add a Canvas'}</span>
            <span className="text-[0.8125rem] text-ink-muted">Click, or drop an MP4</span>
          </button>
        )}
        {busy && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-room-void/70">
            <Transfer direction="up" value={sent} label="Sending the Canvas" className="text-4xl" />
            <span className="readout text-ink-soft">{Math.round(sent * 100)}%</span>
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5 px-1">
        {(number !== null || current) && (
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
            {number !== null && <span className="readout shrink-0 text-accent">{String(number).padStart(2, '0')}</span>}
            <span className="truncate">{number !== null ? track.title : released ? 'Canvas' : `Canvas v${current!.number}`}</span>
          </p>
        )}
        {current && <MetaLine wrap facts={[number !== null && !released ? `v${current.number}` : null, ...facts]} className="text-[0.8125rem] [&_.break-words]:whitespace-nowrap" />}
        {offSpec.map((note) => (
          <p key={note} className="flex items-start gap-1.5 text-[0.8125rem] leading-snug text-ink-soft">
            <Led tone="tube" className="mt-1.5" />
            {note}
          </p>
        ))}
      </div>

      {confirm && current && (
        <div role="alertdialog" aria-label="Replace the Canvas" className="surface-item flex flex-col gap-2.5 rounded-2xl p-3">
          <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
            Replace <span className="font-semibold text-ink">{current.filename}</span> with <span className="font-semibold text-ink">{confirm.name}</span>? The old one is erased once the new one is stored.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>Keep it</Button>
            <Button size="sm" onClick={() => void send(confirm, current.id)}>Replace</Button>
          </div>
        </div>
      )}
      {problem && <p role="alert" className="px-1 text-[0.8125rem] text-feedback-error">{problem}</p>}
      <input ref={picker} type="file" accept={CANVAS_ACCEPT} hidden onChange={(e) => (take([...(e.target.files ?? [])]), (e.target.value = ''))} />
    </div>
  )
}

/** 9:16 when it is (within a pixel or two); otherwise the shape as width:height, reduced. */
function ratioOf({ width, height }: Shape) {
  if (!width || !height) return null
  if (Math.abs(width / height - SPEC.ratio) <= 0.01) return '9:16'
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  const d = gcd(width, height)
  return `${width / d}:${height / d}`
}
