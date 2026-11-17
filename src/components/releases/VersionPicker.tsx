import { File, ListMusic, SquareSplitHorizontal } from 'lucide-react'
import { useMemo, type CSSProperties } from 'react'

import { laneOf, lanesOf } from '#/server/lanes'
import { isMeasured } from '#/server/loudness'
import type { ReleaseRow, TrackRow, VersionRow } from '#/server/releases'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { deviceZone } from '../../lib/time'
import { cn } from '../../lib/utils'
import { reading } from '../meters/Readings'
import { TONE } from '../player/ABSwitch'
import type { Side } from '../player/ab'
import type { Playable } from '../player/Player'
import { Button, Led } from '../primitives'
import { EmptyState } from '../shared/EmptyState'
import { MetaLine } from '../shared/MetaLine'
import { Picker, type PickerGroup } from '../shared/Picker'
import type { ReleaseData } from './loaders'
import { FINAL_ICON, KIND_ICON, isComparable, landedOf, latestOf, nameOf, playableOf, versionLabel, versionText } from './stacks'
import { Format } from './VersionRow'

/** `mark`: its track's newest bounce, or the one before it (`latestOf`), told apart where there are two. */
type Row = { track: TrackRow; version: VersionRow; mark?: 'newest' | 'previous' }

/** A/B's versions to choose from, laid out as Tracks lays them out: each track's Final, Masters, Mixes and Alternates,
 *  newest first, never folded (search narrows them instead), and only what you'd listen to (no stems, no non-audio).
 *  An empty lane is left out; an EP heads each track's lanes with its title. The newest bounce and the one before it
 *  are marked where they sit, so the likeliest pair stands out without being listed twice. */
export function pickGroups({ release, tracks, versions }: Pick<ReleaseData, 'release' | 'tracks' | 'versions'>): PickerGroup<Row>[] {
  const single = release.format === 'single' && tracks.length === 1
  return tracks.flatMap((track) => {
    const lanes = lanesOf(track.id, versions)
    const [newest, previous] = latestOf(track.id, 'mix', versions)
    const markOf = (v: VersionRow): Row['mark'] => (previous ? (v === newest ? 'newest' : v === previous ? 'previous' : undefined) : undefined)
    const rows = (list: VersionRow[]) => list.filter(isComparable).map((version) => ({ track, version, mark: markOf(version) }))
    const masters = rows(lanes.master)
    const mixes = rows(lanes.mix)
    const groups: PickerGroup<Row>[] = [
      { id: `${track.id}:final`, label: 'Final', icon: <FINAL_ICON size={14} aria-hidden="true" className="text-accent" />, items: rows(lanes.final ? [lanes.final] : []) },
      { id: `${track.id}:master`, label: 'Masters', icon: <KIND_ICON.master size={14} aria-hidden="true" className="text-accent-tertiary" />, count: masters.length, items: masters },
      { id: `${track.id}:mix`, label: 'Mixes', icon: <KIND_ICON.mix size={14} aria-hidden="true" className="text-accent-tertiary" />, count: mixes.length, items: mixes },
      { id: `${track.id}:alternates`, label: 'Alternates', icon: <ListMusic size={14} aria-hidden="true" className="text-accent-tertiary" />, items: rows(lanes.alternates.flatMap((a) => [a.top, ...a.earlier])) },
    ]
    return groups.filter((g) => g.items.length).map((g) => ({ ...g, section: single ? null : track.title }))
  })
}

const textOf = (r: Row) => versionText(r.track, r.version)

export const playableFrom = (release: ReleaseRow, row: Row) => playableOf(release, row.track, row.version, deviceZone())

/**
 * Pick for A or B (`?pick=a|b`): the release's versions in their lanes, each row read like its row in Tracks (number,
 * what changed and its newest/previous pill, and under it the format and day it landed) with its integrated loudness, then the
 * side it's on. The lane holding this
 * side's version is lit; what's on the table wears its side's badge; picking the other side's version swaps the two.
 * `tone`: the room's light, so A is one colour in the room and here.
 */
