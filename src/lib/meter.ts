import { fileUrl } from './files'
import type { Answer, Job } from './meter.worker'
import { METER, analysisInput, type Analysis } from '#/server/loudness'

const hintOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

/** Runs one job in its own meter worker, gone when it answers. Null when it fails, or where there are no workers. */
function run(job: Job, onProgress?: (share: number) => void): Promise<Analysis | null> {
  if (typeof Worker === 'undefined') return Promise.resolve(null)
  const worker = new Worker(new URL('./meter.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<Analysis | null>((resolve) => {
    worker.onmessage = ({ data }: MessageEvent<Answer>) => {
      if ('progress' in data) return onProgress?.(data.progress)
      if ('unreadable' in data) resolve({ meter: METER, unreadable: true })
      else if ('reading' in data) resolve(analysisInput.safeParse({ ...data.reading, meter: METER, source: 'device' }).data ?? null)
      else resolve(null)
    }
    worker.onerror = () => resolve(null)
    worker.postMessage(job)
  }).finally(() => worker.terminate())
}

/** What the meter reads from a file on this device: as it uploads (`uploadAudio`). */
export const measure = (file: File) => run({ file, hint: hintOf(file.name) })

/** What the meter reads from a version already stored (Measure): streamed from the Worker, read here. */
export const measureStored = (version: { id: string; size: number; filename: string }, onProgress?: (share: number) => void) =>
  run({ url: fileUrl(version.id), size: version.size, hint: hintOf(version.filename) }, onProgress)
