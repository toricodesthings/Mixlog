import type { LinkOptions } from '@tanstack/react-router'
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { createContext, use, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'

import { matchOf, type Fingerprint } from '#/server/loudness'
import { ceilingOf, useListening } from '../../hooks/ui/use-listening'
import { fileUrl } from '../../lib/files'
import { clampTo, driftedOf, gainOf, other, putOf, type Side } from './ab'
import { drive, setGain, tap } from './signal'

/**
 * What's playing, named the way it's said ("Night Drive", "Master v4 · WAV", "Uploaded Oct 12" or "Released Oct 12"),
 * with what its room needs: the release's title (its colours stand in for the artwork's) and artwork, and the way back.
 */
export type Playable = {
  versionId: string
  title: string
  /** What the artist called this file (its note, or its filename): the words they'd know it by. */
  name: string
  label: string
  day: string
  released: boolean
  release: string
  releaseId: string
  artworkId: string | null
  link: LinkOptions
  /** Its integrated loudness (LUFS), for A/B's Level match; null until measured. */
  lufs: number | null
  /** The song's loudness for its LoudnessWave (the meter's 256 bars, its length, where it's loudest); null until measured. */
  wave: Wave | null
  /** Its own night (1.3.0): the track's id as the scene's seed, and its fingerprint (null before anything's measured). */
  sceneId: string
  scene: Fingerprint | null
}

export type Wave = { bars: number[]; ms: number; loudestMs: number | null }

/** A/B, while the room is split: what's on each side (B empty until picked), which side you hear, a side still
 *  getting ready to take over (`pending`: never switch into silence), and Level match's trims in dB (null while it's
 *  off or a side isn't measured). */
export type AB = { a: Playable; b: Playable | null; live: Side; pending: Side | null; trim: { a: number; b: number } | null }

type PlayerState = {
  /** What you hear: the one deck, or A/B's live side. */
  item: Playable | null
  playing: boolean
  /** Asked to play, still waiting for the file to arrive (starting, or a seek past what's here). */
  loading: boolean
  volume: number
  muted: boolean
  /** Plays `item`; the one already loaded toggles instead. `at` starts it from a share of the way through (0–1). While
   *  split, it replaces the side you hear (another release's version, or a released one, leaves A/B first). */
  play: (item: Playable, options?: { at?: number }) => void
  toggle: () => void
  stop: () => void
  /** Jumps to a share of the way through (0–1). */
  seek: (share: number) => void
  /** Jumps to `seconds` on `side` (the one you hear by default); under Sync, both decks move. */
  seekTo: (seconds: number, side?: Side) => void
  /** Moves the playhead by seconds, back when negative. */
  skip: (seconds: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  /** A/B: null unless split. The split is the player's, so it outlives the room; the URL mirrors it while it's open. */
  ab: AB | null
  /** Splits the room: what's playing goes on A, `b` (or nothing yet) on B. Already split, it puts `b` on B. */
  compare: (b: Playable | null) => void
  /** Back to one record: whatever you hear keeps playing and becomes it. */
  uncompare: () => void
  /** Puts a version on a side; the other side's own version swaps the two (one file on both compares nothing). */
  put: (side: Side, item: Playable) => void
  /** Hear `side`: at once if it's ready, else as soon as it is, the other playing until then. */
  listen: (side: Side) => void
  /** Whether this device lets a page set an <audio>'s volume (iPhone doesn't): Level match's trim needs it on touch. */
  canTrim: boolean
}

/** Where the playhead is, in seconds, and how far past it the file has arrived (`buffered`). Its own context: it
 *  changes every frame, and only what shows time listens. */
type Playhead = { time: number; duration: number; buffered: number }

/** How close the waiting is to over: the next few seconds arriving fill it. ponytail: browsers don't say how much they
 *  wait for before they play, so this guesses a few seconds; it can sit full a beat before playback starts. */
export const readiness = ({ time, buffered }: Playhead) => Math.min(1, Math.max(0, (buffered - time) / 4))

const PlayerContext = createContext<PlayerState | null>(null)
const NO_TIME: Playhead = { time: 0, duration: 0, buffered: 0 }
const PlayheadContext = createContext<{ live: Playhead; a: Playhead; b: Playhead }>({ live: NO_TIME, a: NO_TIME, b: NO_TIME })

export function usePlayer() {
  const player = use(PlayerContext)
  if (!player) throw new Error('usePlayer needs a PlayerProvider (layout/AppShell)')
  return player
}

/** The playhead you hear, or one deck's while split. */
export const usePlayhead = (side?: Side) => use(PlayheadContext)[side ?? 'live']

/** The decks, as one value so a swap or a hand-over lands in one render (an <audio>'s `src` never flickers). `flip`:
 *  A plays on the second <audio>, so leaving A/B on B, or swapping, never reloads a file. */
type Decks = { a: Playable | null; b: Playable | null; split: boolean; flip: boolean; live: Side }
const EMPTY: Decks = { a: null, b: null, split: false, flip: false, live: 'a' }

/** Whether `volume` sticks here. ponytail: iPhone Safari ignores it (long-standing); unverified on a real device (1.6.0
 *  P0), so it's read back once rather than assumed from the platform. */
function volumeSticks() {
  try {
    const probe = new Audio()
    probe.volume = 0.5
    return probe.volume === 0.5
  } catch {
    return false
  }
}

const ready = (el: HTMLAudioElement) => !el.paused && !el.seeking && el.readyState >= 3

/**
 * The one player: two <audio> in the shell, so playback never stops because you navigated. The second is A/B's: it has
 * no file and costs nothing until the room is split. Each plays the file exactly as uploaded (the Worker serves range
 * requests); only the side you hear is audible. Under Sync both run, and the silent one is pulled back whenever it
 * drifts, so a switch lands at the same moment with no gap. It tells the device what's playing, so the lock screen and
 * headphone buttons work too. The bar and the listening room (PlayerBar, ListeningRoom) are its faces.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const el0 = useRef<HTMLAudioElement>(null)
  const el1 = useRef<HTMLAudioElement>(null)
  // One array for the life of the player: a new one each render would rebuild the clock's listeners on every change
  const els = useMemo(() => [el0, el1] as [typeof el0, typeof el1], [])
  const [decks, setDecks] = useState<Decks>(EMPTY)
  const now = useRef(decks)
  const update = (next: Decks) => ((now.current = next), setDecks(next))
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<Side | null>(null)
  const pendingRef = useRef<Side | null>(null)
  const [volume, setVolumeState] = useState(1)
  const [muted, setMutedState] = useState(false)
  const [canTrim] = useState(() => typeof window !== 'undefined' && volumeSticks())
  const prefs = useListening()

  const trim = decks.split && prefs.match && canTrim && decks.a && decks.b ? matchOf(decks.a.lufs, decks.b.lufs, ceilingOf(prefs)) : null
  /** What the gains read, kept current for the handlers that run between renders. */
  const live = useRef({ playing, volume, muted, sync: prefs.sync, trim })
  live.current = { playing, volume, muted, sync: prefs.sync, trim }

  /** Where each <audio> starts once its length is known (a share, or seconds under Sync), and whether it should play. */
  const startAt = useRef<[{ share?: number; seconds?: number } | null, { share?: number; seconds?: number } | null]>([null, null])
  const wants = useRef<[boolean, boolean]>([false, false])

  const engine = useMemo(() => {
    const index = (side: Side, d = now.current) => ((side === 'a') !== d.flip ? 0 : 1)
    const el = (side: Side) => (index(side) === 0 ? el0 : el1).current
    const sideAt = (i: number): Side => (index('a') === i ? 'a' : 'b')
    const refused = () => (setPlaying(false), setLoading(false))
    const wake = (a: HTMLAudioElement | null) => a && void a.play().catch(refused)

    /** Who's audible, and at what trim. Instant where Web Audio carries the sound (a ~10 ms ramp), `muted` elsewhere. */
    const apply = () => {
      const d = now.current
      const { volume, muted, trim } = live.current
      for (const side of ['a', 'b'] as const) {
        const a = el(side)
        if (!a) continue
        const audible = d.split ? side === d.live : side === 'a'
        const by = d.split && trim ? gainOf(trim[side]) : 1
        if (setGain(a, audible ? by : 0)) (a.muted = muted), (a.volume = volume)
        else (a.muted = muted || !audible), (a.volume = Math.min(1, volume * by))
      }
    }
    const commit = (side: Side) => {
      update({ ...now.current, live: side })
      pendingRef.current = null
      setPending(null)
      apply()
      if (!live.current.sync) el(other(side))?.pause()
    }
    const seekTo = (seconds: number, side: Side = now.current.live) => {
      const both = now.current.split && live.current.sync
      for (const s of both ? (['a', 'b'] as const) : [side]) {
        const a = el(s)
        if (a?.duration) a.currentTime = clampTo(seconds, a.duration)
      }
    }
    const toggle = () => {
      const d = now.current
      const heard = el(d.live)
      if (!heard) return
      if (!heard.paused) return void (el0.current?.pause(), el1.current?.pause())
      wake(heard)
      const idle = el(other(d.live))
      if (d.split && live.current.sync && idle?.src && idle.duration && heard.currentTime < idle.duration) {
        idle.currentTime = clampTo(heard.currentTime, idle.duration)
        wake(idle)
      }
    }
    /** Loads `item` on `side`; under Sync it starts where you are, else at its beginning (or `at`). */
    const load = (d: Decks, side: Side, item: Playable, play: boolean, at?: number) => {
      const i = index(side, d)
      const heard = el(d.live)
      startAt.current[i] = at !== undefined ? { share: at } : d.split && live.current.sync && heard ? { seconds: heard.currentTime } : null
      wants.current[i] = play
      return { ...d, [side]: item }
    }
    const put = (side: Side, item: Playable) => {
      const d = now.current
      const to = putOf({ a: d.a?.versionId ?? null, b: d.b?.versionId ?? null }, side, item.versionId)
      if (to === 'same' || to === 'refuse') return
      if (to === 'swap') {
        update({ ...d, a: d.b, b: d.a, flip: !d.flip })
        apply()
        // The side you hear is now the other <audio>: with Sync off it was resting, so it plays and the old one rests
        if (live.current.playing) {
          wake(el(d.live))
          if (!live.current.sync) el(other(d.live))?.pause()
        }
        return
      }
      const play = live.current.playing && (live.current.sync || side === d.live)
      if (side === d.live && play) setLoading(true)
      update(load(d, side, item, play))
    }
    const uncompare = () => {
      const d = now.current
      if (!d.split) return
      el(other(d.live))?.pause()
      pendingRef.current = null
      setPending(null)
      update(d.live === 'b' ? { a: d.b, b: null, split: false, flip: !d.flip, live: 'a' } : { ...d, b: null, split: false })
      apply()
    }
    /** Calls off a switch still waiting for its side; with Sync off, that side rests again. */
    const cancel = () => {
      const waiting = pendingRef.current
      if (!waiting) return
      pendingRef.current = null
      setPending(null)
      if (!live.current.sync) el(waiting)?.pause()
    }
    const listen = (side: Side) => {
      const d = now.current
      if (side === d.live) return cancel()
      if (!d.split || !d.b) return
      const target = el(side)
      const heard = el(d.live)
      if (!target || !heard) return
      if (!live.current.playing) return commit(side)
      if (target.paused) {
        if (live.current.sync && target.duration) target.currentTime = clampTo(heard.currentTime, target.duration)
        wake(target)
      }
      if (ready(target)) return commit(side)
      pendingRef.current = side
      setPending(side)
    }
    const state: PlayerState = {
      item: decks.split ? decks[decks.live] : decks.a,
      playing,
      loading,
      volume,
      muted,
      canTrim,
      ab: decks.split && decks.a ? { a: decks.a, b: decks.b, live: decks.live, pending, trim } : null,
      toggle,
      play: (next, { at } = {}) => {
        // A/B compares one release's versions: anything else (another release, a released slot) leaves it
        if (now.current.split && (next.released || next.releaseId !== now.current.a?.releaseId)) uncompare()
        const d = now.current
        const heard = d[d.live]
        if (next.versionId !== heard?.versionId) {
          if (d.split && d[other(d.live)]?.versionId === next.versionId) return listen(other(d.live))
          setLoading(true)
          return update(load(d, d.live, next, true, at))
        }
        if (at === undefined) return toggle()
        const a = el(d.live)
        if (a?.duration) seekTo(at * a.duration)
        if (a?.paused) toggle()
      },
      stop: () => (el0.current?.pause(), el1.current?.pause(), (pendingRef.current = null), setPending(null), update(EMPTY)),
      seek: (share) => {
        const a = el(now.current.live)
        if (a?.duration) seekTo(share * a.duration)
      },
      seekTo,
      skip: (seconds) => {
        const a = el(now.current.live)
        if (a?.duration) seekTo(a.currentTime + seconds)
      },
      setVolume: (next) => {
        live.current = { ...live.current, volume: next, muted: next === 0 }
        apply()
        setVolumeState(next)
        setMutedState(next === 0)
      },
      setMuted: (next) => {
        live.current = { ...live.current, muted: next }
        apply()
        setMutedState(next)
      },
      compare: (b) => {
        const d = now.current
        if (!d.a) return
        if (d.split) return b ? put('b', b) : undefined
        const play = live.current.playing && live.current.sync
        update(b ? load({ ...d, split: true, live: 'a' }, 'b', b, play) : { ...d, split: true, live: 'a', b: null })
      },
      uncompare,
      put,
      listen,
    }
    // The state, and what the <audio> events and effects below need
    return { state, apply, sideAt, el, commit, cancel }
  }, [decks, playing, loading, pending, volume, muted, canTrim, trim?.a, trim?.b])
  const { state } = engine

  // Space plays and pauses, ←/→ move 5 s, as in every music app and DAW: unless the key belongs to what has focus.
  const keyed = useRef(engine)
  keyed.current = engine
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !keyed.current.state.item) return
      const space = e.key === ' '
      if (!space && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const target = e.target as Element | null
      const own = 'input, textarea, select, [contenteditable="true"], [role="slider"], [role^="menu"], [role="listbox"], [role="tablist"], [role="toolbar"]'
      if (target?.closest?.(own)) return
      // A dialog keeps its keys (the room, which is the player, doesn't); a button or link keeps Space.
      if (target?.closest?.('[role="dialog"]') && !target.closest('[data-listening-room]')) return
      if (space && target?.closest?.('button, a, summary')) return
      e.preventDefault()
      if (space) keyed.current.state.toggle()
      else keyed.current.state.skip(e.key === 'ArrowLeft' ? -5 : 5)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A file just put on a deck: play it if it was asked to (React sets `src` first)
  useEffect(() => {
    ;[el0.current, el1.current].forEach((a, i) => {
      if (!a || !wants.current[i]) return
      wants.current[i] = false
      void a.play().catch(() => (setPlaying(false), setLoading(false)))
    })
  })

  // Who's audible follows every change, before the frame paints
  useLayoutEffect(() => engine.apply(), [engine])

  // The signal (signal.ts): while playing on a desktop, the meters and the listening room read the music. Both decks are
  // tapped (each through its own gain), then the gains are set at once, so the silent deck never leaks.
  useEffect(() => {
    if (!playing || !el0.current || !el1.current) return
    const analyser = tap(el0.current)
    if (analyser) tap(el1.current)
    keyed.current.apply()
    return analyser ? drive(analyser) : undefined
  }, [playing])

  // Sync: turned on, the silent deck moves to where you are and runs with it; off, it rests where it is.
  useEffect(() => {
    const d = now.current
    if (!d.split || !d.b) return
    const heard = engine.el(d.live)
    const idle = engine.el(other(d.live))
    if (!heard || !idle) return
    if (!prefs.sync) return void idle.pause()
    if (idle.duration) idle.currentTime = clampTo(heard.currentTime, idle.duration)
    if (!heard.paused && heard.currentTime < (idle.duration || Infinity)) void idle.play().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.sync])

  // The keeper: about four times a second, the silent deck is pulled back to the one you hear if it has drifted past
  // what anyone would hear on a switch. Only the silent one is ever moved, so a correction is never heard.
  useEffect(() => {
    if (!decks.split || !decks.b || !prefs.sync) return
    const heard = engine.el(decks.live)
    const idle = engine.el(other(decks.live))
    if (!heard || !idle) return
    const keep = () => {
      if (heard.paused || idle.seeking || !idle.duration) return
      if (idle.paused) {
        // Back inside its length after a seek: it joins again
        if (heard.currentTime < idle.duration - 0.25) (idle.currentTime = heard.currentTime), void idle.play().catch(() => {})
        return
      }
      if (driftedOf(heard.currentTime, idle.currentTime, idle.duration)) idle.currentTime = heard.currentTime
    }
    heard.addEventListener('timeupdate', keep)
    return () => heard.removeEventListener('timeupdate', keep)
  }, [decks.split, decks.b, decks.live, decks.flip, prefs.sync, engine])

  // The lock screen, the notification shade and headphone buttons: what you hear, and the same play, pause and seek as
  // the transport, so they respect Sync.
  const item = state.item
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = item
      ? new MediaMetadata({ title: item.title, artist: item.label, album: item.release, artwork: item.artworkId ? [{ src: fileUrl(item.artworkId) }] : [] })
      : null
    const p = () => keyed.current.state
    navigator.mediaSession.setActionHandler('play', item ? () => !p().playing && p().toggle() : null)
    navigator.mediaSession.setActionHandler('pause', item ? () => p().playing && p().toggle() : null)
    navigator.mediaSession.setActionHandler('seekbackward', item ? (details) => p().skip(-(details.seekOffset ?? 10)) : null)
    navigator.mediaSession.setActionHandler('seekforward', item ? (details) => p().skip(details.seekOffset ?? 10) : null)
    navigator.mediaSession.setActionHandler('seekto', item ? (details) => details.seekTime !== undefined && p().seekTo(details.seekTime) : null)
  }, [item])

  /** An <audio>'s events: only the side you hear moves `playing` and `loading`; a side waiting to take over takes it. */
  const events = (i: number) => {
    const heard = () => engine.sideAt(i) === now.current.live
    const takeOver = (event: { currentTarget: HTMLAudioElement }) => {
      const side = engine.sideAt(i)
      if (pendingRef.current === side && ready(event.currentTarget)) keyed.current.commit(side)
    }
    return {
      // Split, both decks fill ahead so a switch never waits; one record fetches only as it plays
      preload: decks.split ? 'auto' : 'metadata',
      onLoadedMetadata: (event: { currentTarget: HTMLAudioElement }) => {
        const a = event.currentTarget
        const at = startAt.current[i]
        if (at && a.duration) a.currentTime = at.seconds !== undefined ? clampTo(at.seconds, a.duration) : at.share! * a.duration
        startAt.current[i] = null
      },
      onPlay: () => heard() && setPlaying(true),
      onWaiting: () => heard() && setLoading(true),
      onPlaying: (event: { currentTarget: HTMLAudioElement }) => (heard() && setLoading(false), takeOver(event)),
      onSeeked: takeOver,
      onCanPlay: takeOver,
      onPause: () => heard() && (setPlaying(false), setLoading(false)),
      onEnded: () => heard() && setPlaying(false),
      // A side that was getting ready to take over and can't: the switch is off, nothing waits on it
      onError: () => (heard() ? setLoading(false) : pendingRef.current === engine.sideAt(i) && keyed.current.cancel()),
    } as const
  }
  const fileOf = (p: Playable | null) => (p ? fileUrl(p.versionId) : undefined)

  return (
    <PlayerContext value={state}>
      <PlayheadClock els={els} flip={decks.flip} live={decks.live} playing={playing} split={decks.split}>
        {children}
      </PlayheadClock>
      <audio ref={el0} src={fileOf(decks.flip ? decks.b : decks.a)} {...events(0)} />
      <audio ref={el1} src={fileOf(decks.flip ? decks.a : decks.b)} {...events(1)} />
    </PlayerContext>
  )
}

