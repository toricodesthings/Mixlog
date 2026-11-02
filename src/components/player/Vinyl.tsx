import { cn } from '../../lib/utils'
import { ReleaseArt } from '../releases/ReleaseArt'

/**
 * A record on its platter, the release's artwork as its centre label. It turns at 33⅓ (1.8 s a turn, linear, never
 * eased) while it plays, and stops where it is when paused, the way a platter does; the light on it (`.vinyl-sheen`)
 * stays put while the grooves turn under it. The tonearm swings onto the record when it plays and back to its rest
 * when it stops. Decorative: what's playing is said in words beside it. Sized by `className`.
 */
export function Vinyl({ title, artworkId, spinning, className }: { title: string; artworkId: string | null; spinning: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('relative aspect-square', className)}>
      <div className="vinyl-halo absolute -inset-[22%] rounded-full" />
      <div className="vinyl-platter absolute -inset-[3.5%] rounded-full" />
      <div className="vinyl-disc absolute inset-0 rounded-full" data-spinning={spinning || undefined}>
        <div className="absolute inset-[31%] overflow-hidden rounded-full shadow-[0_0_0_2px_rgb(0_0_0/0.5)]">
          <ReleaseArt title={title} artworkId={artworkId} size="panel" className="rounded-full shadow-none" />
        </div>
        <div className="vinyl-spindle absolute inset-[48.6%] rounded-full" />
      </div>
      <div className="vinyl-sheen pointer-events-none absolute inset-0 rounded-full" />
      <Tonearm down={spinning} />
    </div>
  )
}

/** The arm, pivoting top right of the record (in the record's own 0–100 box): on the outer grooves, or lifted clear. */
function Tonearm({ down }: { down: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <g className="vinyl-arm" data-down={down || undefined}>
        {/* Counterweight behind the pivot, the arm, then the headshell with its cartridge */}
        <rect x="93" y="-6" width="6" height="8" rx="1.6" className="vinyl-arm-metal" transform="rotate(-14 96 6)" />
        <path d="M96,6 L84,48 L80.5,60" className="vinyl-arm-rod" />
        <path d="M78.2,58.6 L84.6,60.6 L82.8,67.2 L76.6,65.4 Z" className="vinyl-arm-metal" />
        <path d="M77.8,65.6 L82.2,66.9 L81.6,69.2 L77.2,67.9 Z" className="vinyl-arm-cartridge" />
        <circle cx="96" cy="6" r="5.5" className="vinyl-arm-base" />
        <circle cx="96" cy="6" r="2.2" className="vinyl-arm-metal" />
      </g>
    </svg>
  )
}
