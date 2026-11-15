/** A/B's pure rules (the engine in Player.tsx, the switch in ABSwitch.tsx): no DOM, unit-tested. */

export type Side = 'a' | 'b'

export const other = (side: Side): Side => (side === 'a' ? 'b' : 'a')

/** What putting version `id` on `side` does: `same` (it's already there), `swap` (it's on the other side and this one
 *  is filled), `refuse` (it's on the other side and this one is empty: one file on both compares nothing), else `load`. */
export const putOf = (decks: { a: string | null; b: string | null }, side: Side, id: string): 'same' | 'swap' | 'refuse' | 'load' =>
  decks[side] === id ? 'same' : decks[other(side)] === id ? (decks[side] ? 'swap' : 'refuse') : 'load'

/** Held shorter than this, a press latches; longer, it was an audition and goes back on release. */
export const HOLD_MS = 300

/** What a release does to a switch that already changed on press-down: `stay` (a tap latches) or `back` (a hold was
 *  momentary). With hold off, every press latches. */
export const releaseOf = (downAt: number, upAt: number, hold: boolean): 'stay' | 'back' => (hold && upAt - downAt >= HOLD_MS ? 'back' : 'stay')

/** Where a deck of `duration` seconds sits for the playhead at `seconds`: two bounces of one song line up in time, not
 *  in share, so it's the same second, held inside its own length (a deck past its end rests there). */
export const clampTo = (seconds: number, duration: number) => (Number.isFinite(duration) && duration > 0 ? Math.min(Math.max(seconds, 0), duration) : Math.max(seconds, 0))

/** How far the silent deck may drift from the one you hear before it's pulled back (seconds). ponytail: tuned by ear on
 *  transients; two media elements are never sample-locked, so this is a starting point, not a guarantee. */
export const DRIFT = 0.04

/** Whether the idle deck should be moved to `heard`: past the drift, and only while `heard` is inside its length. */
export const driftedOf = (heard: number, idle: number, idleDuration: number) => heard < idleDuration && Math.abs(heard - idle) > DRIFT

/** A trim in dB as a gain (−6 dB is about half). */
export const gainOf = (db: number) => 10 ** (db / 20)
