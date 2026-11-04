import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { MAX_AUDIO_BYTES, audioTypeOf, isFinal, type AudioKind } from '#/server/files'
import type { Lane } from '#/server/lanes'
import { readDuration, uploadAudio } from '../../lib/files'
import { saveLate } from '../meters/save'

/** Where a file can land on a track: a lane, or an alternate's row. */
export type Target = Lane | Exclude<AudioKind, 'master' | 'mix'>

/** A file on its way: queued, sending (its share sent, since `startedAt`, for the time left; then `phase`, once it's all
 *  sent) or failed with why. */
export type Pending = {
  key: number; file: File; target: Target; replaces?: string; note?: string; state: 'queued' | 'sending' | 'failed'; sent: number; startedAt: number
  phase?: Phase; error?: string
}
export type Phase = 'measuring' | 'storing'

/** Which files a drop on `target` sends, and where: only audio, and the Final lane only lossless files, the first one as
 *  the final and the rest as masters. `note` says what was left out or sent elsewhere, before anything goes. */
export function sortDrop(files: File[], target: Target): { send: { file: File; target: Target }[]; note: string | null } {
  const audio = files.filter((f) => audioTypeOf(f.name, f.type) && f.size <= MAX_AUDIO_BYTES)
  const notAudio = files.length - audio.length
  if (target !== 'final') return { send: audio.map((file) => ({ file, target })), note: notAudio ? `${notAudio === 1 ? 'One file isn’t' : `${notAudio} files aren’t`} audio, so ${notAudio === 1 ? 'it was' : 'they were'} left out.` : null }
  const lossless = audio.filter((f) => isFinal(audioTypeOf(f.name, f.type)!))
  const send = lossless.map((file, i) => ({ file, target: (i === 0 ? 'final' : 'master') as Target }))
  const note =
    lossless.length === 0 ? 'A test can’t be the final. Drop its WAV, AIFF or FLAC.'
    : lossless.length > 1 ? `${lossless[0].name} is the final; the other ${lossless.length - 1} went to Masters.`
    : audio.length > lossless.length ? 'Tests were left out: a final is a WAV, AIFF or FLAC.'
    : null
  return { send, note }
}

/** A track's uploads: files land in the lane (or alternate) they were dropped on or picked for, sent one at a time
 *  (on bad signal one finishing beats four half-sent). Each shows as pending in its lane until it's stored, then the
 *  page reloads and it's a version in place; a failure stays with its reason until it's tried again or dismissed.
 *  `landed` is the newest version stored here, for its one Phantom light. */
export function useLaneUpload(trackId: string) {
  const router = useRouter()
  const [pending, setPending] = useState<Pending[]>([])
  const [landed, setLanded] = useState<string | null>(null)
  const nextKey = useRef(0)
  const update = (key: number, change: Partial<Pending>) => setPending((all) => all.map((p) => (p.key === key ? { ...p, ...change } : p)))

  useEffect(() => {
    if (pending.some((p) => p.state === 'sending')) return
    const next = pending.find((p) => p.state === 'queued')
    if (!next) return
    update(next.key, { state: 'sending', sent: 0, startedAt: performance.now(), phase: undefined, error: undefined })
    void (async () => {
      try {
        const final = next.target === 'final'
        const kind = final ? 'master' : (next.target as AudioKind)
        const { id, late } = await uploadAudio(
          { trackId, kind, file: next.file, contentType: audioTypeOf(next.file.name, next.file.type)!, durationMs: await readDuration(next.file), final, replaces: next.replaces, note: next.note },
          (sent) => update(next.key, { sent }),
          (phase) => update(next.key, { phase }),
        )
        saveLate(id, late, () => void router.invalidate())
        await router.invalidate()
        setLanded(id)
        setPending((all) => all.filter((p) => p.key !== next.key))
      } catch (error) {
        update(next.key, { state: 'failed', sent: 0, error: (error instanceof Error && error.message) || 'Couldn’t send it.' })
      }
    })()
  }, [pending, router, trackId])

  return {
    pending,
    landed,
    /** Queues files for their targets (from `sortDrop`, or one picked file). `replaces` names the file each overwrites
     *  (Releases); `note` is what changed ("Final of v3"). */
    add: (files: { file: File; target: Target }[], { replaces, note }: { replaces?: string; note?: string } = {}) =>
      setPending((all) => [...all, ...files.map((f) => ({ ...f, replaces, note, key: nextKey.current++, state: 'queued' as const, sent: 0, startedAt: 0 }))]),
    retry: (key: number) => update(key, { state: 'queued' }),
    dismiss: (key: number) => setPending((all) => all.filter((p) => p.key !== key)),
  }
}