/** The playhead for React (the `m:ss` text, `aria-valuetext`): it moves on the audio's own events, about four times a
 *  second, for the side you hear and each A/B deck. What *draws* it (a fill, a clip, a thumb) is smoother: while
 *  playing, every frame writes `--fill`, `--buffered` (percent) and `--share` (0–1) onto each `[data-playhead]`
 *  element (`[data-playhead="a"|"b"]` for one deck, else the side you hear), or onto its `[data-playhead-read]` layers
 *  when it has them, as signal.ts does for the meters. Nothing re-renders per frame. */
function PlayheadClock({ els, flip, live, playing, split, children }: {
  els: [RefObject<HTMLAudioElement | null>, RefObject<HTMLAudioElement | null>]
  flip: boolean
  live: Side
  playing: boolean
  split: boolean
  children: ReactNode
}) {
  const [playhead, setPlayhead] = useState({ live: NO_TIME, a: NO_TIME, b: NO_TIME })
  useEffect(() => {
    const a = els[flip ? 1 : 0].current
    const b = els[flip ? 0 : 1].current
    if (!a || !b) return
    const of = (side: string | undefined) => (side === 'b' ? b : side === 'a' ? a : live === 'b' ? b : a)
    const at = (el: HTMLAudioElement): Playhead => ({ time: el.currentTime, duration: Number.isFinite(el.duration) ? el.duration : 0, buffered: bufferedAt(el) })
    const draw = () => {
      for (const host of document.querySelectorAll<HTMLElement>('[data-playhead]')) {
        const el = of(host.dataset.playhead)
        const duration = Number.isFinite(el.duration) ? el.duration : 0
        const share = duration ? Math.min(1, el.currentTime / duration) : 0
        const buffered = duration ? Math.min(1, bufferedAt(el) / duration) : 0
        // A host with much under it (the loudness wave) hands them to its `[data-playhead-read]` layers only
        const readers = host.querySelectorAll<HTMLElement>('[data-playhead-read]')
        for (const to of readers.length ? readers : [host]) {
          to.style.setProperty('--fill', `${share * 100}%`)
          to.style.setProperty('--buffered', `${buffered * 100}%`)
          to.style.setProperty('--share', String(share))
        }
        // A native range's thumb follows too, unless a finger or the mouse is holding it.
        const value = String(Math.round(share * 1000))
        if (host instanceof HTMLInputElement && host.value !== value && !host.matches(':active')) host.value = value
      }
    }
    const read = () => {
      const pa = at(a)
      const pb = split ? at(b) : NO_TIME
      setPlayhead({ live: live === 'b' ? pb : pa, a: pa, b: pb })
      draw()
    }
    // Seeking, loading and the end move it while paused, too; `progress` is more of the file arriving.
    const events = ['timeupdate', 'loadedmetadata', 'seeked', 'emptied', 'ended', 'progress'] as const
    const both = split ? [a, b] : [a]
    both.forEach((el) => events.forEach((e) => el.addEventListener(e, read)))
    let frame = 0
    const tick = () => (draw(), (frame = requestAnimationFrame(tick)))
    if (playing) frame = requestAnimationFrame(tick)
    read()
    return () => (cancelAnimationFrame(frame), both.forEach((el) => events.forEach((e) => el.removeEventListener(e, read))))
  }, [els, flip, live, playing, split])
  return <PlayheadContext value={playhead}>{children}</PlayheadContext>
}

