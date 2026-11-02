import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Hash, Maximize2, NotebookPen, X } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type RefObject } from 'react'

import { useLyrics, type LyricsStatus } from '../../hooks/releases/use-lyrics'
import { cn } from '../../lib/utils'
import { Led, Tip } from '../primitives'
import { Dialog, DialogStage, DialogTitle } from '../primitives/Dialog'
import { countOf, isTag, markSection, previewOf, SECTIONS, type Section } from './lyrics'

type Lyrics = ReturnType<typeof useLyrics>

/**
 * A track's lyrics on its Details: folded to their opening lines, opened to write in place, or expanded into the
 * writing room. Saved as they're written, never with Details' Save.
 */
export function LyricsPanel({ trackId, title, initial }: { trackId: string; title: string; initial: string }) {
  const lyrics = useLyrics(trackId, initial)
  const [open, setOpen] = useState(false)
  const [room, setRoom] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const preview = previewOf(lyrics.text)
  return (
    <section className={cn('rounded-2xl border border-line/30 transition-colors', open ? 'bg-white/[0.035]' : 'bg-white/[0.02]')}>
      <div className="flex items-center gap-1 pr-1.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
        >
          <NotebookPen size={18} aria-hidden="true" className="shrink-0 text-accent" />
          <span className="font-display text-[15px] font-semibold">Lyrics</span>
          <SaveState status={lyrics.status} onRetry={() => void lyrics.flush()} quiet />
          <ChevronDown size={18} aria-hidden="true" className={cn('ml-auto shrink-0 text-ink-muted transition-transform duration-200', open && 'rotate-180')} />
        </button>
        <Tip label="Open the writing room">
          <button type="button" onClick={() => setRoom(true)} aria-label={`Open the writing room for ${title}`} className="press flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-white/[0.05] hover:text-ink">
            <Maximize2 size={16} aria-hidden="true" />
          </button>
        </Tip>
      </div>

      {open ? (
        <div className="flex flex-col gap-3 px-3.5 pb-3.5">
          <SectionBar field={field} lyrics={lyrics} />
          <LyricsField ref={field} lyrics={lyrics} label={`${title} lyrics`} className="min-h-48 rounded-xl border border-line-light bg-white/[0.04] px-3.5 py-3 text-[15px] leading-relaxed transition-colors focus-within:border-accent/40" />
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} tabIndex={-1} className="block w-full cursor-pointer px-3.5 pb-3.5 pl-[2.95rem] text-left text-[15px] leading-relaxed">
          {preview.length ? (
            preview.map((line, i) => (
              <span key={i} className={cn('block truncate', isTag(line) ? 'readout text-accent' : 'text-ink-soft')}>
                {line}
              </span>
            ))
          ) : (
            <span className="text-ink-muted">None yet. Write them here, or paste them straight from Musixmatch.</span>
          )}
        </button>
      )}

      <WritingRoom open={room} onClose={() => (void lyrics.flush(), setRoom(false))} lyrics={lyrics} title={title} />
    </section>
  )
}

/** Saved, saving, or a retry: the one place the lyrics say whether they're safe. */
function SaveState({ status, onRetry, quiet }: { status: LyricsStatus; onRetry: () => void; quiet?: boolean }) {
  if (status === 'failed')
    return (
      <span role="button" tabIndex={0} onClick={(e) => (e.stopPropagation(), onRetry())} onKeyDown={(e) => e.key === 'Enter' && onRetry()} className="readout cursor-pointer text-feedback-error hover:underline">
        Couldn’t save · Retry
      </span>
    )
  return (
    <span className={cn('readout flex items-center gap-1.5 text-ink-muted', quiet && status === 'saved' && 'opacity-0')} aria-live="polite">
      <Led lit={status === 'saved'} breathe={status === 'saving'} />
      {status === 'saved' ? 'Saved' : 'Saving…'}
    </span>
  )
}

/** One click marks the section the cursor is in, the Musixmatch way: `#CHORUS` on its own line above it. */
function SectionBar({ field, lyrics, className }: { field: RefObject<HTMLTextAreaElement | null>; lyrics: Lyrics; className?: string }) {
  const mark = (section: Section) => {
    const el = field.current
    const next = markSection(lyrics.text, el?.selectionStart ?? lyrics.text.length, section)
    lyrics.edit(next.text)
    requestAnimationFrame(() => (el?.focus(), el?.setSelectionRange(next.at, next.at)))
  }
  return (
    <div role="toolbar" aria-label="Mark a section" className={cn('flex gap-1.5 overflow-x-auto [scrollbar-width:none]', className)}>
      {SECTIONS.map((section) => (
        <button
          key={section}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => mark(section)}
          className="surface-control press flex min-h-9 shrink-0 cursor-pointer items-center gap-0.5 rounded-full border border-line/30 px-3 text-[13px] font-medium text-ink-soft hover:border-accent/40 hover:text-accent"
        >
          <Hash size={13} aria-hidden="true" className="text-accent" />
          {section}
        </button>
      ))}
    </div>
  )
}

