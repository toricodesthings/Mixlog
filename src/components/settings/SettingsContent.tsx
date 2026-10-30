import { Info, Paintbrush } from 'lucide-react'

import { AboutTab } from './tabs/AboutTab'
import { AppearanceTab } from './tabs/AppearanceTab'

export type TabId = 'appearance' | 'about'

/** `keywords` are the tab's row titles, so search finds "daylight" as well as "Appearance". Keep them in step with the tab. */
export const SETTINGS_CATEGORIES = [
  { label: 'Preferences', isHeader: true },
  { id: 'appearance', label: 'Appearance', icon: Paintbrush, keywords: ['theme', 'blue hour', 'daylight', 'dark', 'light', 'system', 'motion', 'animation'] },
  { label: 'Mixlog', isHeader: true },
  { id: 'about', label: 'About Mixlog', icon: Info, keywords: ['version', 'license', 'source', 'github', 'open source', 'sign out', 'access'] },
] as const

export function SettingsContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case 'about':
      return <AboutTab />
    default:
      return <AppearanceTab />
  }
}
