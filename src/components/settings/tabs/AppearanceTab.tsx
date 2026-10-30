import { useAppearance, type ThemeChoice } from '../../../hooks/ui/use-appearance'
import { SwitchSetting } from '../SettingRows'
import { SettingsSection } from '../SettingsLayout'
import { ThemeModeCard } from '../ThemeModeCard'

export function AppearanceTab() {
  const { theme, setTheme, reduceMotion, setReduceMotion } = useAppearance()
  return (
    <div>
      <h2 className="mb-10 font-display text-2xl font-semibold text-ink">Appearance</h2>
      <SettingsSection title="Theme">
        <p className="text-[13px] leading-relaxed text-ink-muted">Kept on this device.</p>
        <div className="grid grid-cols-3 gap-3">
          {(['blue-hour', 'daylight', 'system'] as ThemeChoice[]).map((mode) => (
            <ThemeModeCard key={mode} mode={mode} selected={theme === mode} onSelect={() => setTheme(mode)} />
          ))}
        </div>
      </SettingsSection>
      <SettingsSection title="Motion">
        <SwitchSetting
          title="Reduce motion"
          description="Sheets, menus and the rail change in place instead of travelling. Off follows this device's own setting."
          checked={reduceMotion}
          onChange={setReduceMotion}
        />
      </SettingsSection>
    </div>
  )
}
