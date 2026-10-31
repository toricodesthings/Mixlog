import { Led, Meter } from '../primitives'

/** Files hovering Upcoming or Releases: the desk arms its input. Lets the drop through to the window; nothing is saved by dropping. */
export function DropOverlay({ released }: { released: boolean }) {
  return (
    <div aria-hidden="true" className="layer-route-overlay pointer-events-none fixed inset-0 flex items-center justify-center bg-room-void/55 p-6 backdrop-blur-sm animate-in fade-in-0 duration-150">
      <div className="pointer-events-none absolute inset-4 rounded-[2rem] border-2 border-dashed border-accent/60 glow-accent sm:inset-6" />
      <div className="surface-dialog glass-edge flex max-w-sm flex-col items-center gap-4 rounded-[2rem] px-10 py-9 text-center animate-in zoom-in-95 duration-200">
        <Meter live className="h-12 gap-1 [&>span]:w-2" />
        {/* +48V: the one light on the desk you didn't expect, lit while the input is armed. This screen's Phantom moment. */}
        <p className="readout flex items-center gap-2 text-ink-muted">
          <Led tone="phantom" />
          +48V · Input armed
        </p>
        <p className="font-display text-2xl font-semibold tracking-tight text-ink">{released ? 'Drop to add a release' : 'Drop to start a release'}</p>
        <p className="text-sm text-ink-soft">You’ll name it and check it before anything is saved.</p>
      </div>
    </div>
  )
}
