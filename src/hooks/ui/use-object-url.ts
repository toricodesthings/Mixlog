import { useEffect, useRef, useState } from 'react'

/** A picked file shown at once: the file and its blob URL, made when it's set and revoked when it's replaced or the page goes. */
export function useObjectFile() {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const held = useRef<string | null>(null)
  useEffect(() => () => { if (held.current) URL.revokeObjectURL(held.current) }, [])
  const set = (next: File | null) => {
    if (held.current) URL.revokeObjectURL(held.current)
    held.current = next ? URL.createObjectURL(next) : null
    setFile(next)
    setUrl(held.current)
  }
  return [file, url, set] as const
}
