import { useSyncExternalStore } from 'react'

/** The listening room's A/B choices, per device: the room's own toggles (Sync, Level match) and what Settings ›
 *  Listening holds (what Level match aims for, whether a hold auditions). */
export type MatchTo = 'quieter' | 'streaming' | 'custom'
export type Listening = { sync: boolean; match: boolean; matchTo: MatchTo; customLufs: number; hold: boolean }

const KEY = 'mixlog.listening'
const DEFAULTS: Listening = { sync: true, match: false, matchTo: 'quieter', customLufs: -14, hold: true }

/** Streaming's common level: the target when both sides are louder than it and Settings says so. */
export const STREAMING_LUFS = -14
/** How far a custom level can go: 0 LUFS at the top, −32 at the bottom. */
export const LUFS_RANGE = [-32, 0] as const

/** A typed level as a target: loudness is always negative, so "14" means −14; held to the range; null if it isn't a number. */
export function lufsOf(text: string): number | null {
  const n = Number.parseFloat(text.trim().replace(/[−–]/g, '-').replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return Math.round(Math.min(LUFS_RANGE[1], Math.max(LUFS_RANGE[0], -Math.abs(n))) * 10) / 10
}

/** The ceiling Level match aims for, or null for "the quieter one". */
export const ceilingOf = (l: Listening) => (l.matchTo === 'streaming' ? STREAMING_LUFS : l.matchTo === 'custom' ? l.customLufs : null)

let cached: { raw: string | null; value: Listening } = { raw: null, value: DEFAULTS }
function read(): Listening {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {}
  if (raw === cached.raw) return cached.value
  let value = DEFAULTS
  try {
    const saved = raw ? JSON.parse(raw) : {}
    value = {
      sync: typeof saved.sync === 'boolean' ? saved.sync : DEFAULTS.sync,
      match: typeof saved.match === 'boolean' ? saved.match : DEFAULTS.match,
      matchTo: saved.matchTo === 'streaming' || saved.matchTo === 'custom' ? saved.matchTo : 'quieter',
      customLufs: typeof saved.customLufs === 'number' ? (lufsOf(String(saved.customLufs)) ?? DEFAULTS.customLufs) : DEFAULTS.customLufs,
      hold: typeof saved.hold === 'boolean' ? saved.hold : DEFAULTS.hold,
    }
  } catch {}
  cached = { raw, value }
  return value
}

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => (listeners.delete(listener), window.removeEventListener('storage', listener))
}

function save(next: Partial<Listening>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), ...next }))
  } catch {
    // No storage (a private window): keep it for this visit
    cached = { raw: cached.raw, value: { ...cached.value, ...next } }
  }
  for (const listener of listeners) listener()
}

/** Every caller sees the same values. */
export function useListening() {
  const value = useSyncExternalStore(subscribe, read, () => DEFAULTS)
  return { ...value, set: save }
}
