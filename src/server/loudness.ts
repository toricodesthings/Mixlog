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
