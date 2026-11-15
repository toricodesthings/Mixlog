import { useNavigate, useSearch } from '@tanstack/react-router'
import { Maximize2, MoveHorizontal, Scan, ZoomIn, ZoomOut, type LucideIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'

import { cn } from '../../lib/utils'
import { Button, Tip } from '../primitives'
import { Dialog, DialogCloseButton, DialogContent, DialogTitle } from '../primitives/Dialog'

/**
 * Something looked at full size (a license, a cover, a portrait), over the page and dimming it. On a phone it's the
 * Photos viewer: the thing edge to edge, its controls floating glass over it, the top fading into it as it scrolls
 * under, the title (its `name`) dead centre. Wider, it's a framed panel like Settings, with a plain header.
 */
export function Viewer({ kind, name, icon: Icon, readout, band, status, actions, onClose, children }: {
  /** What it is ("License"): before the name on a wide screen, said to a screen reader on a phone. */
  kind: string
  name?: string
  icon: LucideIcon
  readout: ReactNode
  /** Under the title on a phone, beside it wider: a version switch. */
  band?: ReactNode
  status?: ReactNode
  /** `ViewerButton`s: a glass capsule on a phone. Two at most, so the title stays centred. */
  actions: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        className="inset-0 flex h-auto max-h-none w-auto max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 max-sm:border-0 !bg-panel-raised ![backdrop-filter:none] max-sm:!bg-room-void sm:inset-4 sm:mx-auto sm:w-auto sm:max-w-[75rem] sm:translate-x-0 sm:translate-y-0 sm:rounded-[2rem]"
      >
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line/70 px-3 py-3 max-sm:pointer-events-none max-sm:absolute max-sm:inset-x-0 max-sm:top-0 max-sm:z-10 max-sm:border-0 max-sm:bg-linear-to-b max-sm:from-room-void max-sm:via-room-void/85 max-sm:to-transparent max-sm:pt-[max(0.75rem,env(safe-area-inset-top))] max-sm:pb-6 sm:flex-nowrap sm:px-5 [&>*]:pointer-events-auto">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-dim text-accent max-sm:hidden">
            <Icon size={18} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 max-sm:items-center max-sm:text-center">
            <DialogTitle className="max-w-full truncate font-display text-lg font-semibold tracking-tight max-sm:text-base">
              <span className={name ? 'max-sm:sr-only' : undefined}>{kind}{name ? ' · ' : ''}</span>
              {name}
            </DialogTitle>
            <p className="readout max-w-full truncate text-ink-muted">{readout}</p>
          </div>
          {band && (
            <span className="flex shrink-0 justify-center max-sm:order-last max-sm:basis-full">
              <span className="max-sm:surface-floating max-sm:rounded-[0.875rem] max-sm:p-0.5">{band}</span>
            </span>
          )}
          {status}
          {/* A phone's sides are the same width, so the title sits dead centre between them. */}
          <span className="flex shrink-0 items-center justify-end gap-2 max-sm:w-24">
            <span className="flex items-center gap-2 max-sm:surface-floating max-sm:gap-0 max-sm:rounded-full max-sm:p-0.5">{actions}</span>
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-line-light max-sm:hidden" />
          </span>
          <span className="flex shrink-0 max-sm:order-first max-sm:w-24">
            <DialogCloseButton aria-label={`Close the ${kind.toLowerCase()}`} className="rounded-full border border-line-light opacity-100 max-sm:surface-floating max-sm:size-[3.125rem] max-sm:text-ink" />
          </span>
        </header>
        {/* `--chrome`: how far a phone's floating header reaches down, for content that starts below it. */}
        <div className="relative min-h-0 flex-1 bg-room-void" style={{ '--chrome': band ? '7.75rem' : '4.75rem' } as CSSProperties}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** One of a viewer's actions: a word and its icon wide, the icon alone (named) narrower; a link when it has `href`. */
export function ViewerButton({ icon: Icon, label, name = label, href, download, variant = 'secondary', className, ...props }: {
  icon: LucideIcon
  label: string
  /** The full name, when the label is short for it ("Download" for "Download cover.png"). */
  name?: string
  href?: string
  download?: string
  variant?: 'ghost' | 'secondary'
  className?: string
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const body = (
    <>
      <Icon size={16} aria-hidden="true" />
      <span className="max-md:hidden">{label}</span>
    </>
  )
  const look = cn('gap-1.5 max-md:w-11 max-md:px-0 max-sm:rounded-full max-sm:border-transparent max-sm:bg-transparent max-sm:shadow-none', className)
  return href ? (
    <Button asChild variant={variant} className={look}>
      <a href={href} download={download} aria-label={name}>{body}</a>
    </Button>
  ) : (
    <Button type="button" variant={variant} aria-label={name} className={look} {...props}>{body}</Button>
  )
}

/** The round glass button on a cover or portrait that opens it full size. */
export function ViewButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <Tip label={label}>
      <button type="button" onClick={onClick} aria-label={label} className={cn('press surface-floating flex size-9 cursor-pointer items-center justify-center rounded-full text-ink pointer-coarse:size-11', className)}>
        <Maximize2 size={15} aria-hidden="true" />
      </button>
    </Tip>
  )
}

/** `?full` opens a page's own thing full size, so a refresh lands on it and Back closes it. */
export function useFullParam() {
  const navigate = useNavigate()
  type Search = { full?: true }
  return {
    open: useSearch({ strict: false }).full === true,
    show: () => navigate({ to: '.', search: (prev: Search) => ({ ...prev, full: true as const }), resetScroll: false }),
    close: () => navigate({ to: '.', search: ({ full: _, ...rest }: Search) => rest, resetScroll: false }),
  }
}
export const fullSearch = (search: Record<string, unknown>): { full?: true } => (search.full === true ? { full: true } : {})

/** Zoom stops, as a share of the thing's own size. */
const STOPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl '

/**
 * Zoom for what's in `scroller`, `size` at scale 1. `fit` starts it fitted (`width`: a document's pages; `contain`:
 * a picture, never past its own pixels). `unit` is the scale said as 100%. −/+ step through the stops, as do
 * ⌘/Ctrl −, + and 0 (the viewer's, not the app's) and a trackpad pinch, and zooming holds what's mid-view in place.
 */
export function useZoom(scroller: RefObject<HTMLDivElement | null>, size: { width: number; height: number } | null, fit: 'width' | 'contain', unit = 1) {
  const [room, setRoom] = useState({ width: 0, height: 0 }) // the view, less its margins
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const anchor = useRef<{ x: number; y: number } | null>(null)

  const fitted = !size || !room.width ? 0 : fit === 'width' ? room.width / size.width : Math.min(room.width / size.width, room.height / size.height, unit)
  const scale = zoom === 'fit' ? fitted : zoom * unit
  const shown = scale / unit

  useEffect(() => {
    const el = scroller.current!
    const observer = new ResizeObserver(() => {
      const margin = el.clientWidth < 640 ? 32 : 64
      setRoom({ width: el.clientWidth - margin, height: el.clientHeight - margin })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [scroller])

  const zoomTo = (next: number | 'fit') => {
    const el = scroller.current!
    anchor.current = { x: (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth, y: (el.scrollTop + el.clientHeight / 2) / el.scrollHeight }
    setZoom(next === 'fit' ? next : Math.min(STOPS.at(-1)!, Math.max(STOPS[0], next)))
  }
  const step = (way: 1 | -1) => zoomTo((way > 0 ? STOPS.find((s) => s > shown + 0.01) : [...STOPS].reverse().find((s) => s < shown - 0.01)) ?? shown)

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || !anchor.current) return
    el.scrollLeft = anchor.current.x * el.scrollWidth - el.clientWidth / 2
    el.scrollTop = anchor.current.y * el.scrollHeight - el.clientHeight / 2
    anchor.current = null
  }, [scale, scroller])

  const live = useRef({ shown, step, zoomTo })
  live.current = { shown, step, zoomTo }
  useEffect(() => {
    const el = scroller.current!
    const key = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '=' || e.key === '+') live.current.step(1)
      else if (e.key === '-') live.current.step(-1)
      else if (e.key === '0') live.current.zoomTo('fit')
      else return
      e.preventDefault()
    }
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      live.current.zoomTo(live.current.shown * Math.exp(-e.deltaY * 0.01))
    }
    window.addEventListener('keydown', key)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => (window.removeEventListener('keydown', key), el.removeEventListener('wheel', wheel))
  }, [scroller])

  return { scale, shown, fitted: zoom === 'fit', step, zoomTo, fitLabel: fit === 'width' ? 'Fit to width' : 'Fit to screen' }
}

