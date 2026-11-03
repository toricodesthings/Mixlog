import { useEffect, useState } from 'react'

/** Scrolled this far one way before the dock follows, so a jittery thumb doesn't flicker it. */
const TRAVEL = 24

/**
 * Whether the phone dock is tucked away: scrolling a page down tucks it, scrolling up, reaching the top or changing
 * page brings it back. At a page's bottom it stays as it is, since tucking grows the page and nudges its scroll back up.
 */
export function useDockTucked(pathname: string) {
  const [tucked, setTucked] = useState(false)
  useEffect(() => setTucked(false), [pathname])
  useEffect(() => {
    const anchors = new WeakMap<Element, number>()
    const onScroll = (e: Event) => {
      const el = e.target
      if (!(el instanceof Element) || !el.closest('main')) return
      const top = el.scrollTop
      const anchor = anchors.get(el) ?? top
      if (top < TRAVEL) setTucked(false)
      else if (top + el.clientHeight >= el.scrollHeight - 2) anchors.set(el, top)
      else if (Math.abs(top - anchor) >= TRAVEL) setTucked(top > anchor)
      else return
      anchors.set(el, top)
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, { capture: true })
  }, [])
  return [tucked, setTucked] as const
}
