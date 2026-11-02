import { isTouchFirst } from '../../hooks/ui/use-shell-mode'

/**
 * The signal: live levels from what's playing, so the meters read the music and the listening room breathes with it.
 * One Web Audio analyser taps the player's <audio> (the file still plays exactly as uploaded; nothing is changed).
 *
 * Desktop only. Routing an <audio> through Web Audio can't be undone, and on iPhone and iPad Safari it has a long
 * record of going silent or stopping when the screen locks: playback never stopping outranks a dancing meter. There
 * (touch, or any touch points at all, which catches an iPad with a trackpad) the meters keep their own dance.
 */

/** Five bands for the meters (Hz edges, low to high), and the low end the room feels. */
const EDGES = [40, 160, 500, 1600, 5000, 14000]
const BASS = [30, 150] as const
/** Highs carry less energy than lows; lift them so every bar moves. */
const TILT = [1, 1.05, 1.15, 1.3, 1.45]

/** The average of `bins` (0–255 each) between two frequencies, 0–1. */
function average(bins: Uint8Array, binHz: number, low: number, high: number) {
  const from = Math.max(1, Math.floor(low / binHz))
  const to = Math.min(bins.length, Math.max(from + 1, Math.ceil(high / binHz)))
  let sum = 0
  for (let i = from; i < to; i++) sum += bins[i]
  return sum / ((to - from) * 255)
}

/** A frame of the analyser's spectrum as the five meter levels (each 0.15 at silence to 1) and the bass (0–1). */
export function levelsOf(bins: Uint8Array, binHz: number) {
  return {
    bands: TILT.map((tilt, i) => 0.15 + 0.85 * Math.min(1, average(bins, binHz, EDGES[i], EDGES[i + 1]) * tilt)),
    bass: average(bins, binHz, ...BASS),
  }
}

/**
 * The room's feel of the low end. `bass` rises at once and falls slowly (a lamp, not a strobe); `kick` is how far a
 * hit jumps above the recent average, and fades in a few frames: what makes the stars pulse.
 */
export function follow(previous: { bass: number; kick: number; average: number }, bass: number) {
  const average = previous.average + (bass - previous.average) * 0.03
  return {
    bass: Math.max(bass, previous.bass * 0.94),
    kick: Math.max(Math.min(1, Math.max(0, bass - average) * 5), previous.kick * 0.86),
    average,
  }
}

let graph: { context: AudioContext; analyser: AnalyserNode; audio: HTMLAudioElement } | null = null

/** Taps `audio` (once), and wakes the analyser; null where it's off (touch devices, or no Web Audio). */
export function tap(audio: HTMLAudioElement): AnalyserNode | null {
  if (isTouchFirst() || navigator.maxTouchPoints > 0 || !('AudioContext' in window)) return null
  if (graph?.audio !== audio) {
    const context = graph?.context ?? new AudioContext()
    const analyser = graph?.analyser ?? Object.assign(context.createAnalyser(), { fftSize: 2048, smoothingTimeConstant: 0.6 })
    if (!graph) analyser.connect(context.destination)
    context.createMediaElementSource(audio).connect(analyser)
    graph = { context, analyser, audio }
  }
  // Every play: a suspended context would be silence, now that the sound runs through it
  void graph.context.resume()
  return graph.analyser
}

const reduced = () =>
  document.documentElement.dataset.motion === 'reduced' || (document.documentElement.dataset.motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches)

/**
 * While playing, every frame: writes the levels as CSS variables (`--level-0`…`--level-4`, `--bass`, `--kick`) and
 * `data-live` on each `[data-signal]` element (the meters, the room), which draw them in CSS. Nothing re-renders.
 * Off under reduced motion, where ambient motion stops. Returns the stop.
 */
export function drive(analyser: AnalyserNode): () => void {
  if (reduced()) return () => {}
  const bins = new Uint8Array(analyser.frequencyBinCount)
  const binHz = analyser.context.sampleRate / analyser.fftSize
  let feel = { bass: 0, kick: 0, average: 0 }
  let frame = 0
  const tick = () => {
    analyser.getByteFrequencyData(bins)
    const { bands, bass } = levelsOf(bins, binHz)
    feel = follow(feel, bass)
    for (const el of document.querySelectorAll<HTMLElement>('[data-signal]')) {
      el.dataset.live = ''
      bands.forEach((level, i) => el.style.setProperty(`--level-${i}`, level.toFixed(3)))
      el.style.setProperty('--bass', feel.bass.toFixed(3))
      el.style.setProperty('--kick', feel.kick.toFixed(3))
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(frame)
    // Every element it lit, including meters that have already gone quiet (and dropped data-signal)
    for (const el of document.querySelectorAll<HTMLElement>('[data-live]')) delete el.dataset.live
  }
}
