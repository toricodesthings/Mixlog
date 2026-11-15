import { STREAMING_LUFS, useListening, type MatchTo } from '../../../hooks/ui/use-listening'
import { SegmentedControl } from '../../primitives/SegmentedControl'
import { SwitchSetting } from '../SettingRows'
import { SettingsRow, SettingsSection } from '../SettingsLayout'

const TARGETS = [
  { value: 'quieter', label: 'The quieter one' },
  { value: 'streaming', label: 'Streaming level' },
] as const

/** What the listening room's A/B doesn't show. Its own toggles (Sync, Level match) live in the room, remembered there. */
export function ListeningTab() {
  const { matchTo, hold, set } = useListening()
  return (
    <div>
      <h2 className="mb-10 font-display text-2xl font-semibold text-ink">Listening</h2>
      <SettingsSection title="A/B">
        <p className="text-[0.8125rem] leading-relaxed text-ink-muted">Kept on this device.</p>
        <SettingsRow
          title="Match to"
          description={
            matchTo === 'quieter'
              ? 'Level match turns the louder side down to the quieter one. Nothing is ever turned up.'
              : `Level match turns both sides down to ${STREAMING_LUFS} LUFS when both are louder, as streaming plays them; else to the quieter one.`
          }
        >
          <SegmentedControl ariaLabel="Match to" value={matchTo} onChange={(next: MatchTo) => set({ matchTo: next })} options={TARGETS} />
        </SettingsRow>
        <SwitchSetting
          title="Hold to audition"
          description="Hold a record, the A | B switch or X to hear the other side, and let go to come back. Off, every press stays."
          checked={hold}
          onChange={(next) => set({ hold: next })}
        />
      </SettingsSection>
    </div>
  )
}
