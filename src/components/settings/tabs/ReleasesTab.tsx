import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { getSettings, saveKeepDays } from '#/server/settings'
import { DEFAULT_KEEP_DAYS, KEEP_CHOICES, type KeepDays } from '#/server/shipping'
import { cn } from '../../../lib/utils'
import { Led } from '../../primitives'
import { SettingsSection } from '../SettingsLayout'

const CHOICE: Record<string, { title: string; says: string }> = {
  7: { title: 'A week', says: 'Other masters and mixes are erased a week after it goes out.' },
  14: { title: 'Two weeks', says: 'Other masters and mixes are erased two weeks after it goes out.' },
  30: { title: 'A month', says: 'Other masters and mixes are erased a month after it goes out.' },
  forever: { title: 'Keep everything', says: 'Nothing is erased: every bounce stays set aside with its release, and it can always move back.' },
}
const keyOf = (days: KeepDays) => (days === null ? 'forever' : String(days))

/** What happens to the versions that didn't ship once a release moves to Releases. Kept by the Worker, not this
 *  device: the cleanup cron reads it. A change applies to releases already waiting, too. */
export function ReleasesTab() {
  const router = useRouter()
  const [keep, setKeep] = useState<KeepDays | undefined>(undefined)
  const [setAside, setSetAside] = useState<string[]>([])
  // What a window would erase tonight: the set-aside versions already older than it.
  const erases = (days: KeepDays) => (days === null ? 0 : setAside.filter((at) => Date.now() - Date.parse(at) > days * 86_400_000).length)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    getSettings()
      .then((s) => (setKeep(s.keepDays), setSetAside(s.setAside)))
      .catch(() => setProblem('Couldn’t read this setting. Close Settings and try again.'))
  }, [])

  const choose = async (days: KeepDays) => {
    const before = keep
    setKeep(days)
    setProblem(null)
    try {
      await saveKeepDays({ data: days })
      await router.invalidate()
    } catch {
      setKeep(before)
      setProblem('Couldn’t save that. Nothing changed; try again.')
    }
  }

  return (
    <div>
      <h2 className="mb-10 font-display text-2xl font-semibold text-ink">Releases</h2>
      <SettingsSection title="After a release goes out">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          Each track keeps what shipped; the rest is set aside. Until it's erased, the release can move back to Upcoming with all of them. Kept for every device.
        </p>
        <fieldset disabled={keep === undefined} className="flex flex-col gap-2" aria-busy={keep === undefined}>
          <legend className="sr-only">Keep older versions after release</legend>
          {KEEP_CHOICES.map((days) => {
            const { title, says } = CHOICE[keyOf(days)]
            const erased = keep === days ? 0 : erases(days)
            return (
              <label
                key={keyOf(days)}
                className={cn(
                  'surface-item group flex cursor-pointer items-center gap-4 rounded-2xl border border-line/40 p-4 transition-[border-color,background-color] duration-200 hover:border-line',
                  'has-checked:border-accent/50 has-checked:bg-accent/[0.06] has-focus-visible:ring-2 has-focus-visible:ring-accent/50',
                )}
              >
                <input type="radio" name="keep" checked={keep === days} onChange={() => void choose(days)} className="sr-only" />
                <Led lit={keep === days} className="shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-base font-medium text-ink">
                    {title}
                    {days === DEFAULT_KEEP_DAYS && <span className="readout text-ink-muted">Default</span>}
                  </span>
                  <span className="text-sm text-ink-soft">{says}</span>
                  {erased > 0 && (
                    <span data-numeric className="text-sm text-accent-secondary">
                      {erased} set-aside {erased === 1 ? 'version is' : 'versions are'} already older and would be erased tonight.
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </fieldset>
        {problem && <p role="alert" className="text-sm text-feedback-error">{problem}</p>}
      </SettingsSection>
    </div>
  )
}
