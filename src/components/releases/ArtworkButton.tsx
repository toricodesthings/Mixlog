import { useRouter } from '@tanstack/react-router'
import { ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'

import { ARTWORK_ACCEPT, artworkProblem } from '#/server/files'
import { useDropTarget } from '../../hooks/ui/use-drop-target'
import { uploadArtwork } from '../../lib/files'
import { cn } from '../../lib/utils'
import { Tip, Transfer } from '../primitives'
import { ReleaseArt } from './ReleaseArt'

/** The release's cover (in its page header, or its Summary scene), and the only way to its artwork: click it, or drop a PNG or JPG on it.
 *  A release has one artwork, so a new one replaces it. A failure goes to `onFailure` for the header to say; the cover retries. */
export function ArtworkButton({ releaseId, title, artworkId, onFailure, size = 'header' }: {
  releaseId: string
  title: string
  artworkId: string | null
  onFailure: (message: string | null) => void
  /** `panel`: the big cover on the Artwork & Canvas part; `stage`: standing in a release's Summary scene. */
  size?: 'header' | 'panel' | 'stage'
}) {
  const big = size !== 'header'
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatusOnly] = useState<'idle' | 'uploading' | 'failed'>('idle')
  const setState = (next: { status: 'idle' | 'uploading' } | { status: 'failed'; message: string }) => {
    setStatusOnly(next.status)
    onFailure(next.status === 'failed' ? next.message : null)
  }
  const [sent, setSent] = useState(0)
  const label = status === 'failed' ? 'Try the artwork again' : artworkId ? 'Replace the artwork' : 'Add artwork'

  const send = async (file: File | undefined) => {
    if (!file) return
    const problem = artworkProblem(file.type, file.size)
    if (problem) return setState({ status: 'failed', message: problem })
    setSent(0)
    setState({ status: 'uploading' })
    try {
      await uploadArtwork(releaseId, file, setSent)
      await router.invalidate()
      setState({ status: 'idle' })
    } catch (error) {
      setState({ status: 'failed', message: error instanceof Error ? error.message : 'Couldn’t add the artwork.' })
    }
  }

  const { over, props: drop } = useDropTarget({
    onFiles: (files) => (files.length > 1 ? setState({ status: 'failed', message: 'One artwork per release: drop a single PNG or JPG.' }) : void send(files[0])),
    enabled: status !== 'uploading',
  })

  return (
    <div className={size === 'panel' ? 'w-full' : 'flex shrink-0'}>
      <Tip label={label}>
        <button
          type="button"
          aria-label={label}
          aria-busy={status === 'uploading'}
          disabled={status === 'uploading'}
          onClick={() => input.current?.click()}
          {...drop}
          className={cn('group press relative', size === 'panel' ? 'block w-full rounded-[1.4rem]' : size === 'stage' ? 'block rounded-[1.4rem] sm:rounded-[1.8rem]' : 'rounded-2xl', status === 'failed' && 'ring-2 ring-feedback-error/70', over === 'files' && 'ring-2 ring-accent glow-accent')}
        >
          <ReleaseArt title={title} id={releaseId} artworkId={artworkId} full={size === 'panel'} size={size} className={size === 'stage' ? 'scene-cover' : undefined} />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center rounded-[inherit] bg-room-void/60 text-ink transition-opacity duration-(--duration-normal)',
              status === 'uploading' || over ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          >
            {status === 'uploading' ? (
              // Sent, then stored: the ring fills as it leaves, and the cover changes once it's in.
              <span className={cn('flex flex-col items-center', big ? 'gap-3' : 'gap-1')}>
                <Transfer direction="up" value={sent} label="Sending the artwork" className={big ? 'text-6xl' : 'text-2xl'} />
                {big && <span data-numeric className="readout text-sm text-ink">{sent < 1 ? `${Math.round(sent * 100)}%` : 'Storing'}</span>}
              </span>
            ) : (
              <ImagePlus size={big ? 28 : 20} aria-hidden="true" />
            )}
          </span>
        </button>
      </Tip>
      <input
        ref={input}
        type="file"
        accept={ARTWORK_ACCEPT}
        hidden
        onChange={(event) => {
          void send(event.target.files?.[0])
          event.target.value = '' // the same file can be picked again after a failure
        }}
      />
    </div>
  )
}
