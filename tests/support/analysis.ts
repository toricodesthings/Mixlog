import type { Measured } from '#/server/loudness'

/** A whole reading, as the meter writes one; `over` changes what a test is about. */
export const reading = (over: Partial<Measured> = {}): Measured => ({
  meter: 1, source: 'device',
  format: { codec: 'pcm', rate: 48_000, bits: 24, channels: 2, kbps: null },
  ms: 242_113, lufs: -9.2, lra: 5.1, momentaryMax: -5.9, shortTermMax: -7.4,
  truePeak: 0.3, samplePeak: -0.1, plr: 9.5, dr: 8,
  correlation: { mean: 0.82, min: 0.31, minAtMs: 131_400 },
  clipped: 14, dc: [-96.2, -97], loudest: { atMs: 158_300, lufs: -7.4 },
  wave: Array(256).fill(-20),
  ...over,
})
