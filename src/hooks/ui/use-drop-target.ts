import { useState, type DragEvent } from 'react'

/** What a version dragged out of a lane carries: its ID. */
export const VERSION_DRAG = 'application/x-mixlog-version'

/** A drop target for files from the desktop, a version dragged from a lane, or either. Spread `props` on it; `over`
 *  says what hovers it. Only what it takes is taken (leave `onFiles` or `onVersion` out to refuse that kind), and a
 *  drop on it is its own, never the page's (`use-file-drop` skips `[data-own-drop]`). */
export function useDropTarget({ onFiles, onVersion, enabled = true }: { onFiles?: (files: File[]) => void; onVersion?: (id: string) => void; enabled?: boolean }) {
  const [over, setOver] = useState<'files' | 'version' | null>(null)
  const what = (e: DragEvent) =>
    !enabled ? null : onFiles && e.dataTransfer.types.includes('Files') ? 'files' : onVersion && e.dataTransfer.types.includes(VERSION_DRAG) ? 'version' : null
  const props = {
    'data-own-drop': true,
    onDragEnter: (e: DragEvent) => {
      const kind = what(e)
      if (kind) e.preventDefault(), setOver(kind)
    },
    onDragOver: (e: DragEvent) => {
      const kind = what(e)
      if (kind) e.preventDefault(), (e.dataTransfer.dropEffect = kind === 'files' ? 'copy' : 'move')
    },
    onDragLeave: (e: DragEvent) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setOver(null),
    onDrop: (e: DragEvent) => {
      const kind = what(e)
      if (!kind) return
      e.preventDefault()
      setOver(null)
      if (kind === 'files') onFiles!([...e.dataTransfer.files])
      else onVersion!(e.dataTransfer.getData(VERSION_DRAG))
    },
  }
  return { over, props }
}
