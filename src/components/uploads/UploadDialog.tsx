import { useNavigate, useSearch } from '@tanstack/react-router'
import { Check, ChevronDown, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { AUDIO_ACCEPT, FINAL_ACCEPT } from '#/server/files'
import { useDropTarget } from '../../hooks/ui/use-drop-target'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { cn } from '../../lib/utils'
import { Button, Led, Meter } from '../primitives'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../primitives/Dialog'
import type { TrackState } from '../releases/Lane'
import { LaneMenu, TARGET_ICON, TARGET_LABEL } from '../releases/LaneMenu'
import { sortDrop, type Target } from './use-lane-upload'

type Search = { upload?: true }

/** `?upload` opens a track's Upload over its page, so Back closes it. */
export function useUploadParam() {
  const navigate = useNavigate()
  return {
    open: useSearch({ strict: false }).upload === true,
    show: () => navigate({ to: '.', search: (prev: Search) => ({ ...prev, upload: true as const }), resetScroll: false }),
    close: () => navigate({ to: '.', search: ({ upload: _, ...rest }: Search) => rest, resetScroll: false }),
  }
}

/** The page header's Upload, as on the list pages: a labelled button, an icon on a phone. */
export function UploadButton() {
  const { show } = useUploadParam()
  return (
    <Button onClick={() => void show()} aria-label="Upload" className="max-sm:w-11 max-sm:px-0">
      <Upload size={16} aria-hidden="true" />
      <span className="max-sm:hidden">Upload</span>
    </Button>
  )
}

const TARGETS: { target: Target; hint: string }[] = [
  { target: 'final', hint: 'The WAV you’d release' },
  { target: 'master', hint: 'Mastered bounces' },
  { target: 'mix', hint: 'Before mastering' },
  { target: 'instrumental', hint: 'No vocals' },
  { target: 'acapella', hint: 'Vocals only' },
]

/**
 * Upload to one track: where it goes (cards with a mouse and room, a menu on a phone), then one drop zone you can also
 * click. It starts on the lane you bounced into last. What it takes goes through the track's own `send`, so it lands
 * in that lane with its progress, exactly as a drop there would; what a drop can't take is said here, and it stays open.
 */
export function UploadDialog({ t }: { t: TrackState }) {
  const { close } = useUploadParam()
  const { isCompact, isTouch } = useShellMode()
  const newest = [t.lanes.master[0], t.lanes.mix[0]].filter(Boolean).sort((a, b) => b.number - a.number)[0]
  const [target, setTarget] = useState<Target>(newest?.kind === 'master' ? 'master' : 'mix')
  const [note, setNote] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const take = (files: File[]) => {
    const { send, note } = sortDrop(files, target)
    if (!send.length) return setNote(note)
    t.send(files, target)
    void close()
  }
  const drop = useDropTarget({ onFiles: take })
  const choose = (next: Target) => (setTarget(next), setNote(null))
  const Icon = TARGET_ICON(target)
  const label = TARGET_LABEL(target)

  return (
    <Dialog open onOpenChange={(open) => !open && void close()}>
      <DialogContent className="gap-5 sm:max-w-2xl [&>*]:min-w-0">
        <DialogHeader className="gap-1 text-left">
          <p className="readout flex items-center gap-2 text-accent">
            <Led lit={Boolean(drop.over)} />
            Input armed · {label}
          </p>
          <DialogTitle className="font-display text-2xl">Upload to {t.track.title}</DialogTitle>
        </DialogHeader>

        {isCompact ? (
          <LaneMenu title="Upload as" value={target} options={TARGETS.map((o) => o.target)} onChange={choose} align="start">
            <Button variant="secondary" className="w-full justify-start gap-2.5">
              <Icon size={16} aria-hidden="true" className="text-accent" />
              <span className="flex-1 text-left">{label}</span>
              <ChevronDown size={16} aria-hidden="true" className="text-ink-muted" />
            </Button>
          </LaneMenu>
        ) : (
          <fieldset>
            <legend className="readout mb-2 text-ink-muted">Upload as</legend>
            <div className="grid grid-cols-5 gap-2">
              {TARGETS.map(({ target: option, hint }) => {
                const OptionIcon = TARGET_ICON(option)
                return (
                  <label
                    key={option}
                    className={cn(
                      'surface-item group relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-line/40 px-2 py-4 text-center transition-[border-color,background-color,box-shadow] duration-200 hover:border-line',
                      'has-checked:border-accent/60 has-checked:bg-accent/[0.07] has-checked:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]',
                      'has-focus-visible:ring-2 has-focus-visible:ring-accent/50',
                    )}
                  >
                    <input type="radio" name="upload-as" value={option} checked={target === option} onChange={() => choose(option)} className="sr-only" />
                    <span className="flex size-10 items-center justify-center rounded-xl bg-white/[0.05] text-ink-muted transition-colors duration-200 group-has-checked:bg-accent group-has-checked:text-room-void">
                      <OptionIcon size={18} aria-hidden="true" />
                    </span>
                    <span className="font-display text-[15px] font-semibold text-ink-soft group-has-checked:text-ink">{TARGET_LABEL(option)}</span>
                    <span className="text-xs text-ink-muted">{hint}</span>
                    <Check size={14} strokeWidth={3} aria-hidden="true" className="absolute top-2.5 right-2.5 hidden size-[18px] rounded-full bg-accent p-0.5 text-room-void group-has-checked:block" />
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        <button
          type="button"
          {...drop.props}
          data-meter-host
          onClick={() => input.current?.click()}
          className={cn(
            'press flex min-h-44 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line-strong px-6 py-8 text-center transition-[border-color,background-color,box-shadow] duration-(--duration-normal) hover:border-accent/60 hover:bg-accent-dim',
            drop.over && 'meter-live border-accent bg-accent-dim glow-accent',
          )}
        >
          <Meter className="h-6" />
          <span className="font-display text-lg font-semibold text-ink">{drop.over ? 'Let go to add them' : isTouch ? `Choose ${target === 'final' ? 'the final' : 'files'}` : `Drop ${target === 'final' ? 'the final' : 'files'} here`}</span>
          <span className="text-sm text-ink-soft">{target === 'final' ? 'A WAV, AIFF or FLAC' : 'MP3s, WAVs, any audio'}{isTouch ? '' : ', or click to choose'}</span>
        </button>
        {note && <p role="status" className="-mt-2 text-[13px] text-ink-soft">{note}</p>}
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept={target === 'final' ? FINAL_ACCEPT : AUDIO_ACCEPT}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) take(files)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
