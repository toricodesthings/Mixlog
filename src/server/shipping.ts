/** Moving a release to Releases: what ships, what's kept and what's pruned. Pure, shared with the browser. */
import type { LaneRow } from '#/server/lanes'

/** How long what didn't ship is kept after a release goes out (Settings → Releases): pruned versions wait this many
 *  days before the cleanup cron erases them, and until then the release can move back. Null keeps everything: what
 *  didn't ship is still set aside, never erased, and it can always move back. Read when it's used, so a change applies to releases already waiting. */
export type KeepDays = 7 | 14 | 30 | null
export const KEEP_CHOICES: KeepDays[] = [7, 14, 30, null]
export const DEFAULT_KEEP_DAYS: KeepDays = 14

/** Stacks whose current version ships beside the final. Mixes and other masters don't, and a track's licenses are
 *  kept whole. */
const SHIPS = ['instrumental', 'acapella', 'stems', 'canvas', 'video', 'other']

/** What ships: each track's final, and the current version of every other stack but the mixes. */
export const shippedOf = (rows: LaneRow[]) =>
  rows.filter((v) => v.track_id && (v.kind === 'master' ? v.is_final : v.is_current && SHIPS.includes(v.kind))).map((v) => v.id)

/** What's set aside: every other version on the tracks (other masters, every mix). Licenses and the release's own stay. */
export const prunedOf = (rows: LaneRow[]) => {
  const shipped = new Set(shippedOf(rows))
  return rows.filter((v) => v.track_id && v.kind !== 'license' && !shipped.has(v.id)).map((v) => v.id)
}

/** Whether a release stamped at `releasedAt` (an Instant, or epoch ms for one moving now) can still move back to
 *  Upcoming: null once its window has passed, else until when (an Instant; null `until` when everything is kept). */
export function moveBackWindow(releasedAt: string | number, keepDays: KeepDays, now = Date.now()): { until: string | null } | null {
  if (keepDays === null) return { until: null }
  const until = (typeof releasedAt === 'string' ? Date.parse(releasedAt) : releasedAt) + keepDays * 86_400_000
  return until > now ? { until: new Date(until).toISOString() } : null
}
