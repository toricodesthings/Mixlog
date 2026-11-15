import { motion } from 'framer-motion'
import { createContext, use, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'

import { useListening } from '../../hooks/ui/use-listening'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { SPRINGS } from '../../lib/constants/motion'
import { cn } from '../../lib/utils'
import { Tip } from '../primitives'
import { SEGMENT_FILL } from '../primitives/SegmentedControl'
import { other, releaseOf, type Side } from './ab'
import { Fetching } from './controls'
import { useListenParam, usePlayer } from './Player'

/** Each side's colour: A the room's accent, B its counterpoint (the manifesto's "other side of an A/B"). */
export const TONE: Record<Side, string> = { a: 'var(--accent)', b: 'var(--accent-secondary)' }

/**
 * Switching, one action in three places (a record, the A | B switch, a key): the sound changes on press-down, never on
 * release; on release, a press held under 300 ms stays (latched), a longer one goes back (momentary, a DAW's solo).
 * Hold is an addition: a keyboard, screen reader or switch control always has the tap, and Settings can turn it off. A
 * hold that turns into a drag (past 12 px) belongs to the sheet or the dock, and goes back. `via` is how the last switch
 * came: keys land at once. One for the whole app (`AuditionProvider`), so A, B and X work on any page while split.
 */
function useAudition(onLatched: (side: Side) => void) {
  const player = usePlayer()
  const { hold } = useListening()
  const down = useRef<{ at: number; before: Side; to: Side } | null>(null)
  const from = useRef<{ x: number; y: number } | null>(null)
  const [via, setVia] = useState<'pointer' | 'key'>('pointer')
  const live = player.ab?.live ?? 'a'

  const start = (side: Side) => {
    down.current = { at: performance.now(), before: live, to: side }
    player.listen(side)
  }
  const release = (side: Side, cancelled = false) => {
    const d = down.current
    down.current = null
    if (!d || d.before === side) return
    if (cancelled || releaseOf(d.at, performance.now(), hold) === 'back') player.listen(d.before)
    else onLatched(side)
  }

  // A, B pick a side; X switches, and held, auditions the other one. Not while typing (the picker's search), in a menu
  // or tabs, or in another dialog (the room, which is the player, keeps them): the rule Space follows.
  const keyed = useRef({ start, release, live, listen: player.listen, onLatched })
  keyed.current = { start, release, live, listen: player.listen, onLatched }
  const enabled = player.ab !== null && player.ab.b !== null
  useEffect(() => {
    if (!enabled) return
    const typing = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return true
      const target = e.target as Element | null
      if (!target?.closest) return false
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="listbox"], [role^="menu"], [role="tablist"]')) return true
      return Boolean(target.closest('[role="dialog"]') && !target.closest('[data-listening-room]'))
    }
    const onDown = (e: KeyboardEvent) => {
      if (typing(e) || e.defaultPrevented) return
      const key = e.key.toLowerCase()
      if (key !== 'a' && key !== 'b' && key !== 'x') return
      e.preventDefault()
      if (e.repeat) return
      setVia('key')
      const k = keyed.current
      if (key === 'x') return k.start(other(k.live))
      if (key !== k.live) k.listen(key), k.onLatched(key)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'x' || typing(e)) return
      // The side X went to, which may still be getting ready (so not yet the one you hear)
      keyed.current.release(down.current?.to ?? keyed.current.live)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => (window.removeEventListener('keydown', onDown), window.removeEventListener('keyup', onUp))
  }, [enabled])

  /** The handlers for a control that switches to `side`. */
  const bind = (side: Side) => ({
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return
      // Captured, so the release always comes back here, even off the control (else a hold stays latched, and a
      // later hover reads as a drag)
      e.currentTarget.setPointerCapture?.(e.pointerId)
      from.current = { x: e.clientX, y: e.clientY }
      setVia('pointer')
      start(side)
    },
    onPointerMove: (e: PointerEvent) => {
      if (from.current && Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) > 12) (from.current = null), release(side, true)
    },
    onPointerUp: () => from.current && ((from.current = null), release(side)),
    onPointerCancel: () => from.current && ((from.current = null), release(side, true)),
    // Enter or Space (no pointer): a tap
    onClick: (e: { detail: number }) => {
      if (e.detail !== 0) return
      setVia('key')
      if (side !== live) player.listen(side), onLatched(side)
    },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  })
  return { bind, via }
}