/** Where the stretch of file around the playhead ends: what can play from here without waiting. */
function bufferedAt(a: HTMLAudioElement) {
  for (let i = 0; i < a.buffered.length; i++) if (a.buffered.start(i) <= a.currentTime + 0.25 && a.currentTime <= a.buffered.end(i)) return a.buffered.end(i)
  return a.currentTime
}

type Search = { listen?: true; b?: string | true; pick?: Side }

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** This entry was pushed by opening the picker, so closing it is a step back. */
    pick?: true
  }
}

/** Opens the listening room as it was left: split if A/B is still on the decks. */
export function useOpenRoom() {
  const { ab } = usePlayer()
  const { show } = useListenParam()
  return () => show(ab ? (ab.b?.versionId ?? true) : undefined)
}

/** `?listen` opens the listening room over whatever page you're on, so Back closes it and a refresh keeps it.
 *  `&b=<versionId>` splits it for A/B with that version on B (`b` alone: B not picked yet), `&pick=a|b` opens the
 *  picker for a side. Back closes the picker, then the split, then the room. Lowering it drops all three from the URL
 *  but not from the player: the decks stay split, and `useOpenRoom` reopens it as it was. */
export function useListenParam() {
  const search = useSearch({ strict: false }) as Search
  const navigate = useNavigate()
  const router = useRouter()
  // A second close before the step back lands (a double click on a row) must not step back out of the room
  const closing = useRef(false)
  const go = (to: (prev: Search) => Search) => navigate({ to: '.', search: to, resetScroll: false })
  return {
    open: search.listen === true,
    b: search.b ?? null,
    pick: search.pick ?? null,
    /** Opens the room; `b` restores a split (`true`: B not picked yet). */
    show: (b?: string | true) => go((prev) => ({ ...prev, listen: true as const, ...(b === undefined ? {} : { b }) })),
    hide: () => go(({ listen: _, b: __, pick: ___, ...rest }) => rest),
    /** B changed in the room (a pick, a swap): the same step in history, so it's replaced, not pushed. */
    setB: (b: string) => navigate({ to: '.', search: (prev: Search) => ({ ...prev, b }), replace: true, resetScroll: false }),
    split: (b: string | null) => go(({ pick: _, ...prev }) => ({ ...prev, b: b ?? (true as const) })),
    unsplit: () => go(({ b: _, pick: __, ...rest }) => rest),
    openPick: (side: Side) => navigate({ to: '.', search: (prev: Search) => ({ ...prev, pick: side }), state: (prev) => ({ ...prev, pick: true as const }), resetScroll: false }),
    /** A step back when opening it pushed this entry (so Back never reopens it); opened from a link, it's replaced. */
    closePick: () => {
      if (!router.state.location.state.pick) return void navigate({ to: '.', search: ({ pick: _, ...rest }: Search) => rest, replace: true, resetScroll: false })
      if (closing.current) return
      closing.current = true
      router.history.back()
    },
  }
}
