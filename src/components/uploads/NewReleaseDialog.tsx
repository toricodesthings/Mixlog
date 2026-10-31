import { useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronDown, Disc3, FilePlus2, ImagePlus, MicVocal, Piano, SlidersHorizontal, X, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AUDIO_TYPES, MAX_AUDIO_BYTES, artworkProblem, audioTypeOf, type AudioKind } from '#/server/files'
import { createRelease, type ReleaseFormat } from '#/server/releases'
import { useFileDrop } from '../../hooks/ui/use-file-drop'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { uploadArtwork, uploadAudio } from '../../lib/files'
import { deviceZone, todayIn } from '../../lib/time'
import { cn } from '../../lib/utils'
import { Button, Input, Led, Meter, Progress, Tip } from '../primitives'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../primitives/Dialog'
import * as DropdownMenu from '../primitives/DropdownMenu'
import { SegmentedControl } from '../primitives/SegmentedControl'
import { MetaLine } from '../shared/MetaLine'
import { formatLength } from '../releases/browse'
import { ReleaseArt } from '../releases/ReleaseArt'
import { ARTWORK_ACCEPT, useCoverDrop } from '../releases/use-cover-drop'
import { FORMAT_LABEL, releaseLink, type Section } from '../releases/sections'
import { readFilename, suggestFormat } from './suggest'

const KINDS: Record<AudioKind, { label: string; icon: LucideIcon }> = {
  master: { label: 'Master', icon: Disc3 },
  mix: { label: 'Mix', icon: SlidersHorizontal },
  instrumental: { label: 'Instrumental', icon: Piano },
  acapella: { label: 'Acapella', icon: MicVocal },
}
const FORMATS = (['single', 'ep', 'album'] as const).map((value) => ({ value, label: FORMAT_LABEL[value] }))
const ACCEPT = [...AUDIO_TYPES, '.wav', '.aif', '.aiff', '.flac', '.mp3', '.m4a', '.ogg'].join(',')

type Progress = { state: 'sending' | 'stored' | 'failed'; sent: number; error?: string }