export function VersionPicker({ side, data, failed, onRetry, tone, on, onPick, onClose }: {
  side: Side
  data: ReleaseData | null
  /** The release didn't load: the list says so, with a retry. */
  failed?: boolean
  onRetry?: () => void
  tone?: CSSProperties
  /** What's on each side now. */
  on: { a: Playable | null; b: Playable | null }
  onPick: (item: Playable) => void
  onClose: () => void
}) {
  const { isCompact } = useShellMode()
  const zone = deviceZone()
  const here = on[side]?.versionId
  // Stable across the room's re-renders (the playhead, a side loading), so the list doesn't jump back to its row
  const groups = useMemo(() => (data ? pickGroups(data).map((g) => ({ ...g, lit: g.items.some((r) => r.version.id === here) })) : null), [data, here])
  const sideOf = (id: string): Side | null => (on.a?.versionId === id ? 'a' : on.b?.versionId === id ? 'b' : null)
  return (
    <Picker<Row>
      title={`Pick for ${side.toUpperCase()}`}
      icon={SquareSplitHorizontal}
      eyebrow={data ? <span className="truncate">{data.release.title}</span> : undefined}
      groups={groups}
      tone={tone}
      problem={
        failed ? (
          <EmptyState flat readout="No signal" title="Couldn’t load the versions" action={<Button onClick={onRetry}>Try again</Button>}>
            The list didn’t arrive. Nothing about your versions has changed.
          </EmptyState>
        ) : undefined
      }
      keyOf={(r) => r.version.id}
      textOf={textOf}
      initial={here}
      label="Search versions"
      placeholder="Search by name, v4, WAV…"
      empty="No version matches"
      onClose={onClose}
      onPick={(r) => data && onPick(playableFrom(data.release, r))}
      renderRow={({ version: v, mark }) => {
        const lane = laneOf(v)
        const at = sideOf(v.id)
        const lufs = isMeasured(v.analysis) ? v.analysis.lufs : null
        const Mark = KIND_ICON[v.kind] ?? File
        // The same columns, and the same classes, as VersionRow's, so the two read alike
        const number = lane ? (
          <span className={cn('readout flex shrink-0 items-center gap-1.5', !isCompact && 'w-11', v.is_final ? 'text-accent' : 'text-ink-muted')}>
            {v.is_final ? <Led /> : null}v{v.number}
            {v.is_final ? <span className="sr-only">, final</span> : null}
          </span>
        ) : (
          <span className={cn('flex shrink-0 items-center', !isCompact && 'w-11')}>
            <Mark size={16} aria-hidden="true" className="text-accent-tertiary" />
          </span>
        )
        const name = lane ? nameOf(v) : versionLabel(v, 'upcoming')
        // A pill beside the name, found while scanning names: Newest in Haze (quieter than the final's Signal), Previous
        // a neutral tint. A soft fill, no border, so it reads as a tag, never a button or the round side badge.
        const tag = mark && (
          <span className={cn('readout shrink-0 rounded-full px-2 py-0.5 whitespace-nowrap', mark === 'newest' ? 'bg-accent-tertiary/15 text-accent-tertiary' : 'bg-line text-ink-soft')}>
            <span className="sr-only">, </span>
            {mark === 'newest' ? 'Newest' : 'Previous'}
          </span>
        )
        const loudness = (
          <span data-numeric className={cn('readout shrink-0 whitespace-nowrap text-ink-soft', !isCompact && 'w-28 text-right')}>
            {lufs === null ? 'Not measured' : `${reading(lufs)} LUFS`}
          </span>
        )
        // On a phone the number leads the facts and the loudness ends them, wrapping whole rather than cut short.
        const facts = <MetaLine wrap={isCompact} facts={[isCompact && number, <Format key="f" version={v} />, landedOf(v, zone), isCompact && loudness]} />
        const badge = (
          <span className="flex w-8 shrink-0 justify-center">
            {at && (
              <span
                className="readout flex size-7 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--tone)_45%,transparent)] text-[var(--tone)]"
                style={{ '--tone': TONE[at] } as CSSProperties}
>
                <span aria-hidden="true">{at.toUpperCase()}</span>
                <span className="sr-only">On {at.toUpperCase()}</span>
              </span>
            )}
          </span>
        )
        return (
          <>
            {!isCompact && number}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn('min-w-0 text-[0.9375rem] leading-snug font-medium text-ink', isCompact ? 'line-clamp-2 break-words' : 'truncate')}>{name}</span>
                {tag}
              </span>
              {facts}
            </span>
            {!isCompact && loudness}
            {badge}
          </>
        )
      }}
    />
  )
}
