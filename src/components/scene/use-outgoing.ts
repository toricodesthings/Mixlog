import { useEffect, useRef, useState } from 'react'

/** The fade between two nights of one song (its measurement arriving): the value it had, for `ms` after its `key`
 *  changes under the same `id`, then null. A different id (another song) swaps at once. */
export function useOutgoing<T>(id: string, key: string, value: T, ms = 450): { key: string; value: T } | null {
  const [out, setOut] = useState<{ key: string; value: T } | null>(null)
  const last = useRef({ id, key, value })
  useEffect(() => {
    const before = last.current
    last.current = { id, key, value }
    if (before.key === key) return
    if (before.id !== id) return setOut(null)
    setOut({ key: before.key, value: before.value })
    const timer = setTimeout(() => setOut(null), ms)
    return () => clearTimeout(timer)
  }, [id, key, value, ms])
  return out
}
