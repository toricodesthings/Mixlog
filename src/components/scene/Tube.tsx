import type { CSSProperties, HTMLAttributes } from 'react'

/** The amp tube's body, in its own units (base at y 0, cap at y −28): glass envelope, plate, base. Shared by the boot
 *  screen (its edges) and the scene (the shore lamp, the amp on the knoll); colours come from the caller. */
export function TubeBody({ glass, rim, base }: { glass: string; rim: string; base: string }) {
  return (
    <>
      <path d="M-5 -6V-22A5 5 0 0 1 5 -22V-6Z" fill={glass} stroke={rim} strokeWidth=".8" />
      <circle cy="-27.6" r="1" fill={rim} />
      <rect x="-2.6" y="-19" width="5.2" height="9" rx=".8" fill={base} opacity=".7" />
      <rect x="-6" y="-6" width="12" height="6" rx="1.5" fill={base} />
    </>
  )
}

/** A small tube in the scene: on a post, its filament glowing in the room's lamp colour (`glowing`: the amp's warm one). */
export function TubeShape({ glowing, className, style, ...rest }: { glowing?: boolean; className?: string; style?: CSSProperties } & HTMLAttributes<HTMLSpanElement>) {
  const light = glowing ? 'var(--scene-window)' : 'var(--scene-lamp)'
  return (
    <span aria-hidden="true" className={className} style={style} {...rest}>
      <svg viewBox="-14 -44 28 52" className="block w-full overflow-visible">
        <circle cy="-14" r="13" fill={light} opacity=".22" className="scene-tube-glow" />
        <TubeBody glass="color-mix(in oklab, var(--land-rim) 18%, transparent)" rim="color-mix(in oklab, var(--land-rim) 60%, transparent)" base="var(--land-fore)" />
        <rect x="-.7" y="-18.5" width="1.4" height="8" rx=".7" fill={light} />
        {!glowing && <rect x="-.8" y="0" width="1.6" height="8" fill="var(--land-fore)" />}
      </svg>
    </span>
  )
}
