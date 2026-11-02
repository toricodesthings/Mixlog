import { useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import { saveLyrics } from '#/server/tracks'

/** Cadence's note rhythm: save once typing pauses, and at least every two seconds while it doesn't. */
const IDLE_MS = 600
const MAX_WAIT_MS = 2_000

export type LyricsStatus = 'saved' | 'saving' | 'failed'

/**
 * A track's lyrics as they're written, saved by themselves: the folded panel and the writing room share one of these,
 * so they show the same text and the same status. One save at a time; the newest text always goes last. Leaving the
 * page with text unsaved asks first; leaving the release refreshes what its pages read.
 */
export function useLyrics(trackId: string, initial: string) {
  const router = useRouter()
  const [text, setText] = useState(initial)
  const [status, setStatus] = useState<LyricsStatus>('saved')
  const latest = useRef(initial)
  const stored = useRef(initial)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const firstDirty = useRef(0)
  const running = useRef<Promise<void> | null>(null)
  const wrote = useRef(false)

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current)
    firstDirty.current = 0
    while (running.current) await running.current
    const body = latest.current
    if (body === stored.current) return (setStatus('saved'), true)
    let ok = true
    running.current = saveLyrics({ data: { trackId, lyrics: body } })
      .then(() => {
        stored.current = body
        wrote.current = true
      })
      .catch(() => {
        ok = false
      })
      .finally(() => {
        running.current = null
      })
    await running.current
    if (!ok) return (setStatus('failed'), false)
    // Typed on while it saved: the next save follows on its own schedule
    setStatus(latest.current === body ? 'saved' : 'saving')
    return true
  }, [trackId])

  const edit = useCallback(
    (next: string) => {
      latest.current = next
      setText(next)
      setStatus('saving')
      clearTimeout(timer.current)
      const now = Date.now()
      firstDirty.current ||= now
      timer.current = setTimeout(() => void flush(), Math.min(IDLE_MS, firstDirty.current + MAX_WAIT_MS - now))
    },
    [flush],
  )

  // The tab closing with words unsaved asks first; the browser's own prompt, no words of ours needed
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => latest.current !== stored.current && event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  // Leaving: send what's left, then let the release's pages read the new lyrics
  useEffect(
    () => () => {
      void flush().then(() => {
        if (wrote.current) void router.invalidate()
      })
    },
    [flush, router],
  )

  return { text, status, edit, flush }
}
