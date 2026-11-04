import { useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronDown, FilePlus2, ImagePlus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ARTWORK_ACCEPT, AUDIO_ACCEPT, FINAL_ACCEPT, MAX_AUDIO_BYTES, artworkProblem, audioTypeOf, isFinal, type AudioKind } from '#/server/files'
import { createRelease, type ReleaseFormat } from '#/server/releases'
import { useDropTarget } from '../../hooks/ui/use-drop-target'
import { useFileDrop } from '../../hooks/ui/use-file-drop'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { readDuration, uploadArtwork, uploadAudio } from '../../lib/files'
import { deviceZone, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button, Input, Led, Meter, Progress, Tip, Transfer } from '../primitives'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../primitives/Dialog'
import { SegmentedControl } from '../primitives/SegmentedControl'
import { MetaLine } from '../shared/MetaLine'
import { formatLength } from '../releases/browse'
import { ReleaseArt } from '../releases/ReleaseArt'
import { LaneMenu, TARGET_ICON, TARGET_LABEL } from '../releases/LaneMenu'
import { FORMAT_LABEL, releaseLink, type Section } from '../releases/sections'
import { sentOf, sizeOf, timeLeft } from './progress'
import { readFilename, suggestFinals, suggestFormat } from './suggest'
import { UploadProgress } from './UploadRow'
import { saveLate } from '../meters/save'
import type { Phase, Target } from './use-lane-upload'

const FORMATS = (['single', 'ep', 'album'] as const).map((value) => ({ value, label: FORMAT_LABEL[value] }))
/** Where a new file can land: the lanes, then the alternates. */
const TARGETS = ['final', 'master', 'mix', 'instrumental', 'acapella'] as const satisfies Target[]

type Progress = { state: 'sending' | 'stored' | 'failed'; sent: number; phase?: Phase; error?: string }
const errorOf = (error: unknown, fallback: string) => (error instanceof Error && error.message) || fallback

/**
 * Start a release from files: dropped on Upcoming or Releases, or picked. On Releases it's one already out, so it asks the day. Nothing is saved until Save. The filenames
 * suggest the title, the format and each bounce's stack; everything is shown here first and corrected in a tap.
 * A single's files are all versions of its one track; on an EP or album, files with the same title are one track.
 */
