import { useState } from 'react'

import { fileUrl } from '../../lib/files'
import { titleHue } from '../scene/palette'
import { cn } from '../../lib/utils'

const SIZES = {
  row: 'size-14 rounded-xl text-2xl',
  header: 'size-14 rounded-2xl text-2xl',
  panel: 'aspect-square w-full rounded-[1.4rem] text-7xl',
  cover: 'size-24 rounded-[1.4rem] text-5xl',
  stage: 'size-28 rounded-[1.4rem] text-6xl sm:size-44 sm:rounded-[1.8rem] sm:text-8xl',
} as const

/** The first letter or digit of a title, for its monogram. */
const monogramOf = (title: string) => (title.match(/[\p{L}\p{N}]/u)?.[0] ?? '♪').toLocaleUpperCase()

/** A release's cover: its current artwork, or a monogram pressed from its title (grooves and all) until it has one. Decorative; the title sits beside it.
 *  Its artwork on its way is a clip-shaped skeleton, fading into the image once it's here.
 *  `src` shows a picked image before it's uploaded. */
export function ReleaseArt({ title, artworkId, src, size, className }: { title: string; artworkId: string | null; src?: string; size: keyof typeof SIZES; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const url = src ?? (artworkId && fileUrl(artworkId))
  const showImage = url && broken !== url
  return (
    <span
      aria-hidden="true"
      className={cn('relative block shrink-0 overflow-hidden shadow-[0_8px_24px_-10px_rgb(0_0_0/0.6)]', SIZES[size], showImage && loaded !== url && 'skeleton', className)}
      style={{ '--art-hue': titleHue(title) } as React.CSSProperties}
    >
      {showImage ? (
        <img
          // A cached image is complete before React hears its load event
          ref={(img) => void (img?.complete && img.naturalWidth && setLoaded(url))}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(url)}
          onError={() => setBroken(url)}
          className={cn('size-full object-cover transition-opacity duration-(--duration-smooth)', loaded === url ? 'opacity-100' : 'opacity-0')}
        />
      ) : (
        <span className="art-monogram flex size-full items-center justify-center font-display font-semibold">{monogramOf(title)}</span>
      )}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/10 ring-inset" />
    </span>
  )
}