/** The floating glass bar at the foot of a viewer: its tools, shown once there's something to use them on. */
export function ViewerBar({ shown = true, children }: { shown?: boolean; children: ReactNode }) {
  return (
    <div role="toolbar" aria-label="View" className={cn('surface-floating absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full p-1 transition-opacity duration-(--duration-normal)', shown ? 'opacity-100' : 'pointer-events-none opacity-0')}>
      {children}
    </div>
  )
}

/** One of the bar's round buttons, its name in a tip with its shortcut. */
export function ViewerTool({ label, keys, pressed, children, ...props }: { label: string; keys?: string; pressed?: boolean; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Tip label={keys ? `${label} · ${MOD}${keys}` : label} side="top">
      <button type="button" aria-label={label} aria-pressed={pressed} {...props} className={cn('flex size-9 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white/[0.08] hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent pointer-coarse:size-11', pressed && 'text-accent hover:text-accent')}>
        {children}
      </button>
    </Tip>
  )
}

export const ViewerDivider = () => <span aria-hidden="true" className="mx-1 h-5 w-px bg-line-light" />

/** − zoom +, and back to fitted: the bar's zoom group. The percentage goes to actual size. */
export function ZoomTools({ zoom }: { zoom: ReturnType<typeof useZoom> }) {
  return (
    <>
      <ViewerTool label="Zoom out" keys="−" onClick={() => zoom.step(-1)} disabled={zoom.shown <= STOPS[0] + 0.001}><ZoomOut size={16} /></ViewerTool>
      <button type="button" onClick={() => zoom.zoomTo(1)} aria-label="Actual size" data-numeric className="readout min-h-9 min-w-14 cursor-pointer rounded-full px-1 text-center text-ink-soft transition-colors hover:bg-white/[0.08] hover:text-ink pointer-coarse:min-h-11">
        {Math.round(zoom.shown * 100)}%
      </button>
      <ViewerTool label="Zoom in" keys="+" onClick={() => zoom.step(1)} disabled={zoom.shown >= STOPS.at(-1)! - 0.001}><ZoomIn size={16} /></ViewerTool>
      <ViewerTool label={zoom.fitLabel} keys="0" onClick={() => zoom.zoomTo('fit')} pressed={zoom.fitted}>{zoom.fitLabel === 'Fit to width' ? <MoveHorizontal size={16} /> : <Scan size={16} />}</ViewerTool>
    </>
  )
}

