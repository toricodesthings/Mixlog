import { CalendarClock, Disc3, Settings, Trash2, type LucideIcon } from 'lucide-react'

export type Destination = {
  to: '/upcoming' | '/releases' | '/trash'
  label: string
  icon: LucideIcon
  /** The pages this destination stands for, so Upcoming stays lit on one of its tracks. */
  owns: (pathname: string) => boolean
}

/** The places Mixlog has. The rail and the phone dock both read this; nothing else lists them. */
export const DESTINATIONS: { primary: Destination[]; secondary: Destination[] } = {
  primary: [
    { to: '/upcoming', label: 'Upcoming', icon: CalendarClock, owns: (p) => p.startsWith('/upcoming') },
    { to: '/releases', label: 'Releases', icon: Disc3, owns: (p) => p.startsWith('/releases') },
  ],
  secondary: [
    { to: '/trash', label: 'Trash', icon: Trash2, owns: (p) => p === '/trash' },
  ],
}

/** Settings isn't a place: it opens over whichever page you're on (`?settings=`). */
export const SETTINGS_ENTRY = { label: 'Settings', icon: Settings }
