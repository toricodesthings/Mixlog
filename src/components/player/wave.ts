/** The loudness waveform's drawing rules: what a bar is on one fixed scale, and how 256 readings fit a width.
 *  The logic itself (pure, no bindings) lives in `#/server/loudness`, which the fingerprint also reads; this just
 *  keeps the names the player's code already uses. */
export { heightOf, pool } from '#/server/loudness'
