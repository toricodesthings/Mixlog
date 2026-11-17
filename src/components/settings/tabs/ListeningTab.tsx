import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

import { LUFS_RANGE, STREAMING_LUFS, lufsOf, useListening, type MatchTo } from '../../../hooks/ui/use-listening'
import { SPRINGS } from '../../../lib/constants/motion'
import { Input } from '../../primitives'
import { SegmentedControl } from '../../primitives/SegmentedControl'
import { SwitchSetting } from '../SettingRows'
import { SettingsRow, SettingsSection } from '../SettingsLayout'

const TARGETS = [
  { value: 'quieter', label: 'The quieter one' },
  { value: 'streaming', label: 'Streaming level' },
  { value: 'custom', label: 'Custom' },
] as const

/** What the listening room's A/B doesn't show. Its own toggles (Sync, Level match) live in the room, remembered there. */
export function ListeningTab() {
  const { matchTo, customLufs, hold, set } = useListening()
  const level = matchTo === 'streaming' ? STREAMING_LUFS : customLufs
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
              : `Level match turns both sides down to ${level} LUFS when both are louder${matchTo === 'streaming' ? ', as streaming plays them' : ''}; else to the quieter one.`
          }
        >
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <SegmentedControl ariaLabel="Match to" value={matchTo} onChange={(next: MatchTo) => set({ matchTo: next })} options={TARGETS} />
            <AnimatePresence initial={false}>
              {matchTo === 'custom' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRINGS.GLIDE} className="overflow-hidden p-0.5">
                  <LufsInput value={customLufs} onChange={(customLufs) => set({ customLufs })} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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

/** A level typed loosely ("14", "-14", "−9.5"): read on leaving or Enter, shown back as understood (always negative, −32 to 0). */
function LufsInput({ value, onChange }: { value: number; onChange: (lufs: number) => void }) {
  const [text, setText] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) (setSeen(value), setText(String(value)))
  const commit = () => {
    const lufs = lufsOf(text)
    if (lufs === null) return setText(String(value))
    setText(String(lufs))
    onChange(lufs)
  }
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Custom level in LUFS, from {LUFS_RANGE[0]} to {LUFS_RANGE[1]}</span>
      <Input
        value={text}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
        data-numeric
        className="pr-16 text-right font-mono tabular-nums sm:w-40"
      />
      <span aria-hidden="true" className="readout pointer-events-none absolute right-3.5 text-ink-muted">LUFS</span>
    </label>
  )
}
