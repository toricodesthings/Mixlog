import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { AudioLines, ChevronDown, Disc3, Upload } from 'lucide-react'

import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { cn } from '../../lib/utils'
import { Tip } from '../primitives'
import { Dialog, DialogStage, DialogTitle } from '../primitives/Dialog'
import { Land } from '../scene/Land'
import { useRoomStyle } from '../scene/palette'
import { Sky } from '../scene/Sky'
import { PlayToggle, Scrubber, SkipButton, VolumeControl } from './controls'
import { useListenParam, usePlayer, type Playable } from './Player'
import { Vinyl } from './Vinyl'

/**
 * One record on the table. Today the room holds one deck: what's playing. A/B adds a second (`side` "A" and "B", the
 * same playhead under both), and the room sets them side by side; nothing else here changes.
 */
export type Deck = { playable: Playable; side?: string }

/** The sheet's own curve: it rises like a sheet and settles without a bounce. */
const RISE = { duration: 0.5, ease: [0.32, 0.72, 0, 1] } as const
const FALL = { duration: 0.32, ease: [0.32, 0.72, 0, 1] } as const

/**
 * The listening room (`?listen`): the player slides up and takes the whole screen, the release's own night around it
 * (its artwork's colours, Sky and Land, as on its Summary), the record turning in the middle of the sky, and the
 * transport on the ground. Escape, Back or the chevron lowers it again; playback never stops for any of it.
 */
export function ListeningRoom() {
  const player = usePlayer()
  const listen = useListenParam()
  const open = listen.open && player.item !== null
  return (
    <Dialog open={open} onOpenChange={(next) => !next && listen.hide()}>
      <AnimatePresence>{open && player.item ? <Room key="room" decks={[{ playable: player.item }]} onLower={listen.hide} /> : null}</AnimatePresence>
    </Dialog>
  )
}

function Room({ decks, onLower }: { decks: Deck[]; onLower: () => void }) {
  const { playing, item } = usePlayer()
  const { isDesktop } = useShellMode()
  const lead = decks[0].playable
  const room = useRoomStyle(lead.release, lead.artworkId)
  const pair = decks.length > 1
  return (
    // Focus lands on Play, the room's one action, rather than on the way out
    <DialogStage onOpenAutoFocus={(event) => (event.preventDefault(), document.querySelector<HTMLElement>('[data-room-play]')?.focus())}>
      <motion.div
        className="layer-fullscreen-surface fixed inset-0 overflow-hidden outline-none"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: RISE }}
        exit={{ y: '100%', transition: FALL }}
      >
        <div className="art-room h-full" style={room}>
          <div data-signal className="art-scene @container relative isolate flex h-full flex-col overflow-hidden">
            <Sky moon={isDesktop ? 'top-[18%] left-[12%]' : 'top-[12%] left-[16%]'} />
            {/* The night dims toward the edges, so the eye lands on the record */}
            <div aria-hidden="true" className="room-vignette pointer-events-none absolute inset-0" />

            {/* Floats over the sky, so the record has the whole height above the land */}
            <header className="safe-header-top absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pt-3 sm:px-10 sm:pt-6">
              <Tip label="Lower the room">
                <button type="button" onClick={onLower} aria-label="Lower the listening room" className="press flex size-11 items-center justify-center rounded-full bg-room-void/40 text-ink backdrop-blur-md hover:bg-room-void/60">
                  <ChevronDown size={22} aria-hidden="true" />
                </button>
              </Tip>
              <div className="min-w-0 flex-1 text-center">
                <DialogTitle className="readout text-ink-soft">Listening room</DialogTitle>
                {/* A single's release is named like its track, which is said below */}
                {lead.release !== lead.title && (
                  <Link {...lead.link} onClick={onLower} className="mt-0.5 block truncate text-sm text-ink-muted hover:text-ink hover:underline hover:underline-offset-4">
                    From {lead.release}
                  </Link>
                )}
              </div>
              <span className="size-11 shrink-0" />
            </header>

            {/* The table: one record, or two side by side for A/B. Sized by the room it's left (a size container), so it
                never runs under the title or the hills; the tonearm's reach (~12% above, ~8% right) is in the margins. */}
            <div className={cn('flex min-h-0 flex-1 items-center justify-center px-6 pt-20 pb-2 [container-type:size] sm:pt-24', pair ? 'gap-[6cqw]' : '')}>
              {decks.map(({ playable, side }) => (
                <figure key={playable.versionId} className="flex flex-col items-center gap-4">
                  <Vinyl
                    title={playable.release}
                    artworkId={playable.artworkId}
                    spinning={playing && playable.versionId === item?.versionId}
                    className={pair ? 'size-[min(calc(90cqh-2.5rem),38cqw)]' : 'size-[min(90cqh,76cqw)]'}
                  />
                  {side && <figcaption className="readout text-ink-soft">{side} · {playable.label}</figcaption>}
                </figure>
              ))}
            </div>

            {/* Low and quiet under the record (scene-calm), and melting into the ground the transport stands on */}
            <Land className="scene-calm relative block h-[clamp(8rem,10.5cqw,13.5rem)] w-full shrink-0" />
            <div className="scene-ground relative shrink-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-10 sm:pb-7">
              <div className="mx-auto -mt-6 flex w-full max-w-3xl flex-col items-center gap-3 text-center">
                <div className="min-w-0 max-w-full">
                  <p className="truncate font-display text-2xl leading-tight font-semibold tracking-[-0.02em] sm:text-4xl">{lead.title}</p>
                  <p className="readout mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-ink-soft">
                    <span className="flex items-center gap-1.5">
                      <AudioLines size={13} aria-hidden="true" className="text-accent" />
                      {lead.label}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {lead.released ? <Disc3 size={13} aria-hidden="true" className="text-accent" /> : <Upload size={13} aria-hidden="true" className="text-accent" />}
                      {lead.day}
                    </span>
                  </p>
                </div>
                <Scrubber className="mt-1" />
                <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
                  <span />
                  <div className="flex items-center gap-1 sm:gap-3">
                    <SkipButton by={-30} size="lg" />
                    <SkipButton by={-10} size="lg" />
                    <PlayToggle size="lg" className="mx-1" data-room-play />
                    <SkipButton by={10} size="lg" />
                    <SkipButton by={30} size="lg" />
                  </div>
                  {/* Level stays with the mouse; a phone has its own buttons for it */}
                  {isDesktop ? <VolumeControl className="justify-self-end" /> : <span />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </DialogStage>
  )
}
