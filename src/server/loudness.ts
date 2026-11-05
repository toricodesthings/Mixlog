// What the meter (meter/) read from a bounce, and the pure rules the meter bridge reads from it. Shared with the browser:
// no bindings here.
import { z } from 'zod'

/** Bump with any change to meter/ that moves a reading; the cron re-measures older ones. */
export const METER = 1

/** Rounded to 0.1, as the meter writes it. */
const db = (min: number, max: number) => z.number().min(min).max(max).transform((v) => Math.round(v * 10) / 10)
const unit = z.number().min(-1).max(1)

const measured = z.object({
  meter: z.int().positive(),
  source: z.enum(['device', 'worker']),
  format: z.object({
    codec: z.enum(['pcm', 'flac', 'mp3', 'aac', 'alac', 'vorbis']),
    rate: z.int().min(8_000).max(768_000),
    bits: z.int().min(8).max(64).nullable(),
    channels: z.int().min(1).max(32),
    kbps: z.int().positive().max(10_000).nullable(),
  }),
  ms: z.int().positive().lt(86_400_000),
  lufs: db(-70, 10).nullable(),
  lra: db(0, 60).nullable(),
  momentaryMax: db(-70, 10).nullable(),
  shortTermMax: db(-70, 10).nullable(),
  truePeak: db(-200, 30),
  samplePeak: db(-200, 30),
  plr: db(0, 100).nullable(),
  dr: z.int().min(0).max(40).nullable(),
  correlation: z.object({ mean: unit, min: unit, minAtMs: z.int().min(0) }).nullable(),
  clipped: z.int().min(0),
  dc: z.array(db(-120, 0)).max(32),
  loudest: z.object({ atMs: z.int().min(0), lufs: db(-70, 10) }).nullable(),
  wave: z.array(db(-70, 10)).length(256),
})
// A file the meter couldn't decode (Opus, DRM): stamped so the cron doesn't retry it nightly; the bridge reads NO READING.
const unreadable = z.object({ meter: z.int().positive(), unreadable: z.literal(true) })
export const analysisInput = z.union([measured, unreadable])
export type Analysis = z.infer<typeof analysisInput>
export type Measured = z.infer<typeof measured>

export const isMeasured = (a: Analysis | null | undefined): a is Measured => !!a && !('unreadable' in a)

/** What each platform does to a song's level at its default setting. `up`: whether it turns quiet songs up (to
 *  `ceiling` dBTP at most) or only down. Platforms change this; re-check before each release that touches it:
 *  Spotify https://support.spotify.com/artists/article/loudness-normalization/ · Apple Music (Sound Check)
 *  https://www.apple.com/apple-music/apple-digital-masters/ · YouTube, Tidal, Amazon Music, Deezer: their help pages. */
export const PLATFORMS = [
  { name: 'Spotify', target: -14, up: true, ceiling: -1 },
  { name: 'Apple Music', target: -16, up: true, ceiling: -1 },
  { name: 'YouTube', target: -14, up: false, ceiling: null },
  { name: 'Tidal', target: -14, up: false, ceiling: null },
  { name: 'Amazon Music', target: -14, up: false, ceiling: null },
  { name: 'Deezer', target: -15, up: false, ceiling: null },
] as const
export type Platform = (typeof PLATFORMS)[number]

/** The gain in dB a platform plays this song at: down to its target, or up as far as its peak ceiling allows. */
export function normalizationOf(a: Measured, p: Platform): number | null {
  if (a.lufs === null) return null
  const by = p.target - a.lufs
  if (by <= 0) return round1(by)
  if (!p.up) return 0
  return round1(Math.max(0, Math.min(by, p.ceiling - a.truePeak)))
}

type Laned = { id: string; track_id: string | null; kind: string; number: number }

/** The version this one is compared with: the highest-numbered lower one in its lane (Mixes for a mix; Masters, the
 *  final included, for a master; its own stack for an alternate). Moves with the version when it changes lanes. */
export function previousOf<V extends Laned>(version: V, versions: V[]): V | null {
  let best: V | null = null
  for (const v of versions)
    if (v.track_id === version.track_id && v.kind === version.kind && v.number < version.number && (!best || v.number > best.number)) best = v
  return best
}

/** The bridge's four instruments, in the order an engineer reads a master: loudness, true peak, phase, dynamics. */
export const HEADLINE = ['lufs', 'truePeak', 'correlation', 'plr'] as const
export type Headline = (typeof HEADLINE)[number]
export type Delta = { by: number; same: boolean }

/** An instrument's value: the correlation's whole-song mean, else the reading itself; null where there's none. */
export const valueOf = (a: Measured, key: Headline): number | null => (key === 'correlation' ? (a.correlation?.mean ?? null) : a[key])

/** Each instrument's change since `before`; null when either wasn't measured, or by different meters. Phase moves in
 *  hundredths, the rest in tenths. */
