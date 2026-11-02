import type { LinkOptions } from '@tanstack/react-router'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'

import { fileUrl } from '../../lib/files'
import { drive, tap } from './signal'

/**
 * What's playing, named the way it's said ("Night Drive", "Master v4 · WAV", "Uploaded Oct 12" or "Released Oct 12"),
 * with what its room needs: the release's title (its colours stand in for the artwork's) and artwork, and the way back.
 */
export type Playable = {
  versionId: string
  title: string
  label: string
  day: string
  released: boolean
  release: string
  artworkId: string | null
  link: LinkOptions
}

type PlayerState = {
  item: Playable | null
  playing: boolean
  volume: number
  muted: boolean
  /** Plays `item`; the one already loaded toggles instead. */
  play: (item: Playable) => void
  toggle: () => void
  stop: () => void
  /** Jumps to a share of the way through (0–1). */
  seek: (share: number) => void
  /** Moves the playhead by seconds, back when negative. */
  skip: (seconds: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
}

/** Where the playhead is, in seconds. Its own context: it changes every frame, and only what shows time listens. */
type Playhead = { time: number; duration: number }

const PlayerContext = createContext<PlayerState | null>(null)
const PlayheadContext = createContext<Playhead>({ time: 0, duration: 0 })

export function usePlayer() {
  const player = use(PlayerContext)
  if (!player) throw new Error('usePlayer needs a PlayerProvider (layout/AppShell)')
  return player
}

export const usePlayhead = () => use(PlayheadContext)

/**
 * The one player: a single <audio> in the shell, so playback never stops because you navigated. It plays the file
 * exactly as uploaded (the Worker serves range requests), and tells the device what's playing, so the lock screen and
 * headphone buttons work too. The bar and the listening room (PlayerBar, ListeningRoom) are its faces.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [item, setItem] = useState<Playable | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolumeState] = useState(1)
  const [muted, setMutedState] = useState(false)

  const state = useMemo<PlayerState>(() => {
    const el = () => audio.current
    const toggle = () => {
      const a = el()
      if (a) void (a.paused ? a.play().catch(() => setPlaying(false)) : a.pause())
    }
    return {
      item,
      playing,
      volume,
      muted,
      toggle,
      play: (next) => (next.versionId === item?.versionId ? toggle() : setItem(next)),
      stop: () => (el()?.pause(), setItem(null)),
      seek: (share) => {
        const a = el()
        if (a && a.duration) a.currentTime = share * a.duration
      },
      skip: (seconds) => {
        const a = el()
        if (a && a.duration) a.currentTime = Math.min(Math.max(a.currentTime + seconds, 0), a.duration)
      },
      setVolume: (next) => {
        const a = el()
        if (a) (a.volume = next), (a.muted = next === 0)
        setVolumeState(next)
        setMutedState(next === 0)
      },
      setMuted: (next) => {
        const a = el()
        if (a) a.muted = next
        setMutedState(next)
      },
    }
  }, [item, playing, volume, muted])

  useEffect(() => {
    if (item) void audio.current?.play().catch(() => setPlaying(false))
  }, [item])

  // The signal (signal.ts): while playing on a desktop, the meters and the listening room read the music
  useEffect(() => {
    const analyser = playing && audio.current ? tap(audio.current) : null
    return analyser ? drive(analyser) : undefined
  }, [playing])

  // The lock screen, the notification shade and headphone buttons: what's playing, and play, pause and seek.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = item
      ? new MediaMetadata({ title: item.title, artist: item.label, album: item.release, artwork: item.artworkId ? [{ src: fileUrl(item.artworkId) }] : [] })
      : null
    navigator.mediaSession.setActionHandler('play', item ? () => void audio.current?.play() : null)
    navigator.mediaSession.setActionHandler('pause', item ? () => audio.current?.pause() : null)
    const skip = (by: number) => audio.current && (audio.current.currentTime = Math.max(audio.current.currentTime + by, 0))
    navigator.mediaSession.setActionHandler('seekbackward', item ? (details) => skip(-(details.seekOffset ?? 10)) : null)
    navigator.mediaSession.setActionHandler('seekforward', item ? (details) => skip(details.seekOffset ?? 10) : null)
    navigator.mediaSession.setActionHandler('seekto', item ? (details) => details.seekTime !== undefined && audio.current && (audio.current.currentTime = details.seekTime) : null)
  }, [item])

  return (
    <PlayerContext value={state}>
      <PlayheadClock audio={audio} playing={playing}>
        {children}
      </PlayheadClock>
      <audio
        ref={audio}
        src={item ? fileUrl(item.versionId) : undefined}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </PlayerContext>
  )
}

/** Reads the playhead every frame while playing (smooth on a wide bar, where `timeupdate`'s quarter-seconds step). */
function PlayheadClock({ audio, playing, children }: { audio: RefObject<HTMLAudioElement | null>; playing: boolean; children: ReactNode }) {
  const [playhead, setPlayhead] = useState<Playhead>({ time: 0, duration: 0 })
  useEffect(() => {
    const a = audio.current
    if (!a) return
    const read = () => setPlayhead({ time: a.currentTime, duration: Number.isFinite(a.duration) ? a.duration : 0 })
    // Seeking, loading and the end move it while paused, too.
    const events = ['loadedmetadata', 'seeked', 'emptied', 'ended'] as const
    events.forEach((e) => a.addEventListener(e, read))
    let frame = 0
    const tick = () => (read(), (frame = requestAnimationFrame(tick)))
    if (playing) frame = requestAnimationFrame(tick)
    read()
    return () => (cancelAnimationFrame(frame), events.forEach((e) => a.removeEventListener(e, read)))
  }, [audio, playing])
  return <PlayheadContext value={playhead}>{children}</PlayheadContext>
}

type Search = { listen?: true }

/** `?listen` opens the listening room over whatever page you're on, so Back closes it and a refresh keeps it. */
export function useListenParam() {
  const open = useSearch({ strict: false }).listen === true
  const navigate = useNavigate()
  return {
    open,
    show: () => navigate({ to: '.', search: (prev: Search) => ({ ...prev, listen: true as const }), resetScroll: false }),
    hide: () => navigate({ to: '.', search: ({ listen: _, ...rest }: Search) => rest, resetScroll: false }),
  }
}
