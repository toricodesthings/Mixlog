import { UPLOAD_PART_BYTES, type AudioKind } from '#/server/files'

/** File bytes go through the Worker's /api routes, not server functions: the one place the app talks to the Worker directly. */

/** Where a version's file is served: an <img> or <audio> can point straight at it. */
export const fileUrl = (versionId: string) => `/api/files/${versionId}`

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

const failed = async (response: Response, fallback: string) => new Error((await response.text().catch(() => '')) || fallback)

/** Sends one part, trying again a few times: a dropped connection on the bus shouldn't lose the upload. */
async function sendPart(query: string, part: number, body: Blob, onSent: (bytes: number) => void): Promise<{ partNumber: number; etag: string }> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await sendWithProgress('PUT', `/api/uploads?${query}&part=${part}`, body, {}, onSent)
      if (response.ok) return JSON.parse(response.text)
      if (response.status < 500 || attempt === 3) throw new Error(response.text || 'Couldn’t send part of the file.')
    } catch (error) {
      if (attempt === 3) throw error
    }
    onSent(0) // a retry starts the part over
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
  }
}

/** Sends an audio file to a track's stack in ~10 MB parts. Resolves once it's stored as the next version;
 *  `onProgress` gets the share sent (0–1). On failure the parts already sent are dropped, never left as a half-version. */
export async function uploadAudio(
  { trackId, kind, file, contentType, durationMs }: { trackId: string; kind: AudioKind; file: File; contentType: string; durationMs: number | null },
  onProgress: (sent: number) => void,
): Promise<{ id: string; number: number }> {
  const started = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trackId, kind, filename: file.name.slice(0, 255), contentType, size: file.size }),
  })
  if (!started.ok) throw await failed(started, 'Couldn’t start the upload.')
  const { key, uploadId } = (await started.json()) as { key: string; uploadId: string }
  const query = new URLSearchParams({ key, uploadId }).toString()
  try {
    const parts = []
    for (let offset = 0, part = 1; offset < file.size; offset += UPLOAD_PART_BYTES, part++) {
      parts.push(await sendPart(query, part, file.slice(offset, offset + UPLOAD_PART_BYTES), (bytes) => onProgress(Math.min(1, (offset + bytes) / file.size))))
    }
    const done = await fetch('/api/uploads/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, uploadId, parts, durationMs }),
    })
    if (!done.ok) throw await failed(done, 'Couldn’t finish the upload.')
    return await done.json()
  } catch (error) {
    void fetch(`/api/uploads?${query}`, { method: 'DELETE' }).catch(() => {})
    throw error
  }
}
