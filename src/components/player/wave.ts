/** The loudness waveform's drawing rules, pure: what a bar is on one fixed scale, and how 256 readings fit a width. */

/** Drawn as amplitude, not decibels: a bar is 10^((LUFS − TOP) / 20), so 6 dB quieter is half as tall and a chorus
 *  stands clear of its verse. One fixed scale, never per song, so a louder master looks louder beside its mix. */
const TOP = -3
/** Silence keeps a stub, so the song's shape still reads. */
const STUB = 0.04

/** A bar's height, 0–1, for a short-term loudness reading. */
export const heightOf = (lufs: number) => Math.min(1, Math.max(STUB, 10 ** ((lufs - TOP) / 20)))

/** `wave` as `bars` bars, each the loudest reading in its share (never averaged away: a peak stays a peak). With
 *  more bars than readings, neighbours repeat. */
export function pool(wave: number[], bars: number): number[] {
  const n = wave.length
  return Array.from({ length: Math.max(0, bars) }, (_, i) => {
    const from = Math.floor((i * n) / bars)
    const to = Math.max(from + 1, Math.floor(((i + 1) * n) / bars))
    let max = -Infinity
    for (let j = from; j < to; j++) max = Math.max(max, wave[j])
    return max
  })
}
