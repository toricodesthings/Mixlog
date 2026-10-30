import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'blue-hour' | 'daylight' | 'system'

const THEME_KEY = 'mixlog.theme'
const MOTION_KEY = 'mixlog.motion'

/**
 * Sets `data-theme` and `data-motion` on <html> from this device's choices. Self-contained (no outer
 * references) because `APPEARANCE_BOOT` inlines its source into <head>, ahead of the first paint.
 */
export function applyAppearance() {
  let theme = 'blue-hour'
  let motion = 'system'
  try {
    theme = localStorage.getItem('mixlog.theme') ?? theme
    motion = localStorage.getItem('mixlog.motion') ?? motion
  } catch {}
  const root = document.documentElement
  if (theme === 'daylight' || (theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches)) root.dataset.theme = 'daylight'
  else delete root.dataset.theme
  if (motion === 'reduced') root.dataset.motion = 'reduced'
  else delete root.dataset.motion
}

/** Runs once in <head>: applies the choices, then follows the system while the theme is "Match system". */
export const APPEARANCE_BOOT = `var a=${applyAppearance.toString()};a();matchMedia('(prefers-color-scheme: light)').addEventListener('change',a)`

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
  applyAppearance()
  for (const listener of listeners) listener()
}

const themeOf = () => (read(THEME_KEY) ?? 'blue-hour') as ThemeChoice
const reducedOf = () => read(MOTION_KEY) === 'reduced'

/** Theme and motion, per device. Every caller sees the same values. */
export function useAppearance() {
  const theme = useSyncExternalStore(subscribe, themeOf, () => 'blue-hour' as const)
  const reduceMotion = useSyncExternalStore(subscribe, reducedOf, () => false)
  return {
    theme,
    setTheme: (next: ThemeChoice) => save(THEME_KEY, next),
    reduceMotion,
    setReduceMotion: (next: boolean) => save(MOTION_KEY, next ? 'reduced' : 'system'),
  }
}