const sizeOf = (bytes: number) => (bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${(bytes / 1024 ** 3).toFixed(2)} GB`)
/** "12.4 of 48.0 MB": what a bar says out loud. */
function sentOf(share: number, bytes: number) {
  const [unit, size] = bytes < 1024 ** 3 ? (['MB', 1024 ** 2] as const) : (['GB', 1024 ** 3] as const)
  const digits = unit === 'MB' ? 1 : 2
  return `${((share * bytes) / size).toFixed(digits)} of ${(bytes / size).toFixed(digits)} ${unit}`
}

/** Time left at the pace so far, once there's enough of it to judge (a few seconds in). Never a clock time. */
function timeLeft(sent: number, total: number, seconds: number): string | null {
  if (seconds < 3 || sent <= 0 || sent >= total) return null
  const left = ((total - sent) / sent) * seconds
  return left < 60 ? `${Math.max(5, Math.round(left / 5) * 5)} s left` : `${Math.round(left / 60)} min left`
}
const errorOf = (error: unknown, fallback: string) => (error instanceof Error && error.message) || fallback

/** How long a file plays, read by the browser; null when it can't play it (AIFF in most). */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)
    const done = (ms: number | null) => (URL.revokeObjectURL(url), resolve(ms))
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null)
    audio.onerror = () => done(null)
    audio.src = url
  })
}

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
  const [edits, setEdits] = useState(() => new Map<File, { title?: string; kind?: AudioKind }>())
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

  const rows = bounces.map(({ file, type }) => {
    const read = readFilename(file.name)
    const edit = edits.get(file)
    return { file, type, title: edit?.title ?? read.title, kind: edit?.kind ?? read.kind }
  })
  const shownFormat = format ?? suggestFormat(rows.map((r) => r.title))
  const single = shownFormat === 'single'
  const shownTitle = title ?? (single ? (rows[0]?.title ?? '') : '')
  // On an EP or album, a title is a track: files that share one are its versions.
  const songs = single ? [shownTitle.trim()] : [...new Map(rows.map((r) => [r.title.trim().toLowerCase(), r.title.trim()])).values()]
  const songOf = (row: (typeof rows)[number]) => (single ? 0 : songs.findIndex((s) => s.toLowerCase() === row.title.trim().toLowerCase()))

  const locked = busy || created !== null
  const { over: coverOver, props: coverDrop } = useCoverDrop(pickCover, setCoverProblem, !locked)
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
  const edit = (file: File, change: { title?: string; kind?: AudioKind }) => setEdits((m) => new Map(m).set(file, { ...m.get(file), ...change }))

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
    const send = async (file: File, upload: (onProgress: (sent: number) => void) => Promise<unknown>) => {
      if (progress.get(file)?.state === 'stored') return
      mark(file, { state: 'sending', sent: 0 })
      try {
        await upload((sent) => mark(file, { state: 'sending', sent }))
        mark(file, { state: 'stored', sent: 1 })
      } catch (error) {
        ok = false
        mark(file, { state: 'failed', sent: 0, error: errorOf(error, 'Couldn’t send it.') })
      }
    }
    if (cover) await send(cover, (onProgress) => uploadArtwork(release.id, cover, onProgress))
    for (const row of rows) {
      const trackId = release.trackIds[songOf(row)]
      await send(row.file, (onProgress) =>
        uploadAudio({ trackId, kind: row.kind, file: row.file, contentType: row.type, durationMs: durations.get(row.file) ?? null }, onProgress),
      )
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
                <Progress value={progress.get(cover)!.sent} label="Sending the artwork" valueText={sentOf(progress.get(cover)!.sent, cover.size)} className="absolute inset-x-2.5 bottom-2.5" />
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
                        <span className="flex flex-col gap-1 pt-1">
                          <Progress value={state.sent} label={`Sending ${row.file.name}`} valueText={sentOf(state.sent, row.file.size)} />
                          <span data-numeric className="truncate text-[12.5px] text-ink-muted">{sentOf(state.sent, row.file.size)}</span>
                        </span>
                      ) : (
                        <MetaLine facts={[row.file.name.split('.').pop()!.toUpperCase(), sizeOf(row.file.size), duration ? formatLength(duration) : null, !single ? row.file.name : null]} />
                      )}
                    </div>
                    <KindMenu kind={row.kind} disabled={locked} onKind={(kind) => edit(row.file, { kind })} />
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
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            add([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />

        {coverProblem && <p role="alert" className="text-[13px] text-feedback-error">{coverProblem}</p>}
        {cover && progress.get(cover)?.state === 'failed' && <p role="alert" className="text-[13px] text-feedback-error">Artwork: {progress.get(cover)!.error}</p>}
        {leftOut.length > 0 && <p className="text-[13px] text-ink-muted">Left out: {leftOut.join(', ')}.</p>}
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

function KindMenu({ kind, disabled, onKind }: { kind: AudioKind; disabled: boolean; onKind: (kind: AudioKind) => void }) {
  const { label, icon: Icon } = KINDS[kind]
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <Button variant="secondary" size="sm" aria-label={`Stack: ${label}`} className="shrink-0 gap-1.5 px-2.5 sm:w-36 sm:justify-start">
          <Icon size={14} aria-hidden="true" className="text-accent" />
          <span className="max-sm:hidden">{label}</span>
          <ChevronDown size={13} aria-hidden="true" className="text-ink-muted sm:ml-auto" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="min-w-[11rem]">
        <DropdownMenu.RadioGroup value={kind} onValueChange={(value) => onKind(value as AudioKind)}>
          {(Object.keys(KINDS) as AudioKind[]).map((value) => {
            const { label, icon: Icon } = KINDS[value]
            return (
              <DropdownMenu.RadioItem key={value} value={value} className="gap-2">
                <Icon size={14} aria-hidden="true" className="text-ink-muted" />
                {label}
              </DropdownMenu.RadioItem>
            )
          })}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}

/** Remove before saving; while saving, a light and words: sending, stored, or failed. */
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
          <Led breathe />
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
