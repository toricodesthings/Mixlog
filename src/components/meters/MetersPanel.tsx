import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { SPRINGS, TWEENS } from '../../lib/constants/motion'
import type { ReleaseData } from '../releases/loaders'
import { sectionOf } from '../releases/sections'
import { MeterBridge } from './MeterBridge'
import { useMetersParam } from './use-meters-param'

/** Where the rows' meter buttons are, so closing hands focus back to the one that opened them. */
export const metersButton = (versionId: string) => document.querySelector<HTMLElement>(`[data-meters-for="${versionId}"]`)

/** The release room's right edge (ReleaseLayout), where the wide panel docks, inside the room so it keeps its tint. */
export const DOCK = 'meters-dock'

/**
 * The wide screen's meters (≥ 1440px): a panel docked to the room's right edge, full height, its header level with the
 * page's and its body scrolling on its own, with a patch cable from the row it reads. Opening another row's meters
 * retargets it, its content crossfading. Anywhere narrower the bridge unfolds under its row instead (VersionRow).
 */
export function WithMeters({ data, children }: { data: ReleaseData; children: ReactNode }) {
  const { mode } = useShellMode()
  const meters = useMetersParam()
  const version = mode === 'wide' ? data.versions.find((v) => v.id === meters.open && v.content_type.startsWith('audio/')) : undefined
  const track = version && data.tracks.find((t) => t.id === version.track_id)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [version?.id])
  const [dock, setDock] = useState<HTMLElement | null>(null)
  useEffect(() => setDock(document.getElementById(DOCK)), [])
  // The panel's header is exactly as tall as the page's beside it, whatever the page's holds, so their rules meet.
  const [headerH, setHeaderH] = useState<number | null>(null)
  useEffect(() => {
    const header = dock?.previousElementSibling?.querySelector(':scope > header')
    if (!header) return
    const observer = new ResizeObserver(() => setHeaderH(header.getBoundingClientRect().height))
    observer.observe(header)
    return () => observer.disconnect()
  }, [dock])

  const close = () => {
    const id = version!.id
    void meters.close().then(() => metersButton(id)?.focus())
  }
  const open = version && track
  return (
    <>
      {children}
      {dock && createPortal(
        <AnimatePresence initial={false}>
          {open && (
            <motion.aside
              key="meters"
              id={`meters-${version.id}`}
              onKeyDown={(e) => e.key === 'Escape' && close()}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '26rem', opacity: 1, transition: SPRINGS.GLIDE }}
              exit={{ width: 0, opacity: 0, transition: TWEENS.FADE }}
              style={headerH ? ({ '--dock-header-h': `${headerH}px` } as CSSProperties) : undefined}
              className="meters-dock surface-shell h-full shrink-0 overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={version.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={TWEENS.FADE} className="h-full w-[26rem]">
                  <MeterBridge docked t={{ data, release: data.release, track, section: sectionOf(data.release) }} version={version} headingRef={heading} onClose={close} />
                </motion.div>
              </AnimatePresence>
            </motion.aside>
          )}
        </AnimatePresence>,
        dock,
      )}
      {open && dock && <PatchCable versionId={version.id} dock={dock} />}
    </>
  )
}

/**
 * The patch cable: from the row's edge across to the panel's, level with the row where it can be, straight, a pulse of signal running
 * it (ambient, so it stops when motion is reduced). Redrawn each frame while open, since the row scrolls and the panel
 * slides; hidden while the row is scrolled out of sight. It lives in the dock, so it takes the room's accent.
 */
function PatchCable({ versionId, dock }: { versionId: string; dock: HTMLElement }) {
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    let frame = 0
    let last = ''
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const row = document.querySelector(`[data-version="${versionId}"]`)
      const jack = document.querySelector('[data-meters-jack]')
      const view = row?.closest('main')
      const el = svg.current
      if (!el) return
      if (!row || !jack || !view) return void (el.style.opacity = '0')
      const r = row.getBoundingClientRect()
      const v = view.getBoundingClientRect()
      const panel = jack.closest('aside')!.getBoundingClientRect()
      const top = jack.closest('header')!.getBoundingClientRect().bottom + 16
      const [sx, sy] = [r.right, r.top + r.height / 2]
      const [ex, ey] = [panel.left, Math.min(panel.bottom - 16, Math.max(top, sy))]
      const d = `M${sx},${sy} L${ex},${ey}`
      const key = `${d}|${sy > v.top && sy < v.bottom}`
      if (key === last) return
      last = key
      el.style.opacity = sy > v.top && sy < v.bottom ? '1' : '0'
      for (const path of el.querySelectorAll('path')) path.setAttribute('d', d)
      const [a, b] = el.querySelectorAll('circle')
      a.setAttribute('cx', `${sx}`), a.setAttribute('cy', `${sy}`)
      b.setAttribute('cx', `${ex}`), b.setAttribute('cy', `${ey}`)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [versionId])
  return createPortal(
    <svg ref={svg} aria-hidden="true" className="patch-cable">
      <path className="patch-glow" />
      <path className="patch-wire" />
      <path className="patch-pulse" pathLength={100} />
      <circle r={2} className="patch-jack" />
      <circle r={2} className="patch-jack" />
    </svg>,
    dock,
  )
}
