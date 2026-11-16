import { useEffect, type RefObject } from 'react'

import { useShellMode } from './use-shell-mode'

/**
 * The scene notices the pointer (1.7.2): desktop with a fine pointer only, off under reduced motion and whenever
 * `enabled` is false. A passive `pointermove` sets where the pointer is; one rAF loop eases toward it (and back to rest
 * on leave) and stops once settled, so nothing runs while the pointer is still. Each frame, with x and y from −1 to 1
 * from the scene's centre: a `[data-pointer-read]` layer with a `--shift` (px) is translated against the pointer by that
 * much (half inside a `[data-idle]` side of the room); a `[data-pointer-lean]` one is rotated toward it by that many
 * degrees; a `[data-pointer-lift]` one (−1 or 1, a side) fades in as the pointer moves to that side; any other
 * `[data-pointer-read]` gets `--px`/`--py`, and a `[data-pointer-near]` one `--near` (0…1 within its
 * radius in px). Final properties go on the boxes and custom ones only on leaves, and nothing is a CSS transition:
 * a custom property on a box restyles every SVG node inside it, and a transition restarted every frame dispatches its
 * events through React each time. While the loop runs the host carries `data-pointer-live` (the layers' `will-change`).
 */
export function useScenePointer(host: RefObject<HTMLElement | null>, enabled = true) {
  const { mode, isTouch } = useShellMode()
  const on = enabled && !isTouch && (mode === 'wide' || mode === 'laptop')
  useEffect(() => {
    const el = host.current
    if (!on || !el) return
    let frame = 0
    let then = 0
    // Where the pointer is (target) and where the scene has eased to (now): x, y from −1 to 1, and w, 1 while it's in
    const target = { x: 0, y: 0, w: 0 }
    const now = { x: 0, y: 0, w: 0 }
    let layers: { el: HTMLElement; shift: number; lean: number; side: number; idle: boolean }[] = []
    let near: { el: Element & ElementCSSInlineStyle; x: number; y: number; r: number }[] = []
    const reduced = () => document.documentElement.dataset.motion === 'reduced'
    const measure = () => {
      layers = [...el.querySelectorAll<HTMLElement>('[data-pointer-read], [data-pointer-lean], [data-pointer-lift]')].map((l) => ({
        el: l,
        shift: Number(l.style.getPropertyValue('--shift')) || 0,
        lean: Number(l.dataset.pointerLean) || 0,
        side: Number(l.dataset.pointerLift) || 0,
        idle: Boolean(l.closest('[data-idle]')),
      }))
      near = [...el.querySelectorAll<Element & ElementCSSInlineStyle>('[data-pointer-near]')].map((n) => {
        const r = n.getBoundingClientRect()
        return { el: n, x: r.left + r.width / 2, y: r.top + r.height / 2, r: Number(n.getAttribute('data-pointer-near')) || 120 }
      })
    }
    const write = () => {
      const { x: px, y: py, w } = now
      const rest = !w
      for (const l of layers) {
        const s = l.el.style
        if (l.shift) s.translate = rest ? '' : `${(-px * l.shift * (l.idle ? 0.5 : 1)).toFixed(2)}px ${(-py * l.shift * (l.idle ? 0.15 : 0.3)).toFixed(2)}px`
        else if (l.lean) s.rotate = rest ? '' : `${(px * l.lean).toFixed(3)}deg`
        else if (l.side) s.opacity = (w * Math.max(0, l.side * px)).toFixed(3)
        else s.setProperty('--px', px.toFixed(3)), s.setProperty('--py', py.toFixed(3))
      }
      const box = el.getBoundingClientRect()
      const [cx, cy] = [box.left + ((px + 1) / 2) * box.width, box.top + ((py + 1) / 2) * box.height]
      for (const n of near) n.el.style.setProperty('--near', (w * Math.max(0, 1 - Math.hypot(cx - n.x, cy - n.y) / n.r)).toFixed(2))
    }
    const tick = (t: number) => {
      // About 400 ms to settle toward the pointer, 600 ms back to rest
      const a = 1 - Math.exp(-Math.min(64, t - (then || t - 16)) / (target.w ? 130 : 200))
      then = t
      for (const k of ['x', 'y', 'w'] as const) now[k] += (target[k] - now[k]) * a
      const settled = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) + Math.abs(target.w - now.w) < 0.002
      if (settled) Object.assign(now, target)
      if (layers.some((l) => !l.el.isConnected)) measure() // a night swapped under the pointer
      write()
      if (!settled) frame = requestAnimationFrame(tick)
      else {
        frame = then = 0
        delete el.dataset.pointerLive
      }
    }
    const run = () => {
      if (frame) return
      el.dataset.pointerLive = ''
      frame = requestAnimationFrame(tick)
    }
    const move = (e: PointerEvent) => {
      if ((e.pointerType !== 'mouse' && e.pointerType !== 'pen') || reduced()) return
      if (!layers.length) enter() // already inside when the page came up
      const box = el.getBoundingClientRect()
      target.x = Math.max(-1, Math.min(1, ((e.clientX - box.left) / box.width) * 2 - 1))
      target.y = Math.max(-1, Math.min(1, ((e.clientY - box.top) / box.height) * 2 - 1))
      target.w = 1
      run()
    }
    const enter = () => {
      if (reduced()) return
      measure()
      el.dataset.pointer = ''
    }
    const leave = () => {
      Object.assign(target, { x: 0, y: 0, w: 0 })
      delete el.dataset.pointer
      if (now.w) run()
    }
    el.addEventListener('pointerenter', enter, { passive: true })
    el.addEventListener('pointermove', move, { passive: true })
    el.addEventListener('pointerleave', leave, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      Object.assign(now, { x: 0, y: 0, w: 0 })
      write()
      delete el.dataset.pointer
      delete el.dataset.pointerLive
    }
  }, [host, on])
}
