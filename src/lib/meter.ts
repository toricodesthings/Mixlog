import { fileUrl } from './files'
import type { Answer, Job } from './meter.worker'
import { METER, analysisInput, type Analysis } from '#/server/loudness'

const hintOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

/** Runs one job in its own meter worker, gone when it answers or `signal` aborts. Null when it fails, is aborted, or
 *  where there are no workers. */
function run(job: Job, onProgress?: (share: number) => void, signal?: AbortSignal): Promise<Analysis | null> {
  if (typeof Worker === 'undefined' || signal?.aborted) return Promise.resolve(null)
  const worker = new Worker(new URL('./meter.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<Analysis | null>((resolve) => {
    signal?.addEventListener('abort', () => resolve(null), { once: true })
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

/** What the meter reads from a file on this device: as it uploads (`uploadAudio`), or on the public meter page. */
export const measure = (file: File, onProgress?: (share: number) => void, signal?: AbortSignal) =>
  run({ file, hint: hintOf(file.name) }, onProgress, signal)

/** What the meter reads from a version already stored (Measure): streamed from the Worker, read here. */
export const measureStored = (version: { id: string; size: number; filename: string }, onProgress?: (share: number) => void) =>
  run({ url: fileUrl(version.id), size: version.size, hint: hintOf(version.filename) }, onProgress)
