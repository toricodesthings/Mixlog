import { isTouchFirst } from '../../hooks/ui/use-shell-mode'

/**
 * The signal: live levels from what's playing, so the meters read the music and the listening room breathes with it.
 * One Web Audio analyser taps the player's <audio> elements, each through its own gain (A/B's audible side and Level
 * match's trim; the file itself is never changed).
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

let graph: { context: AudioContext; analyser: AnalyserNode } | null = null
/** Each tapped <audio>'s own gain (A/B's two decks), into the one analyser, so the meters read what's heard. */
const gains = new WeakMap<HTMLAudioElement, GainNode>()

/** Taps `audio` (once each), and wakes the analyser; null where it's off (touch devices, or no Web Audio). */
export function tap(audio: HTMLAudioElement): AnalyserNode | null {
  if (isTouchFirst() || navigator.maxTouchPoints > 0 || !('AudioContext' in window)) return null
  if (!graph) {
    const context = new AudioContext()
    const analyser = Object.assign(context.createAnalyser(), { fftSize: 2048, smoothingTimeConstant: 0.6 })
    analyser.connect(context.destination)
    graph = { context, analyser }
  }
  if (!gains.has(audio)) {
    // Silent until the player sets it (it does at once): a gain starting at 1 would let the idle deck through for a beat
    const gain = graph.context.createGain()
    gain.gain.value = 0
    graph.context.createMediaElementSource(audio).connect(gain).connect(graph.analyser)
    gains.set(audio, gain)
  }
  // Every play: a suspended context would be silence, now that the sound runs through it
  void graph.context.resume()
  return graph.analyser
}

/** Sets a tapped deck's gain (0 silent, 1 as uploaded) over ~10 ms, so a cut never clicks. False when `audio` isn't
 *  tapped (touch, or not played yet): the caller uses `muted` and `volume` instead. */
export function setGain(audio: HTMLAudioElement, value: number): boolean {
  const gain = gains.get(audio)
  if (!gain) return false
  gain.gain.setTargetAtTime(value, gain.context.currentTime, 0.003)
  return true
}

/** Settings' reduced motion or the system's: `applyAppearance` puts both on `data-motion`. */
const reduced = () => document.documentElement.dataset.motion === 'reduced'

/**
 * While playing, every frame: writes the levels as CSS variables (`--level-0`…`--level-4`, `--bass`, `--kick`) and
 * `data-live` on each `[data-signal]` element (the meters, the room), which draw them in CSS. Nothing re-renders.
 * A host as large as the room (`data-signal="readers"`) takes `data-live` but passes the levels only to its
 * `[data-signal-read]` elements: set on the host, they'd restyle every star and hill under it every frame.
 * Still under reduced motion, where ambient motion stops, from whichever frame it's turned on or off. Returns the stop.
 */
export function drive(analyser: AnalyserNode): () => void {
  const clear = () => document.querySelectorAll<HTMLElement>('[data-live]').forEach((el) => delete el.dataset.live)
  const bins = new Uint8Array(analyser.frequencyBinCount)
  const binHz = analyser.context.sampleRate / analyser.fftSize
  let feel = { bass: 0, kick: 0, average: 0 }
  let frame = 0
  let still = false
  const tick = () => {
    frame = requestAnimationFrame(tick)
    // Reduced motion turned on mid-song: still from the next frame (and alive again once it's off), not the next play
    if (reduced()) return void (still || ((still = true), clear()))
    still = false
    analyser.getByteFrequencyData(bins)
    const { bands, bass } = levelsOf(bins, binHz)
    feel = follow(feel, bass)
    const levels = bands.map((level) => level.toFixed(3))
    const [low, kick] = [feel.bass.toFixed(3), feel.kick.toFixed(3)]
    for (const host of document.querySelectorAll<HTMLElement>('[data-signal]')) {
      if (!('live' in host.dataset)) host.dataset.live = ''
      for (const el of host.dataset.signal === 'readers' ? host.querySelectorAll<HTMLElement>('[data-signal-read]') : [host]) {
        levels.forEach((level, i) => el.style.setProperty(`--level-${i}`, level))
        el.style.setProperty('--bass', low)
        el.style.setProperty('--kick', kick)
      }
    }
    // A host that stopped listening (A/B's idle half) goes still, not frozen mid-beat
    for (const el of document.querySelectorAll<HTMLElement>('[data-live]:not([data-signal])')) delete el.dataset.live
  }
  frame = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(frame)
    // Every element it lit, including meters that have already gone quiet (and dropped data-signal)
    clear()
  }
}