const AuditionContext = createContext<(ReturnType<typeof useAudition> & { said: string }) | null>(null)

/** The one audition (inside PlayerProvider, layout/AppShell): every switch shares it, and it says each latched side
 *  aloud. The room is a modal dialog that hides the rest of the app from a screen reader, so while it's open the room
 *  says it (`Said`), and this otherwise. */
export function AuditionProvider({ children }: { children: ReactNode }) {
  const player = usePlayer()
  const { open } = useListenParam()
  const [said, setSaid] = useState('')
  const audition = useAudition((side) => {
    const deck = player.ab?.[side]
    if (deck) setSaid(`${side.toUpperCase()} · ${deck.label.split(' · ')[0]}`)
  })
  return (
    <AuditionContext value={{ ...audition, said }}>
      {children}
      {!open && <p aria-live="polite" className="sr-only">{said}</p>}
    </AuditionContext>
  )
}

export function useAuditionContext() {
  const audition = use(AuditionContext)
  if (!audition) throw new Error('useAuditionContext needs an AuditionProvider (layout/AppShell)')
  return audition
}

/** The latched side, said inside the listening room. */
export function Said() {
  return <p aria-live="polite" className="sr-only">{useAuditionContext().said}</p>
}

/**
 * The A | B switch on the room's centre axis: a monitor controller's source switch, with SegmentedControl's look and
 * gliding lens (in the side's colour), but its own buttons: that control scrubs under the finger, which would fight a
 * hold. Each half is a pressed button with its key in the tip. `room`: the room's, the second control after Play; `bar`:
 * the player bar's and the mini player's, while the room is lowered.
 */
export function ABSwitch({ size = 'room', className, style }: { size?: 'room' | 'bar'; className?: string; style?: CSSProperties }) {
  const { ab } = usePlayer()
  const { bind, via } = useAuditionContext()
  const { isCompact } = useShellMode()
  if (!ab) return null
  const live = ab.live
  const bar = size === 'bar'
  // Concentric: the lens's radius is the container's less its padding and border
  const lens = bar ? 'rounded-[7px]' : 'rounded-[9px]'
  return (
    <div
      role="group"
      aria-label="Listen to"
      style={style}
      className={cn(
        'ab-switch surface-control relative inline-grid grid-cols-2 border border-line/30 p-0.5',
        bar ? 'h-9 w-24 rounded-[10px]' : cn('h-12 rounded-xl', isCompact ? 'w-full max-w-[21rem]' : 'w-40'),
        className,
      )}
    >
      <motion.span
        aria-hidden="true"
        className={cn('glass-edge pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] border [--edge-strength:0.6]', lens, SEGMENT_FILL)}
        style={{ '--segment-tone': TONE[live] } as CSSProperties}
        initial={false}
        // A whole transform, not `x`: the compositor runs it, so the glide stays smooth while the room is busy playing
        animate={{ transform: live === 'a' ? 'translateX(0%)' : 'translateX(100%)' }}
        transition={via === 'key' ? { duration: 0 } : SPRINGS.SNAP}
      />
      {(['a', 'b'] as const).map((side) => {
        const deck = ab[side]
        const name = side.toUpperCase()
        return (
          <Tip key={side} label={`Key ${name} · X switches`}>
            <button
              type="button"
              aria-pressed={live === side}
              aria-busy={ab.pending === side || undefined}
              aria-label={deck ? `Listen to ${name}: ${deck.label}` : `${name}: nothing picked yet`}
              disabled={!deck}
              {...bind(side)}
              className={cn(
                'ab-press press relative z-[1] flex items-center justify-center font-display font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:text-ink-muted',
                lens,
                bar ? 'text-sm' : 'text-xl',
                live === side ? 'text-[var(--tone)]' : 'text-ink-soft enabled:hover:text-ink',
              )}
              style={{ '--tone': TONE[side] } as CSSProperties}
            >
              {name}
              {ab.pending === side && <Fetching side={side} className={cn('absolute text-[var(--tone)]', bar ? 'right-1 size-3' : 'right-1.5 size-4')} />}
            </button>
          </Tip>
        )
      })}
    </div>
  )
}
