// The meter's Web Worker: decodes and measures off the main thread, so a 4 GB WAV never freezes the page. A file being
// uploaded is read in place (FileReaderSync, 1 MB at a time); a stored one streams from the Worker.
import init, { measure_seekable, Pump } from '#meter'
import wasmUrl from '../../meter/pkg/mixlog_meter_bg.wasm?url'

export type Job = { file: File; hint: string } | { url: string; size: number; hint: string }
export type Answer = { reading: object } | { unreadable: true } | { error: string } | { progress: number }

declare const FileReaderSync: { new (): { readAsArrayBuffer(blob: Blob): ArrayBuffer } }
const scope = self as unknown as { postMessage(answer: Answer): void; onmessage: (event: MessageEvent<Job>) => void }

/** Up to this a stored file is read whole (an M4A keeps its index at the end); past it, pumped as it streams. */
const WHOLE_BYTES = 64 * 1024 ** 2

async function measure(job: Job): Promise<object> {
  await init({ module_or_path: wasmUrl })
  if ('file' in job) {
    const reader = new FileReaderSync()
    const read = (at: number, length: number) => new Uint8Array(reader.readAsArrayBuffer(job.file.slice(at, at + length)))
    return measure_seekable(job.file.size, read, job.hint)
  }
  const response = await fetch(job.url)
  if (!response.ok || !response.body) throw new Error('Couldn’t read the file.')
  const stream = response.body.getReader()
  const whole = job.size <= WHOLE_BYTES ? new Uint8Array(job.size) : null
  const pump = whole ? null : new Pump(job.hint)
  let got = 0
  try {
    for (;;) {
      const { done, value } = await stream.read()
      if (done) break
      if (whole) whole.set(value, got)
      else pump!.push(value)
      got += value.length
      scope.postMessage({ progress: Math.min(1, got / job.size) })
    }
  } catch (error) {
    pump?.free()
    throw error
  }
  return whole ? measure_seekable(got, (at: number, length: number) => whole.subarray(at, at + length), job.hint) : pump!.finish()
}

scope.onmessage = (event) => {
  measure(event.data).then(
    (reading) => scope.postMessage({ reading }),
    (error: unknown) => scope.postMessage(error instanceof Error && error.message === 'unreadable' ? { unreadable: true } : { error: String(error) }),
  )
}
