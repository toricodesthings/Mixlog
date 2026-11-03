/** Moving a release to Releases: what ships, what's kept and what's pruned. Pure, shared with the browser. */
import { isFinal } from '#/server/files'

/** How long what didn't ship is kept after a release goes out (Settings → Releases): pruned versions wait this many
 *  days before the cleanup cron erases them, and until then the release can move back. Null keeps everything: nothing
 *  is pruned and it can always move back. Read when it's used, so a change applies to releases already waiting. */
export type KeepDays = 7 | 14 | 30 | null
export const KEEP_CHOICES: KeepDays[] = [7, 14, 30, null]
export const DEFAULT_KEEP_DAYS: KeepDays = 14

/** A version as the rules read it: its track (null for the release's own, like artwork), stack and whether it's current. */
type Row = { id: string; track_id: string | null; kind: string; number: number; content_type: string; is_current: number }

/** Stacks whose current version ships with the track. Mixes don't ship, and a track's licenses are kept whole. */
const SHIPS = ['master', 'instrumental', 'acapella', 'stems', 'canvas', 'video', 'other']

/** A track's masters, newest first: what the final-master picker offers. */
export const mastersOf = <T extends Row>(trackId: string, rows: T[]) => rows.filter((v) => v.track_id === trackId && v.kind === 'master').sort((a, b) => b.number - a.number)

/** The track's final master: its current master, when that's lossless. Null means one must be picked (or its WAV sent). */
export const finalMasterOf = <T extends Row>(trackId: string, rows: T[]): T | null =>
  rows.find((v) => v.track_id === trackId && v.kind === 'master' && v.is_current && isFinal(v.content_type)) ?? null

/** What ships: each track's current version of every stack but the mixes. */
export const shippedOf = (rows: Row[]) => rows.filter((v) => v.track_id && v.is_current && SHIPS.includes(v.kind)).map((v) => v.id)

/** What's pruned: every other version on the tracks (older versions, every mix). Licenses and the release's own stay. */
export const prunedOf = (rows: Row[]) => rows.filter((v) => v.track_id && v.kind !== 'license' && !(v.is_current && SHIPS.includes(v.kind))).map((v) => v.id)

/** Whether a release stamped at `releasedAt` (an Instant, or epoch ms for one moving now) can still move back to
 *  Upcoming: null once its window has passed, else until when (an Instant; null `until` when everything is kept). */
export function moveBackWindow(releasedAt: string | number, keepDays: KeepDays, now = Date.now()): { until: string | null } | null {
  if (keepDays === null) return { until: null }
  const until = (typeof releasedAt === 'string' ? Date.parse(releasedAt) : releasedAt) + keepDays * 86_400_000
  return until > now ? { until: new Date(until).toISOString() } : null
}