/**
 * Plain text to write in (so a paste from Musixmatch lands exactly), with its section tags lit: the words are drawn
 * by a mirror behind a see-through textarea, same font and wrapping, so only the colour differs.
 */
function LyricsField({ ref, lyrics, label, className }: { ref: RefObject<HTMLTextAreaElement | null>; lyrics: Lyrics; label: string; className?: string }) {
  const save = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') (e.preventDefault(), void lyrics.flush())
  }
  const shared = 'col-start-1 row-start-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]'
  return (
    // The frame shows focus (data-focus-container), so the words never sit in a ring of their own
    <div data-focus-container className={cn('grid', className)}>
      <div aria-hidden="true" className={cn(shared, 'pointer-events-none text-ink')}>
        {lyrics.text.split('\n').map((line, i) => (
          <span key={i}>
            {i > 0 && '\n'}
            {isTag(line) ? <span className="rounded-sm bg-accent/12 text-accent">{line}</span> : line}
          </span>
        ))}
        {/* A last empty line still takes its height */}
        {'​'}
      </div>
      <textarea
        ref={ref}
        aria-label={label}
        value={lyrics.text}
        maxLength={20_000}
        spellCheck
        placeholder="Verse, chorus, verse…"
        onChange={(e) => lyrics.edit(e.target.value)}
        onKeyDown={save}
        className={cn(shared, 'resize-none overflow-hidden bg-transparent p-0 text-transparent caret-accent outline-none placeholder:text-ink-muted selection:bg-accent/30 selection:text-ink')}
      />
    </div>
  )
}

/** The writing room: the lyrics fill the screen like a page in a document, the section tags along the top. */
function WritingRoom({ open, onClose, lyrics, title }: { open: boolean; onClose: () => void; lyrics: Lyrics; title: string }) {
  const field = useRef<HTMLTextAreaElement>(null)
  const { lines, words } = countOf(lyrics.text)
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AnimatePresence>
        {open && (
          <DialogStage onOpenAutoFocus={(e) => (e.preventDefault(), field.current?.focus())}>
            <motion.div
              className="layer-fullscreen-surface fixed inset-0 flex flex-col bg-room-deep outline-none"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.18, ease: [0.25, 1, 0.5, 1] } }}
            >
              <header className="safe-header-top surface-shell flex shrink-0 items-center gap-3 border-b border-line/40 px-4 pt-3 pb-3 sm:px-8">
                <div className="min-w-0 flex-1">
                  <p className="readout text-accent">Writing room</p>
                  <DialogTitle className="mt-0.5 truncate font-display text-xl font-semibold tracking-tight">{title}</DialogTitle>
                </div>
                <SaveState status={lyrics.status} onRetry={() => void lyrics.flush()} />
                <Tip label="Close the writing room">
                  <button type="button" onClick={onClose} aria-label="Close the writing room" className="press flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-white/[0.06] hover:text-ink">
                    <X size={20} aria-hidden="true" />
                  </button>
                </Tip>
              </header>
              <div className="shrink-0 border-b border-line/30 px-4 py-2.5 sm:px-8">
                <SectionBar field={field} lyrics={lyrics} className="mx-auto max-w-[48rem]" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-6 sm:px-8 sm:py-10" onClick={(e) => e.target === e.currentTarget && field.current?.focus()}>
                <div className="surface-card mx-auto flex min-h-full w-full max-w-[48rem] flex-col rounded-3xl border border-transparent px-6 py-8 transition-colors focus-within:border-accent/25 sm:px-14 sm:py-14">
                  {/* The whole page takes a click, not just the lines written so far */}
                  <LyricsField ref={field} lyrics={lyrics} label={`${title} lyrics`} className="flex-1 text-[17px] leading-[1.85]" />
                </div>
              </div>
              <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-line/30 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-8">
                <span data-numeric className="text-[13px] text-ink-muted">
                  {lines} line{lines === 1 ? '' : 's'} · {words} word{words === 1 ? '' : 's'}
                </span>
                <span className="hidden text-[13px] text-ink-muted sm:block">Paste from Musixmatch as is: its tags and spacing carry over.</span>
              </footer>
            </motion.div>
          </DialogStage>
        )}
      </AnimatePresence>
    </Dialog>
  )
}
