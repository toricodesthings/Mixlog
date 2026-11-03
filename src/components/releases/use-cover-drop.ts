import { useState, type DragEvent } from 'react'

import { artworkProblem } from '#/server/files'

/** A cover is the only place artwork goes in: a PNG or JPG dropped on it, or a click (the caller's picker).
 *  Spread `props` on the cover; `over` is true while an image hovers it. A wrong file goes to `onProblem`.
 *  `problemOf` makes it any one-file target (a track's license). */
export function useCoverDrop(onFile: (file: File) => void, onProblem: (message: string) => void, enabled = true, problemOf = artworkDropProblem) {
  const [over, setOver] = useState(false)
  const files = (e: DragEvent) => enabled && e.dataTransfer.types.includes('Files')
  const props = {
    'data-own-drop': true,
    onDragEnter: (e: DragEvent) => files(e) && (e.preventDefault(), setOver(true)),
    onDragOver: (e: DragEvent) => files(e) && (e.preventDefault(), (e.dataTransfer.dropEffect = 'copy')),
    onDragLeave: (e: DragEvent) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setOver(false),
    onDrop: (e: DragEvent) => {
      if (!files(e)) return
      e.preventDefault()
      setOver(false)
      const file = e.dataTransfer.files[0]
      const problem = problemOf(e.dataTransfer.files)
      if (problem) onProblem(problem)
      else onFile(file)
    },
  }
  return { over, props }
}

function artworkDropProblem(files: FileList) {
  return files.length > 1 ? 'One artwork per release: drop a single PNG or JPG.' : artworkProblem(files[0]?.type ?? null, files[0]?.size ?? 0)
}

/** What the artwork pickers accept. */
export const ARTWORK_ACCEPT = 'image/png,image/jpeg,.png,.jpg,.jpeg'
