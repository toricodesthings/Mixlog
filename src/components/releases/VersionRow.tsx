import { ArrowUpDown, Download, File, FlaskConical, Play, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { audioTypeOf, isFinal } from '#/server/files'
import { LANES, laneOf, nextLane, type Lane } from '#/server/lanes'
import type { VersionRow as Version } from '#/server/releases'
import { VERSION_DRAG, useDropTarget } from '../../hooks/ui/use-drop-target'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { downloadUrl } from '../../lib/files'
import { deviceZone, formatMoment, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Fetching } from '../player/controls'
import { usePlayer } from '../player/Player'
import { Button, Led, Meter, Tip, useHoverSlide } from '../primitives'
import { sizeOf } from '../uploads/progress'
import { UploadRow } from '../uploads/UploadRow'
import type { Target } from '../uploads/use-lane-upload'
import type { TrackState } from './Lane'
import { LaneMenu } from './LaneMenu'
import { FINAL_ICON, KIND_ICON, formatOf, playableOf, versionLabel } from './stacks'

const ext = /\.[^.]+$/

/**
 * One version, read left to right in the order you'd ask: Play, which one, what changed, then quiet columns (a test's
 * flask and its format, the day it landed), then what you can do with it. In Upcoming a mix or master moves between
 * lanes: its Move menu, a drag (with a mouse), or Alt+↑/↓. In Releases a slot holds one file with no number: a wrong one
 * is replaced by dropping a file on the row or with Replace, after a confirm on the row that names both files.
 */
export function VersionRow({ t, version, slide }: { t: TrackState; version: Version; slide: ReturnType<typeof useHoverSlide>['row'] }) {
  const player = usePlayer()
  const { isCompact, isTouch } = useShellMode()
  const zone = deviceZone()
  const { release, track, section } = t
  const lane = laneOf(version)
  const movable = section === 'upcoming' && lane !== null
  const released = section === 'released'
  const audio = version.content_type.startsWith('audio/')
  const test = audio && !isFinal(version.content_type)
  const live = player.item?.versionId === version.id
  const label = versionLabel(version, section)
  // A mix or master is named by what changed; an alternate by its kind (and number, in Upcoming).
  const name = lane ? version.note || version.filename.replace(ext, '') : label
  const Mark = version.is_final ? FINAL_ICON : (KIND_ICON[version.kind] ?? File)
  const target = (version.is_final ? 'final' : version.kind) as Target

  // Releases: a replacement waits on the row for a confirm, then sends there.
  const [proposed, setProposed] = useState<File | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const replacing = t.uploads.pending.find((p) => p.replaces === version.id)
  const propose = (files: File[]) => {
    const type = files.length === 1 ? audioTypeOf(files[0].name, files[0].type) : null
    const problem = files.length !== 1 ? 'Replace it with one file.' : !type ? 'That isn’t audio.' : version.is_final && !isFinal(type) ? 'A final is a WAV, AIFF or FLAC.' : null
    setRefused(problem)
    setProposed(problem ? null : files[0])
  }
  const drop = useDropTarget({ onFiles: propose, enabled: released && !replacing })

  // A test can't be the final: Final asks for its WAV, which lands as the final noted "Final of vN".
  const askWav = () => {
    t.setMessage({ target: 'final', text: 'A test can’t be the final. Send its WAV.', wavOf: version })
    t.pick('final')
  }

  const moveButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (t.follow === version.id) moveButton.current?.focus()
  }, [t.follow, version.id, lane])

  const keys = (e: KeyboardEvent) => {
    if (!movable || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    const to = nextLane(lane, e.key === 'ArrowUp' ? -1 : 1)
    if (to) void t.move(version, to)
  }

  const number = lane && !released && (
    <span className={cn('readout flex shrink-0 items-center gap-1.5', !isCompact && 'w-11', version.is_final || live ? 'text-accent' : 'text-ink-muted')}>
      {version.is_final ? <Led tone={t.uploads.landed === version.id ? 'phantom' : 'accent'} /> : null}v{version.number}
      {version.is_final ? <span className="sr-only">, final</span> : null}
    </span>
  )
  // On a phone the facts sit under the name, never under the buttons: the number and format, then the time on its own line.
  const facts = (
    <span className={cn('flex items-center gap-x-3', isCompact ? 'min-w-0 flex-wrap gap-y-0.5' : 'shrink-0')}>
      {isCompact && number}
      <span className={cn('readout flex items-center gap-1.5', test ? 'text-ink-muted' : 'text-ink-soft')}>
        {test && <FlaskConical size={13} aria-hidden="true" />}
        {formatOf(version.filename)}
        {test && <span className="sr-only">, test bounce</span>}
      </span>
      <span className={cn('readout whitespace-nowrap text-ink-muted', isCompact ? 'basis-full' : 'w-36 text-right')}>{formatMoment(version.created_at, zone, todayIn(zone))}</span>
    </span>
  )

  return (
    <>
      <li
        data-version={version.id}
        {...slide}
        {...(released ? drop.props : {})}
        draggable={movable && !isTouch}
        onDragStart={(e) => {
          e.dataTransfer.setData(VERSION_DRAG, version.id)
          e.dataTransfer.effectAllowed = 'move'
          t.setDragged(version)
        }}
        onDragEnd={() => t.setDragged(null)}
        onKeyDown={keys}
        className={cn(
          'group playhead-sweep relative flex min-h-14 items-center gap-2 rounded-2xl pr-1',
          movable && !isTouch && 'cursor-grab active:cursor-grabbing',
          t.dragged?.id === version.id && 'opacity-50',
          drop.over && 'ring-2 ring-accent glow-accent',
        )}
      >
        {audio ? (
          <button
            type="button"
            onClick={() => player.play(playableOf(release, track, version, zone))}
            aria-label={live && player.playing ? `Pause ${track.title}, ${label}` : `Play ${track.title}, ${label}`}
            className="press flex size-11 shrink-0 items-center justify-center rounded-full text-accent"
          >
            {live && player.loading ? <Fetching className="size-7" /> : live && player.playing ? <Meter live bars={3} /> : <Play size={18} aria-hidden="true" className="translate-x-px fill-current" />}
          </button>
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center text-ink-muted">
            <File size={18} aria-hidden="true" />
          </span>
        )}
        {number ? (
          !isCompact && number
        ) : (
          <span className={cn('flex shrink-0 items-center', isCompact ? 'w-6' : 'w-11')}>
            <Mark size={16} aria-hidden="true" className={version.is_final ? 'text-accent' : 'text-accent-tertiary'} />
          </span>
        )}
        <span className={cn('flex min-w-0 flex-1 flex-col py-2', isCompact ? 'gap-0.5' : 'gap-1')}>
          {/* Two lines on a phone rather than cut short; one, truncated, beside the columns on a wide screen. */}
          <span className={cn('text-[15px] font-medium', isCompact ? 'line-clamp-2 leading-snug break-words' : 'truncate', live ? 'text-accent' : 'text-ink')}>{name}</span>
          {isCompact && facts}
        </span>
        {!isCompact && facts}
        {movable && (
          <LaneMenu title={`Move v${version.number} to`} value={lane} options={LANES} test={test} onChange={(to) => (to === 'final' && test ? askWav() : void t.move(version, to as Lane))}>
            <Button ref={moveButton} variant="ghost" size="icon" aria-label={`Move v${version.number}, now in ${lane === 'final' ? 'the final' : lane === 'master' ? 'Masters' : 'Mixes'}`} className="shrink-0 rounded-full text-ink-muted hover:text-accent" disabled={t.moving}>
              <ArrowUpDown size={16} aria-hidden="true" />
            </Button>
          </LaneMenu>
        )}
        {!movable && !released && !isCompact && <span aria-hidden="true" className="size-11 shrink-0" />}
        {released && (
          <Tip label="Replace" side="left">
            <Button variant="ghost" size="icon" onClick={() => t.pick(target, propose)} aria-label={`Replace ${version.filename}`} disabled={Boolean(replacing)} className="shrink-0 rounded-full text-ink-muted hover:text-accent">
              <RefreshCw size={16} aria-hidden="true" />
            </Button>
          </Tip>
        )}
        <Tip label={`${version.filename} · ${sizeOf(version.size)}`} side="left">
          <a
            href={downloadUrl(version.id)}
            download={version.filename}
            aria-label={`Download ${version.filename}`}
            className="press flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-accent"
          >
            <Download size={16} aria-hidden="true" />
          </a>
        </Tip>
      </li>
      {proposed && (
        <li role="group" aria-label="Replace this file?" className="surface-item flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3 ring-1 ring-accent-secondary/40">
          <p className="min-w-0 flex-1 basis-60 text-sm text-ink-soft">
            Replace <span className="font-medium text-ink">{version.filename}</span> with <span className="font-medium text-ink">{proposed.name}</span>? The old file is erased.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setProposed(null)}>
            Keep
          </Button>
          <Button size="sm" autoFocus onClick={() => (t.uploads.add([{ file: proposed, target }], { replaces: version.id }), setProposed(null))}>
            Replace
          </Button>
        </li>
      )}
      {refused && <li role="status" className="px-4 pb-2 text-[13px] text-ink-soft">{refused}</li>}
      {replacing && <UploadRow pending={replacing} onRetry={() => t.uploads.retry(replacing.key)} onDismiss={() => t.uploads.dismiss(replacing.key)} />}
    </>
  )
}