export function NewReleaseDialog({ section, files, onFilesChange, onClose }: {
  section: Section
  files: File[]
  onFilesChange: (files: File[]) => void
  onClose: () => void
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const { isTouch } = useShellMode()
  const picker = useRef<HTMLInputElement>(null)
  const coverPicker = useRef<HTMLInputElement>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [coverProblem, setCoverProblem] = useState<string | null>(null)
  const [title, setTitle] = useState<string | null>(null) // null: the suggestion
  const [format, setFormat] = useState<ReleaseFormat | null>(null)
  const released = section === 'released'
  const today = todayIn(deviceZone())
  const [releasedOn, setReleasedOn] = useState(today)
  const [edits, setEdits] = useState(() => new Map<File, { title?: string; target?: Target }>())
  const [durations, setDurations] = useState(() => new Map<File, number | null>())
  const [progress, setProgress] = useState(() => new Map<File, Progress>())
  const [created, setCreated] = useState<{ id: string; trackIds: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Sorting the drop: audio becomes bounces; the rest is left out with a reason. Artwork only goes in on the cover.
  const { bounces, leftOut } = useMemo(() => {
    const bounces: { file: File; type: string }[] = []
    const leftOut: string[] = []
    for (const file of files) {
      const type = audioTypeOf(file.name, file.type)
      if (type && file.size <= MAX_AUDIO_BYTES) bounces.push({ file, type })
      else leftOut.push(`${file.name} (${type ? 'over 4 GB' : file.type.startsWith('image/') ? 'artwork goes on the cover' : 'not audio'})`)
    }
    return { bounces, leftOut }
  }, [files])
  const pickCover = (file: File) => {
    const problem = artworkProblem(file.type, file.size)
    setCoverProblem(problem)
    if (!problem) setCover(file)
  }

  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!cover) return setCoverUrl(null)
    const url = URL.createObjectURL(cover)
    setCoverUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [cover])

  const measured = useRef(new Set<File>())
  useEffect(() => {
    for (const { file } of bounces) {
      if (measured.current.has(file)) continue
      measured.current.add(file)
      void readDuration(file).then((ms) => setDurations((m) => new Map(m).set(file, ms)))
    }
  }, [bounces])

  const titled = bounces.map(({ file, type }) => {
    const read = readFilename(file.name)
    const edit = edits.get(file)
    return { file, type, title: edit?.title ?? read.title, read: read.kind, chosen: edit?.target }
  })
  const shownFormat = format ?? suggestFormat(titled.map((r) => r.title))
  const single = shownFormat === 'single'
  const shownTitle = title ?? (single ? (titled[0]?.title ?? '') : '')
  const songKey = (row: { title: string }) => (single ? '' : row.title.trim().toLowerCase())
  // On Releases every file is its track's final: a test, or a second final for one track, is left out.
  const kept = released ? titled.filter((r, i) => isFinal(r.type) && titled.findIndex((o) => isFinal(o.type) && songKey(o) === songKey(r)) === i) : titled
  const finalsLeftOut = titled.filter((r) => !kept.includes(r)).map((r) => `${r.file.name} (${isFinal(r.type) ? 'one final per track' : 'a test'})`)
  // On an EP or album, a title is a track: files that share one are its versions.
  const songs = single ? [shownTitle.trim()] : [...new Map(kept.map((r) => [songKey(r), r.title.trim()])).values()]
  const songOf = (row: { title: string }) => (single ? 0 : songs.findIndex((s) => s.toLowerCase() === songKey(row)))
  // Each song's newest lossless master is suggested as its final; shown, and corrected in a tap.
  const finals = suggestFinals(kept.map((r) => ({ song: songOf(r), kind: r.read, lossless: isFinal(r.type), modified: r.file.lastModified })))
  const rows = kept.map((r, i) => ({ ...r, target: (released ? 'final' : (r.chosen ?? (finals.has(i) ? 'final' : r.read))) as Target }))

  const locked = busy || created !== null
  const { over: coverOver, props: coverDrop } = useDropTarget({
    onFiles: (files) => (files.length > 1 ? setCoverProblem('One artwork per release: drop a single PNG or JPG.') : pickCover(files[0])),
    enabled: !locked,
  })
  const coverLabel = cover ? 'Replace the artwork' : 'Add artwork'
  const failures = [...progress.values()].filter((p) => p.state === 'failed').length
  const stored = [...progress.values()].filter((p) => p.state === 'stored').length
  const total = rows.length + (cover ? 1 : 0)
  const ready = shownTitle.trim() !== '' && songs.every(Boolean) && (!released || releasedOn !== '')
  const mark = (file: File, next: Progress) => setProgress((m) => new Map(m).set(file, next))
  // The whole save as one bar: every file's bytes, its share sent.
  const allFiles = [...rows.map((r) => r.file), ...(cover ? [cover] : [])]
  const totalBytes = allFiles.reduce((sum, f) => sum + f.size, 0)
  const sentBytes = allFiles.reduce((sum, f) => sum + (progress.get(f)?.sent ?? 0) * f.size, 0)
  const startedAt = useRef({ at: 0, sent: 0 })

  const add = (picked: File[]) => onFilesChange([...files, ...picked.filter((f) => !files.includes(f))])
  // More files can land on the open dialog until Save; after that the drop is refused, not quietly lost.
  const dragging = useFileDrop((dropped) => !locked && add(dropped)) && !locked
  const remove = (file: File) => onFilesChange(files.filter((f) => f !== file))
  const edit = (file: File, change: { title?: string; target?: Target }) => setEdits((m) => new Map(m).set(file, { ...m.get(file), ...change }))

  const save = async () => {
    startedAt.current = { at: performance.now(), sent: sentBytes }
    setBusy(true)
    setProblem(null)
    let release = created
    try {
      release ??= await createRelease({ data: { title: shownTitle, format: shownFormat, tracks: songs, releasedOn: released ? releasedOn : null, zone: deviceZone() } })
      setCreated(release)
    } catch (error) {
      setProblem(errorOf(error, 'Couldn’t start the release. Nothing was saved; try again.'))
      return setBusy(false)
    }
    // One at a time: on bad signal, one file finishing beats four half-sent.
    let ok = true
    const send = async (file: File, upload: (onProgress: (sent: number) => void, onPhase: (phase: Phase) => void) => Promise<unknown>) => {
      if (progress.get(file)?.state === 'stored') return
      mark(file, { state: 'sending', sent: 0 })
      try {
        await upload((sent) => mark(file, { state: 'sending', sent }), (phase) => mark(file, { state: 'sending', sent: 1, phase }))
        mark(file, { state: 'stored', sent: 1 })
      } catch (error) {
        ok = false
        mark(file, { state: 'failed', sent: 0, error: errorOf(error, 'Couldn’t send it.') })
      }
    }
    if (cover) await send(cover, (onProgress) => uploadArtwork(release.id, cover, onProgress))
    for (const row of rows) {
      const trackId = release.trackIds[songOf(row)]
      await send(row.file, async (onProgress, onPhase) => {
        const { id, late } = await uploadAudio(
          { trackId, kind: row.target === 'final' ? 'master' : (row.target as AudioKind), final: row.target === 'final', file: row.file, contentType: row.type, durationMs: durations.get(row.file) ?? null },
          onProgress,
          onPhase,
        )
        saveLate(id, late, () => void router.invalidate())
      })
    }
    setBusy(false)
    await router.invalidate()
    if (ok) {
      onClose()
      void navigate(releaseLink(section, release.id))
    }
  }

  const close = () => {
    if (busy) return
    if (created) void router.invalidate()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="gap-5 sm:max-w-2xl [&>*]:min-w-0" onEscapeKeyDown={(e) => busy && e.preventDefault()} onPointerDownOutside={(e) => busy && e.preventDefault()}>
        <DialogHeader className="gap-1 text-left">
          <p className="readout flex items-center gap-2 text-accent">
            <Led breathe={busy} lit={total > 0} />
            {busy ? `Recording · ${stored} of ${total}` : total ? [rows.length && `${rows.length} ${rows.length === 1 ? 'bounce' : 'bounces'}`, cover && 'artwork'].filter(Boolean).join(' · ') : 'Input armed'}
          </p>
          <DialogTitle className="font-display text-2xl">{released ? 'Add a release' : 'New release'}</DialogTitle>
          {busy && totalBytes > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              <Progress value={sentBytes / totalBytes} label="Saving the release" valueText={`${sentOf(sentBytes / totalBytes, totalBytes)} sent`} />
              <p data-numeric className="readout flex justify-between gap-3 text-ink-muted">
                <span>{sentOf(sentBytes / totalBytes, totalBytes)}</span>
                <span>
                  {timeLeft(sentBytes - startedAt.current.sent, totalBytes - startedAt.current.sent, (performance.now() - startedAt.current.at) / 1000) ??
                    `${Math.round((sentBytes / totalBytes) * 100)}%`}
                </span>
              </p>
            </div>
          )}
        </DialogHeader>

        <div className="flex items-start gap-4">
          {/* The only way in for artwork: click it, or drop a PNG or JPG right on it. */}
          <Tip label={coverLabel}>
            <button
              type="button"
              disabled={locked}
              onClick={() => coverPicker.current?.click()}
              aria-label={coverLabel}
              {...coverDrop}
              className={cn('group press relative shrink-0 rounded-[1.4rem]', coverOver && 'ring-2 ring-accent', coverProblem && 'ring-2 ring-feedback-error/70')}
            >
              <ReleaseArt title={shownTitle || '♪'} artworkId={null} src={coverUrl ?? undefined} size="cover" className="glow-accent" />
              <span className={cn('absolute inset-0 flex items-center justify-center rounded-[1.4rem] bg-room-void/60 text-ink transition-opacity duration-(--duration-normal)', coverOver ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100')}>
                <ImagePlus size={20} aria-hidden="true" />
              </span>
              {cover && progress.get(cover)?.state === 'sending' && (
                <span className="absolute inset-0 flex items-center justify-center rounded-[1.4rem] bg-room-void/60">
                  <Transfer direction="up" value={progress.get(cover)!.sent} label="Sending the artwork" className="text-4xl" />
                </span>
              )}
            </button>
          </Tip>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="readout text-ink-muted">Title</span>
              <Input
                value={shownTitle}
                disabled={locked}
                maxLength={200}
                autoFocus={!isTouch}
                placeholder={single ? 'Name the single' : `Name the ${FORMAT_LABEL[shownFormat]}`}
                onChange={(e) => setTitle(e.target.value)}
                className="font-display text-base font-semibold"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <div className={cn(locked && 'pointer-events-none opacity-60')}>
                <SegmentedControl ariaLabel="Format" value={shownFormat} onChange={setFormat} options={FORMATS} size="sm" />
              </div>
              {released && (
                <label className="flex items-center gap-2">
                  <span className="readout whitespace-nowrap text-ink-muted">Out on</span>
                  <Input
                    type="date"
                    value={releasedOn}
                    max={today}
                    required
                    disabled={locked}
                    onChange={(e) => setReleasedOn(e.target.value)}
                    className="h-9 w-auto rounded-lg"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {rows.length > 0 && (
          <section aria-label="Bounces" className="flex flex-col gap-2">
            <p className="readout px-1 text-ink-muted">{single ? 'Versions' : `${songs.length} ${songs.length === 1 ? 'track' : 'tracks'}`}</p>
            <ul className="flex flex-col gap-1.5">
              {rows.map((row) => {
                const state = progress.get(row.file)
                const duration = durations.get(row.file)
                return (
                  <li key={`${row.file.name}-${row.file.lastModified}-${row.file.size}`} className="surface-item relative flex items-center gap-3 overflow-hidden rounded-2xl py-2 pr-2 pl-3">
                    <span className="readout w-5 shrink-0 text-accent">{String(songOf(row) + 1).padStart(2, '0')}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      {single ? (
                        <span className="truncate text-sm font-medium text-ink">{row.file.name}</span>
                      ) : (
                        <Input
                          value={row.title}
                          disabled={locked}
                          maxLength={200}
                          aria-label={`Track title for ${row.file.name}`}
                          onChange={(e) => edit(row.file, { title: e.target.value })}
                          className="h-9 rounded-lg font-medium"
                        />
                      )}
                      {state?.state === 'failed' ? (
                        <span role="alert" className="text-[13px] text-feedback-error">{state.error}</span>
                      ) : state?.state === 'sending' ? (
                        <UploadProgress name={row.file.name} size={row.file.size} sent={state.sent} phase={state.phase} />
                      ) : (
                        <MetaLine wrap facts={[row.file.name.split('.').pop()!.toUpperCase(), sizeOf(row.file.size), duration ? formatLength(duration) : null, !single ? row.file.name : null]} />
                      )}
                    </div>
                    {!released && <TargetMenu target={row.target} test={!isFinal(row.type)} disabled={locked} onTarget={(target) => edit(row.file, { target })} />}
                    <Status state={state} onRemove={locked ? undefined : () => remove(row.file)} name={row.file.name} />
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {!locked && (
          <div
            data-meter-host
            className={cn(
              'flex items-center gap-4 rounded-2xl border border-dashed border-line-strong px-4 py-3.5 transition-[border-color,background-color,box-shadow] duration-(--duration-normal)',
              dragging && 'meter-live border-accent bg-accent-dim glow-accent',
            )}
          >
            <Meter className="h-5 shrink-0" />
            <p className="min-w-0 flex-1 text-sm text-ink-soft">
              {dragging ? 'Let go to add them' : isTouch ? 'Bounces go here; artwork on the cover.' : 'Drop more bounces here; artwork goes on the cover.'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => picker.current?.click()}>
              <FilePlus2 size={15} aria-hidden="true" />
              Choose files
            </Button>
          </div>
        )}
        <input
          ref={coverPicker}
          type="file"
          accept={ARTWORK_ACCEPT}
          hidden
          onChange={(e) => {
            if (e.target.files?.[0]) pickCover(e.target.files[0])
            e.target.value = ''
          }}
        />
        <input
          ref={picker}
          type="file"
          multiple
          accept={released ? FINAL_ACCEPT : AUDIO_ACCEPT}
          hidden
          onChange={(e) => {
            add([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />

        {coverProblem && <p role="alert" className="text-[13px] text-feedback-error">{coverProblem}</p>}
        {cover && progress.get(cover)?.state === 'failed' && <p role="alert" className="text-[13px] text-feedback-error">Artwork: {progress.get(cover)!.error}</p>}
        {leftOut.length + finalsLeftOut.length > 0 && (
          <p className="text-[13px] text-ink-muted">
            Left out: {[...leftOut, ...finalsLeftOut].join(', ')}.
            {finalsLeftOut.length > 0 && ' Releases keep the final: a WAV, AIFF or FLAC. Start it in Upcoming to keep test bounces.'}
          </p>
        )}
        {problem && <p role="alert" className="text-[13px] text-feedback-error">{problem}</p>}
        {failures > 0 && !busy && <p className="text-[13px] text-ink-soft">The release is saved with what made it. Try again sends only what didn’t.</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={busy}>
            {created ? 'Close' : 'Cancel'}
          </Button>
          <Button onClick={() => void save()} disabled={busy || !ready} aria-busy={busy}>
            {busy ? `Saving ${Math.min(stored + 1, total)} of ${total}…` : failures ? 'Try again' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Where a file lands on its track: the shared lane menu. A test can't be the final, so it isn't offered one. */
function TargetMenu({ target, test, disabled, onTarget }: { target: Target; test: boolean; disabled: boolean; onTarget: (target: Target) => void }) {
  const Icon = TARGET_ICON(target)
  return (
    <LaneMenu value={target} options={test ? TARGETS.filter((t) => t !== 'final') : TARGETS} onChange={onTarget}>
      <Button variant="secondary" size="sm" aria-label={`Lands in: ${TARGET_LABEL(target)}`} disabled={disabled} className="shrink-0 gap-1.5 px-2.5 sm:w-36 sm:justify-start">
        <Icon size={14} aria-hidden="true" className="text-accent" />
        <span className="max-sm:hidden">{TARGET_LABEL(target)}</span>
        <ChevronDown size={13} aria-hidden="true" className="text-ink-muted sm:ml-auto" />
      </Button>
    </LaneMenu>
  )
}

/** Remove before saving; while saving, its upload ring or a light, and words: sending, stored, or failed. */
function Status({ state, onRemove, name }: { state?: Progress; onRemove?: () => void; name: string }) {
  if (!state)
    return onRemove ? (
      <Button variant="ghost" size="icon" aria-label={`Leave out ${name}`} onClick={onRemove} className="size-9 shrink-0">
        <X size={15} aria-hidden="true" />
      </Button>
    ) : null
  return (
    <span className="readout flex w-16 shrink-0 items-center justify-end gap-1.5 text-ink-muted">
      {state.state === 'sending' ? (
        <>
          <Transfer direction="up" value={state.sent} className="text-base" />
          {Math.round(state.sent * 100)}%
        </>
      ) : state.state === 'stored' ? (
        <>
          <Led />
          Stored
        </>
      ) : (
        <>
          <Led lit={false} />
          Failed
        </>
      )}
    </span>
  )
}