export function deltaOf(now: Analysis | null, before: Analysis | null): Partial<Record<Headline, Delta>> | null {
  if (!isMeasured(now) || !isMeasured(before) || now.meter !== before.meter) return null
  const out: Partial<Record<Headline, Delta>> = {}
  for (const key of HEADLINE) {
    const a = valueOf(now, key)
    const b = valueOf(before, key)
    if (a === null || b === null) continue
    const unit = key === 'correlation' ? 100 : 10
    const by = Math.round((a - b) * unit) / unit
    out[key] = { by, same: by === 0 }
  }
  return out
}

const round1 = (v: number) => Math.round(v * 10) / 10

// --- The fingerprint (1.3.0): a song's first measured bounce, read once into ~30 numbers that shape its night
// (scene/generate.ts). Stored on `tracks.scene`/`releases.scene`, stamped only `WHERE scene IS NULL`, never rewritten.

/** `wave` (256 readings) as `bars` bars, each the loudest reading in its share (never averaged away: a peak stays a
 *  peak). With more bars than readings, neighbours repeat. Shared with the browser (LoudnessWave draws the same way). */
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

/** Drawn as amplitude, not decibels: a bar is 10^((LUFS − TOP) / 20), so 6 dB quieter is half as tall and a chorus
 *  stands clear of its verse. One fixed scale, never per song, so a louder master looks louder beside its mix. */
const WAVE_TOP = -3
/** Silence keeps a stub, so the song's shape still reads. */
const WAVE_STUB = 0.04

/** A bar's height, 0–1, for a short-term loudness reading. */
export const heightOf = (lufs: number) => Math.min(1, Math.max(WAVE_STUB, 10 ** ((lufs - WAVE_TOP) / 20)))

const unit01 = z.number().min(0).max(1).transform((v) => Math.round(v * 100) / 100)
const clamp01 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100
/** `v` mapped linearly so `from` lands at 0 and `to` lands at 1, clamped to 0–1. */
const lerp01 = (v: number, from: number, to: number) => clamp01((v - from) / (to - from))

export const fingerprint = z.object({
  v: z.literal(1),
  loud: unit01, // lufs: −30 → 0, −6 → 1
  dyn: unit01, // plr: 4 → 0, 20 → 1 (else lra 2 → 16, else dr 3 → 16)
  width: unit01, // 1 − correlation.mean: 0 → 0, .8 → 1
  weather: unit01, // lra: 2 → 0, 16 → 1
  peak: unit01, // loudest.atMs / ms
  length: unit01, // ms: 90s → 0, 360s → 1
  env: z.array(unit01).length(24), // wave pooled to 24 (pool, max), each heightOf(), then ÷ its max
})
export type Fingerprint = z.infer<typeof fingerprint>

/** The envelope today's fixed `SIGNAL` ridge would read as an `env`, for a song with no reading yet. Thirteen keys'
 *  y-values (138–224, higher is louder) turned back into 24 amplitudes 0–1. */
const DEFAULT_ENV = [0.58, 0.72, 0.84, 0.95, 1, 0.9, 0.78, 0.66, 0.56, 0.52, 0.58, 0.68, 0.8, 0.9, 0.98, 0.94, 0.84, 0.74, 0.7, 0.66, 0.6, 0.54, 0.62, 0.52]

/** Every value at its midpoint, env the default contour: the night before any bounce is measured, still unique by
 *  its seed (the track's id). */
export const DEFAULT_FINGERPRINT: Fingerprint = { v: 1, loud: 0.5, dyn: 0.5, width: 0.4, weather: 0.4, peak: 0.62, length: 0.4, env: DEFAULT_ENV }

/** The fingerprint read from a song's first measured mix or master. Pure, clamped, never throws: a measurement at the
 *  edge of its range still gives a fingerprint rather than failing the stamp. */
export function fingerprintOf(a: Measured): Fingerprint {
  const loud = a.lufs === null ? DEFAULT_FINGERPRINT.loud : lerp01(a.lufs, -30, -6)
  const dyn =
    a.plr !== null ? lerp01(a.plr, 4, 20) : a.lra !== null ? lerp01(a.lra, 2, 16) : a.dr !== null ? lerp01(a.dr, 3, 16) : DEFAULT_FINGERPRINT.dyn
  const width = a.correlation ? lerp01(1 - a.correlation.mean, 0, 0.8) : DEFAULT_FINGERPRINT.width
  const weather = a.lra === null ? DEFAULT_FINGERPRINT.weather : lerp01(a.lra, 2, 16)
  const peak = a.loudest && a.ms > 0 ? clamp01(a.loudest.atMs / a.ms) : DEFAULT_FINGERPRINT.peak
  const length = lerp01(a.ms / 1000, 90, 360)
  const bars = pool(a.wave, 24).map(heightOf)
  const max = Math.max(...bars, 1e-6)
  const env = bars.map((v) => clamp01(v / max))
  return fingerprint.parse({ v: 1, loud, dyn, width, weather, peak, length, env })
}
