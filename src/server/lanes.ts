/** Mix, Master, Final: where a track's bounces are filed, and the rules for moving them. Pure, shared with the browser,
 *  so a page refuses a move with the same words the server would. */
import { isFinal } from '#/server/files'

/** A track's lanes, top to bottom: up is closer to release. The final is the master pinned in `current_pins`. */
export const LANES = ['final', 'master', 'mix'] as const
export type Lane = (typeof LANES)[number]
/** Alternates ship beside the final, one row each; they never move between lanes. */
const ALTERNATES = ['instrumental', 'acapella', 'stems'] as const

/** A version as the rules read it: `is_final` is 1 when it's its track's pinned master. */
export type LaneRow = { id: string; track_id: string | null; kind: string; number: number; content_type: string; is_final: number; is_current: number }

/** The lane a version is filed in, or null for an alternate (or anything else on the track). */
export const laneOf = (v: Pick<LaneRow, 'kind' | 'is_final'>): Lane | null =>
  v.kind === 'master' ? (v.is_final ? 'final' : 'master') : v.kind === 'mix' ? 'mix' : null

const newest = <T extends LaneRow>(rows: T[]) => [...rows].sort((a, b) => b.number - a.number)

/** One track's lanes, each newest first, and its alternates: one per kind, each with its earlier versions. */
export function lanesOf<T extends LaneRow>(trackId: string, rows: T[]) {
  const own = newest(rows.filter((v) => v.track_id === trackId))
  return {
    final: own.find((v) => laneOf(v) === 'final') ?? null,
    master: own.filter((v) => laneOf(v) === 'master'),
    mix: own.filter((v) => laneOf(v) === 'mix'),
    alternates: ALTERNATES.flatMap((kind) => {
      const stack = own.filter((v) => v.kind === kind)
      const top = stack.find((v) => v.is_current) ?? stack[0]
      return top ? [{ kind, top, earlier: stack.filter((v) => v !== top) }] : []
    }),
  }
}

/** What plays when nothing is picked: the final, else the newest master, else the newest mix. */
export function playOf<T extends LaneRow>(trackId: string, rows: T[]): T | null {
  const lanes = lanesOf(trackId, rows)
  return lanes.final ?? lanes.master[0] ?? lanes.mix[0] ?? null
}

/** Why `version` can't be filed in `to`, or null when it can. In Releases the only move is giving a track its final. */
export function moveProblem(version: Pick<LaneRow, 'kind' | 'content_type' | 'is_final'>, to: Lane, section: 'upcoming' | 'released'): string | null {
  if (laneOf(version) === null) return 'Only mixes and masters move between lanes.'
  if (section === 'released' && to !== 'final') return 'Releases keep one file per slot: replace it, or move the release back to Upcoming.'
  if (to === 'final' && !isFinal(version.content_type)) return 'A test can’t be the final. Send its WAV.'
  return null
}

/** The lane above or below (Alt+↑/↓), or null at the edge. */
export const nextLane = (from: Lane, step: -1 | 1): Lane | null => LANES[LANES.indexOf(from) + step] ?? null
