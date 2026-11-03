import { UPLOAD_PART_BYTES, licenseTypeOf, type AudioKind } from '#/server/files'

/** File bytes go through the Worker's /api routes, not server functions: the one place the app talks to the Worker directly. */

/** Where a version's file is served: an <img> or <audio> can point straight at it. */
export const fileUrl = (versionId: string) => `/api/files/${versionId}`
/** The same file, saved under its own filename instead of opened. */
export const downloadUrl = (versionId: string) => `${fileUrl(versionId)}?download`

/** A version's bytes, for a viewer that reads them itself (a license's PDF or Word document). */
export async function readFile(versionId: string): Promise<ArrayBuffer> {
  const response = await fetch(fileUrl(versionId))
  if (!response.ok) throw new Error('Couldn’t open this file. Try again.')
  return response.arrayBuffer()
}

/** Sends a body with XHR, not fetch: only XHR reports bytes as they leave (`fetch` can't, in every browser), and
 *  that's what a progress bar needs. `onSent` gets the bytes sent so far. Rejects only when the connection drops. */
function sendWithProgress(method: string, url: string, body: Blob, headers: Record<string, string>, onSent: (bytes: number) => void) {
  return new Promise<{ ok: boolean; status: number; text: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (event) => onSent(event.loaded)
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText })
    xhr.onerror = xhr.ontimeout = () => reject(new Error('The connection dropped. Try again.'))
    xhr.send(body)
  })
}

/** Sends an image as the release's next artwork version. Resolves when it's stored; rejects with the Worker's reason.
 *  `onProgress` gets the share sent (0–1). */
export async function uploadArtwork(releaseId: string, file: File, onProgress: (sent: number) => void = () => {}): Promise<void> {
  const response = await sendWithProgress(
    'POST',
    `/api/releases/${releaseId}/artwork`,
    file,
    { 'content-type': file.type, 'x-filename': file.name.slice(0, 255) },
    (bytes) => onProgress(bytes / file.size),
  )
  if (!response.ok) throw new Error(response.text || 'Couldn’t add the artwork.')
}

/** Sends a PDF or Word document as the track's next license. Typed by extension: browsers disagree on a .doc's. */
export async function uploadLicense(trackId: string, file: File, onProgress: (sent: number) => void = () => {}): Promise<{ id: string; number: number }> {
  const response = await sendWithProgress(
    'POST',
    `/api/tracks/${trackId}/license`,
    file,
    { 'content-type': licenseTypeOf(file.name) ?? file.type, 'x-filename': file.name.slice(0, 255) },
    (bytes) => onProgress(bytes / file.size),
  )
  if (!response.ok) throw new Error(response.text || 'Couldn’t add the license.')
  return JSON.parse(response.text)
}

const failed = async (response: Response, fallback: string) => new Error((await response.text().catch(() => '')) || fallback)

/** Sends one part, trying again a few times: a dropped connection on the bus shouldn't lose the upload. */
async function sendPart(query: string, part: number, body: Blob, onSent: (bytes: number) => void): Promise<{ partNumber: number; etag: string }> {
  for (let attempt = 1; ; attempt++) {
    let response
    try {
      response = await sendWithProgress('PUT', `/api/uploads?${query}&part=${part}`, body, {}, onSent)
    } catch (error) {
      if (attempt === 3) throw error
    }
    if (response?.ok) return JSON.parse(response.text)
    // Refused (4xx) is final; a server error is tried again like a dropped connection.
    if (response && (response.status < 500 || attempt === 3)) throw new Error(response.text || 'Couldn’t send part of the file.')
    onSent(0) // a retry starts the part over
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
  }
}

/** Sends an audio file to a track's stack in ~10 MB parts. Resolves once it's stored as the next version;
 *  `onProgress` gets the share sent (0–1). On failure the parts already sent are dropped, never left as a half-version.
 *  `final` lands it as the track's final (a lossless master); `replaces` names the file it overwrites in Releases. */
export async function uploadAudio(
  { trackId, kind, file, contentType, durationMs, note, final, replaces }: {
    trackId: string; kind: AudioKind; file: File; contentType: string; durationMs: number | null; note?: string; final?: boolean; replaces?: string
  },
  onProgress: (sent: number) => void,
): Promise<{ id: string; number: number }> {
  const started = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trackId, kind, filename: file.name.slice(0, 255), contentType, size: file.size, final, replaces }),
  })
  if (!started.ok) throw await failed(started, 'Couldn’t start the upload.')
  // The upload is its track, stack and version ID: the Worker keeps where in storage that goes.
  const { id, uploadId } = (await started.json()) as { id: string; uploadId: string }
  const upload = { trackId, kind, id, uploadId }
  const query = new URLSearchParams(upload).toString()
  try {
    const parts = []
    for (let offset = 0, part = 1; offset < file.size; offset += UPLOAD_PART_BYTES, part++) {
      parts.push(await sendPart(query, part, file.slice(offset, offset + UPLOAD_PART_BYTES), (bytes) => onProgress(Math.min(1, (offset + bytes) / file.size))))
    }
    const done = await fetch('/api/uploads/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...upload, parts, durationMs, note, final, replaces }),
    })
    if (!done.ok) throw await failed(done, 'Couldn’t finish the upload.')
    return await done.json()
  } catch (error) {
    void fetch(`/api/uploads?${query}`, { method: 'DELETE' }).catch(() => {})
    throw error
  }
}

/** How long a file plays, read by the browser; null when it can't play it (AIFF in most). */
export function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)
    const done = (ms: number | null) => (URL.revokeObjectURL(url), resolve(ms))
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null)
    audio.onerror = () => done(null)
    audio.src = url
  })
}
