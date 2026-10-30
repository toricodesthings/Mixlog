import { useEffect, useRef } from 'react'
import { Info, LogOut, type LucideIcon } from 'lucide-react'

import { NAV_GROUP, NAV_GROUP_LABEL, NavigationRow } from '../layout/NavigationRow'
import { UtilitySheet } from '../shared/UtilitySheet'
import { SETTINGS_CATEGORIES, SettingsContent } from './SettingsContent'
import { SIGN_OUT_URL } from './tabs/AboutTab'
import { useSettingsParam } from './use-settings-param'

interface MenuGroup {
  label: string
  items: Array<{ id: string; label: string; icon: LucideIcon }>
}

/** The menu's categories under their headings; About sits apart at the bottom. */
function menuGroups(): MenuGroup[] {
  const groups: MenuGroup[] = []
  for (const item of SETTINGS_CATEGORIES) {
    if ('isHeader' in item) groups.push({ label: item.label, items: [] })
    else if (item.id !== 'about') groups.at(-1)?.items.push({ id: item.id, label: item.label, icon: item.icon })
  }
  return groups.filter((group) => group.items.length > 0)
}

export function SettingsSheet() {
  const { settings, open, close } = useSettingsParam()
  // Keeps the last tab on screen while the sheet slides away.
  const lastTab = useRef(settings ?? 'menu')
  useEffect(() => {
    if (settings) lastTab.current = settings
  }, [settings])
  const activeTab = settings ?? lastTab.current
  const category = SETTINGS_CATEGORIES.find((item) => !('isHeader' in item) && item.id === activeTab)

  return (
    <UtilitySheet
      open={settings !== null}
      title={category?.label ?? 'Settings'}
      onClose={() => void close()}
      onBack={category ? () => void open('menu') : undefined}
    >
      {category && !('isHeader' in category) ? (
        <div className="mobile-settings-content">
          <SettingsContent activeTab={category.id} />
        </div>
      ) : (
        <>
          {menuGroups().map((group) => (
            <section key={group.label} className="space-y-1.5">
              <h3 className={NAV_GROUP_LABEL}>{group.label}</h3>
              <nav aria-label={group.label} className={NAV_GROUP}>
                {group.items.map((item) => (
                  <NavigationRow key={item.id} icon={item.icon} onClick={() => void open(item.id)}>
                    {item.label}
                  </NavigationRow>
                ))}
              </nav>
            </section>
          ))}
          <div className={NAV_GROUP}>
            <NavigationRow icon={Info} onClick={() => void open('about')}>
              About Mixlog
            </NavigationRow>
          </div>
          <div className={NAV_GROUP}>
            <a href={SIGN_OUT_URL} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-ink-soft hover:bg-white/[0.04]">
              <LogOut size={18} aria-hidden="true" className="text-ink-muted" />
              Sign out
            </a>
          </div>
        </>
      )}
    </UtilitySheet>
  )
}
