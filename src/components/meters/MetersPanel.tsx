import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { TWEENS } from '../../lib/constants/motion'
import type { ReleaseData } from '../releases/loaders'
import { sectionOf } from '../releases/sections'
import { MeterBridge } from './MeterBridge'
import { useMetersParam } from './use-meters-param'

/** Where the rows' meter buttons are, so closing hands focus back to the one that opened them. */
export const metersButton = (versionId: string) => document.querySelector<HTMLElement>(`[data-meters-for="${versionId}"]`)

/**
 * The wide screen's meters (≥ 1440px): a panel docked beside the lanes, in the release's room, scrolling on its own.
 * Opening another row's meters retargets it, its content crossfading. Anywhere narrower the bridge unfolds under its
 * row instead (VersionRow), and this is just the lanes.
 */
export function WithMeters({ data, children }: { data: ReleaseData; children: ReactNode }) {
  const { mode } = useShellMode()
  const meters = useMetersParam()
  const version = mode === 'wide' ? data.versions.find((v) => v.id === meters.open && v.content_type.startsWith('audio/')) : undefined
  const track = version && data.tracks.find((t) => t.id === version.track_id)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [version?.id])
  if (!version || !track) return children

  const close = () => {
    const id = version.id
    void meters.close().then(() => metersButton(id)?.focus())
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_24rem] items-start gap-6">
      <div className="min-w-0">{children}</div>
      <aside
        id={`meters-${version.id}`}
        onKeyDown={(e) => e.key === 'Escape' && close()}
        className="surface-shell glass-edge scrollbar-thin sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-5"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={version.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={TWEENS.FADE}>
            <MeterBridge t={{ data, release: data.release, track, section: sectionOf(data.release) }} version={version} headingRef={heading} onClose={close} />
          </motion.div>
        </AnimatePresence>
      </aside>
    </div>
  )
}