/**
 * A picture full size: fitted to the screen (never past its own pixels), centred on the desk, zoomable. It fades in
 * once loaded, and `onMeasured` gets its real size for the readout.
 */
export function ImageStage({ src, alt, onMeasured }: { src: string; alt: string; onMeasured?: (size: { width: number; height: number }) => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const zoom = useZoom(scroller, size, 'contain')
  return (
    <div className="relative size-full">
      <div ref={scroller} className="size-full overflow-auto overscroll-contain [scrollbar-gutter:stable_both-edges]">
        <div className="mx-auto flex min-h-full w-fit min-w-full items-center justify-center p-4 sm:p-8">
          <img
            src={src}
            alt={alt}
            decoding="async"
            onLoad={(e) => {
              const next = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }
              setSize(next)
              onMeasured?.(next)
            }}
            style={size ? { width: Math.round(size.width * zoom.scale), height: Math.round(size.height * zoom.scale) } : { width: 1, height: 1 }}
            className={cn('block max-w-none shrink-0 rounded-md shadow-[0_18px_44px_-18px_rgb(0_0_0/0.6)] transition-opacity duration-(--duration-smooth)', size && zoom.scale ? 'opacity-100' : 'opacity-0')}
          />
        </div>
      </div>
      <ViewerBar shown={!!size}>
        <ZoomTools zoom={zoom} />
      </ViewerBar>
    </div>
  )
}
