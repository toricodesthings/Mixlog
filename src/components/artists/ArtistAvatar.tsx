import { useState, type CSSProperties } from 'react'

import { cn } from '../../lib/utils'
import { idHue } from '../scene/palette'

const SIZES = {
  tiny: 'size-[1.125rem] text-[0.4375rem]',
  chip: 'size-7 text-[0.6875rem]',
  row: 'size-12 text-base',
  pick: 'size-16 text-xl',
  card: 'aspect-square w-full text-[clamp(2rem,6vw,3.5rem)]',
  profile: 'size-40 text-5xl sm:size-48',
} as const

/** Up to two initials, for an artist with no picture. */
const initialsOf = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => [...word][0]).join('').toLocaleUpperCase() || '?'

/** An artist's round portrait: their picture, or initials pressed in their own hue (the release monogram's grooves).
 *  Decorative: the name always sits beside it. `src` shows a picked picture before it's sent. */
export function ArtistAvatar({ id, name, src, size, className }: { id: string; name: string; src: string | null; size: keyof typeof SIZES; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  const shown = src && broken !== src
  return (
    <span
      aria-hidden="true"
      className={cn('relative block shrink-0 overflow-hidden rounded-full shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)]', SIZES[size], className)}
      style={{ '--art-hue': idHue(id) } as CSSProperties}
    >
      {shown ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(src)} className="glass-card-art size-full object-cover" />
      ) : (
        <span className="art-monogram flex size-full items-center justify-center font-display font-semibold tracking-tight">{initialsOf(name)}</span>
      )}
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/10 ring-inset" />
    </span>
  )
}
