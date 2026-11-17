import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'blue-hour' | 'daylight' | 'system'

const THEME_KEY = 'mixlog.theme'
const MOTION_KEY = 'mixlog.motion'

/**
 * Sets `data-theme` and `data-motion` on <html> from this device's choices (motion is reduced when Settings says so or
 * the OS does), and the browser chrome's `theme-color` and `color-scheme` to match. Self-contained (no outer
 * references) because `APPEARANCE_BOOT` inlines its source into <head>, ahead of the first paint.
 */
function applyAppearance() {
  // The public meter follows the system until someone chooses; the app is Blue Hour until then.
  let theme = typeof __METER_HOST__ === 'string' && __METER_HOST__ && location.hostname === __METER_HOST__ ? 'system' : 'blue-hour'
  let motion = 'system'
  try {
    theme = localStorage.getItem('mixlog.theme') ?? theme
    motion = localStorage.getItem('mixlog.motion') ?? motion
  } catch {}
  const root = document.documentElement
  const daylight = theme === 'daylight' || (theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches)
  if (daylight) root.dataset.theme = 'daylight'
  else delete root.dataset.theme
  if (motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches) root.dataset.motion = 'reduced'
  else delete root.dataset.motion
  // The rooms' `deep`: the status bar and the installed app's title bar follow the page.
  const meta = (name: string, content: string) => {
    let el = document.head.querySelector('meta[name="' + name + '"]')
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('name', name)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }
  meta('theme-color', daylight ? '#f3f0ec' : '#0a1020')
  meta('color-scheme', daylight ? 'light' : 'dark')
}

/** Runs once in <head>: applies the choices, then follows the system, and another tab's choice. */
export const APPEARANCE_BOOT = `var a=${applyAppearance.toString()};a();matchMedia('(prefers-color-scheme: light)').addEventListener('change',a);matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',a);addEventListener('storage',a)`

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

// Another tab changed a choice: the boot script re-applied it; tell the hooks.
if (typeof window !== 'undefined') window.addEventListener('storage', () => { for (const listener of listeners) listener() })

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
