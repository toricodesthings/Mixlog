import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { SPRINGS, TWEENS } from '../../lib/constants/motion'
import { cn } from '../../lib/utils'
import type { ReleaseData } from '../releases/loaders'
import { sectionOf } from '../releases/sections'
import { MeterBridge } from './MeterBridge'
import { useMetersParam } from './use-meters-param'

const noSubscribe = () => () => {}

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
  const dock = useSyncExternalStore(noSubscribe, () => document.getElementById(DOCK), () => null)
  // The panel's header is exactly as tall as the page's beside it, whatever the page's holds, so their rules meet.
  const [headerH, setHeaderH] = useState<number | null>(null)
  useEffect(() => {
    const header = dock?.previousElementSibling?.querySelector(':scope > header')
    if (!header) return
    const observer = new ResizeObserver(() => setHeaderH(header.getBoundingClientRect().height))
    observer.observe(header)
    return () => observer.disconnect()
  }, [dock])

  const [full, setFull] = useState(false)
  const close = () => {
    setFull(false)
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
              onKeyDown={(e) => e.key === 'Escape' && (full ? setFull(false) : close())}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: full ? '100vw' : '26rem', opacity: 1, transition: SPRINGS.GLIDE }}
              exit={{ width: 0, opacity: 0, transition: TWEENS.FADE }}
              style={headerH ? ({ '--dock-header-h': `${headerH}px` } as CSSProperties) : undefined}
              className={cn('meters-dock h-full shrink-0 overflow-hidden', full ? 'layer-fullscreen-surface fixed inset-y-0 right-0 bg-room-deep/80 backdrop-blur-3xl backdrop-saturate-150' : 'surface-shell')}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div key={version.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={TWEENS.FADE} className={cn('h-full', full ? 'w-full' : 'w-[26rem]')}>
                  <MeterBridge docked t={{ data, release: data.release, track, section: sectionOf(data.release) }} version={version} headingRef={heading} onClose={close} full={full} onFull={() => setFull((f) => !f)} />
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
    // Found once, and again only when one leaves the page (a re-render, a page change): no lookups per frame
    let row: Element | null = null
    let jack: Element | null = null
    let view: Element | null = null
    let aside: Element | null = null
    let header: Element | null = null
    const find = () => {
      row = document.querySelector(`[data-version="${versionId}"]`)
      jack = document.querySelector('[data-meters-jack]')
      view = row?.closest('main') ?? null
      aside = jack?.closest('aside') ?? null
      header = jack?.closest('header') ?? null
    }
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const el = svg.current
      if (!el) return
      if (!row?.isConnected || !jack?.isConnected) find()
      if (!row || !jack || !view || !aside || !header) return void (el.style.opacity = '0')
      const r = row.getBoundingClientRect()
      const v = view.getBoundingClientRect()
      const panel = aside.getBoundingClientRect()
      const top = header.getBoundingClientRect().bottom + 16
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
