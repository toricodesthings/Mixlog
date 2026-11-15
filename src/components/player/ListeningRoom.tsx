import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AudioLines, ChevronDown, ChevronsUpDown, Disc3, Link2, Plus, Scale, SquareSplitHorizontal, Upload } from 'lucide-react'

import { useListening } from '../../hooks/ui/use-listening'
import { useShellMode } from '../../hooks/ui/use-shell-mode'
import { useSheetGesture } from '../../hooks/ui/use-sheet-gesture'
import { SPRINGS } from '../../lib/constants/motion'
import { cn } from '../../lib/utils'
import { reading } from '../meters/MeterBridge'
import { Led, Tip } from '../primitives'
import { Dialog, DialogStage, DialogTitle } from '../primitives/Dialog'
import { loadRelease, type ReleaseData } from '../releases/loaders'
import { isComparable, partnerOf } from '../releases/stacks'
import { VersionPicker, playableFrom } from '../releases/VersionPicker'
import { ZONES, sceneOf } from '../scene/generate'
import { Land } from '../scene/Land'
import { useRoomStyle } from '../scene/palette'
import { Sky } from '../scene/Sky'
import { ABSwitch, Said, TONE, useAuditionContext } from './ABSwitch'
import type { Side } from './ab'
import { Fetching, PlayToggle, Scrubber, SkipButton, VolumeControl } from './controls'
import { LoudnessWave } from './LoudnessWave'
import { useListenParam, usePlayer, type AB, type Playable } from './Player'
import { Vinyl } from './Vinyl'

/** B wears the room's counterpoint as its accent; A keeps the room's own (setting it to itself would be a cycle). */
const toned = (side: Side) => (side === 'b' ? ({ '--accent': TONE.b } as CSSProperties) : undefined)

/** Rises like a sheet and settles without a bounce or a tail; a spring, so a hand can catch it mid-flight. */
const RISE = { type: 'spring', visualDuration: 0.38, bounce: 0 } as const
const FALL = { duration: 0.25, ease: [0.32, 0.72, 0, 1] } as const

/**
 * The listening room (`?listen`): the player slides up and takes the whole screen, the song's own night around it
 * (its artwork's colours, Sky and Land, as on its Summary), the record turning in the middle of the sky, and the
 * transport on the ground. Escape, Back or the chevron lowers it again; playback never stops for any of it.
 *
 * In Upcoming it splits for A/B (`&b=`): two records, one soft divider, each side its song's night, the one you don't
 * hear veiled and still. The split is the player's, so it outlives the room; while the room is open the URL mirrors it.
 */
export function ListeningRoom() {
  const player = usePlayer()
  const listen = useListenParam()
  const open = listen.open && player.item !== null
  // Open, the URL splits and joins the decks (Back out of `&b=` leaves one record playing); lowered, they stay as they are.
  const wantSplit = listen.b !== null && !player.item?.released
  const split = player.ab !== null
  useEffect(() => {
    if (!open) return
    if (wantSplit && !split) player.compare(null)
    if (!wantSplit && split) player.uncompare()
  }, [open, wantSplit, split, player])
  return (
    <Dialog open={open} onOpenChange={(next) => !next && listen.hide()}>
      <AnimatePresence>{open && player.item ? <Room key="room" onLower={listen.hide} /> : null}</AnimatePresence>
    </Dialog>
  )
}

function Room({ onLower }: { onLower: () => void }) {
  const player = usePlayer()
  const { playing } = player
  // While it lowers (an exit animation), the room keeps showing what it last held, even after Stop
  const last = useRef({ item: player.item!, ab: player.ab })
  if (player.item) last.current = { item: player.item, ab: player.ab }
  const lead = last.current.item
  const ab = player.item ? player.ab : last.current.ab
  const listen = useListenParam()
  const { isDesktop } = useShellMode()
  const room = useRoomStyle(lead.releaseId, lead.artworkId)
  // A swipe down lowers it, the way it came; the gesture wakes once it has risen (it starts off-screen).
  const [sheet, setSheet] = useState<HTMLDivElement | null>(null)
  const [risen, setRisen] = useState(false)
  const { y } = useSheetGesture({ element: sheet, enabled: risen, onDismiss: onLower })
  const below = typeof window === 'undefined' ? 800 : window.innerHeight

  const { data, failed, retry, compare } = useCompare()
  // Split, the song's title moves up here (the release's, when A and B are two of its tracks)
  const twoSongs = ab?.b ? ab.a.sceneId !== ab.b.sceneId : false

  return (
    // Focus lands on Play, the room's one action, rather than on the way out
    <DialogStage onOpenAutoFocus={(event) => (event.preventDefault(), document.querySelector<HTMLElement>('[data-room-play]')?.focus())}>
      <motion.div
        data-listening-room
        className="layer-fullscreen-surface fixed inset-0 overflow-hidden outline-hidden"
        ref={setSheet}
        style={{ y }}
        initial={{ y: below }}
        animate={{ y: 0, transition: RISE }}
        exit={{ y: below, transition: FALL }}
        onAnimationComplete={(definition) => definition && typeof definition === 'object' && 'y' in definition && definition.y === 0 && setRisen(true)}
      >
        <div className="art-room h-full" style={room}>
          <div data-signal={ab ? undefined : 'readers'} className="art-scene @container relative isolate flex h-full flex-col overflow-hidden" data-room-scene>
            {!ab && <Sky sceneId={lead.sceneId} fp={lead.scene} zone={isDesktop ? ZONES.roomDesktop : ZONES.roomCompact} />}
            {/* The night dims toward the edges, so the eye lands on the record */}
            <div aria-hidden="true" data-signal-read className="room-vignette pointer-events-none absolute inset-0 z-[1]" />

            {/* Floats over the sky, so the record has the whole height above the land */}
            <header className="safe-header-top absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pt-3 sm:px-10 sm:pt-6">
              <Tip label="Lower the room">
                <button type="button" onClick={onLower} aria-label="Lower the listening room" className="press flex size-11 items-center justify-center rounded-full bg-room-void/40 text-ink backdrop-blur-md hover:bg-room-void/60">
                  <ChevronDown size={22} aria-hidden="true" />
                </button>
              </Tip>
              {/* Split, it stays narrower than the gap between the records, so nothing in it runs over one */}
              <div className={cn('min-w-0 flex-1 text-center', ab && 'mx-auto max-w-[16rem]')}>
                <DialogTitle className="readout text-ink-soft">{ab ? 'Listening room · A/B' : 'Listening room'}</DialogTitle>
                {ab ? (
                  <Link {...lead.link} onClick={onLower} className="mt-0.5 block truncate font-display text-lg leading-tight font-semibold text-ink hover:underline hover:underline-offset-4">
                    {twoSongs ? lead.release : lead.title}
                  </Link>
                ) : (
                  // A single's release is named like its track, which is said below
                  lead.release !== lead.title && (
                  <Link {...lead.link} onClick={onLower} className="mt-0.5 block truncate text-sm text-ink-muted hover:text-ink hover:underline hover:underline-offset-4">
                    From {lead.release}
                  </Link>
                  )
                )}
              </div>
              {/* A/B is Upcoming's: a released slot holds one file, so there's nothing to compare */}
              {lead.released ? (
                <span className="size-11 shrink-0" />
              ) : (
                <Tip label={ab ? 'Back to one record' : 'Compare A/B'}>
                  <button
                    type="button"
                    onClick={ab ? listen.unsplit : compare}
                    aria-pressed={ab !== null}
                    aria-label="Compare two versions, A/B"
                    className={cn('press flex size-11 items-center justify-center rounded-full backdrop-blur-md', ab ? 'bg-accent-soft text-accent' : 'bg-room-void/40 text-ink hover:bg-room-void/60')}
                  >
                    <SquareSplitHorizontal size={20} aria-hidden="true" />
                  </button>
                </Tip>
              )}
            </header>

            {ab ? (
              <PairTable ab={ab} playing={playing} isDesktop={isDesktop} />
            ) : (
              <>
                {/* The table: one record, sized by the room it's left (a size container), so it never runs under the title
                    or the hills; the tonearm's reach (~12% above, ~8% right) is in the margins. */}
                <div className="flex min-h-0 flex-1 items-center justify-center px-6 pt-20 pb-2 [container-type:size] sm:pt-24">
                  <motion.figure layoutId="room-record-a" transition={SPRINGS.GLIDE} className="flex flex-col items-center gap-4">
                    <Vinyl title={lead.release} releaseId={lead.releaseId} artworkId={lead.artworkId} spinning={playing} className="size-[min(90cqh,76cqw)]" />
                  </motion.figure>
                </div>
                {/* Low and quiet under the record (scene-calm), and melting into the ground the transport stands on */}
                <Land sceneId={lead.sceneId} fp={lead.scene} zone={isDesktop ? ZONES.roomDesktop : ZONES.roomCompact} className="scene-calm relative block h-[clamp(8rem,10.5cqw,13.5rem)] w-full shrink-0" />
              </>
            )}

            <div
              className={cn('scene-ground relative z-[2] shrink-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-10 sm:pb-7', ab && 'room-pair-ground')}
              style={ab ? ({ '--scene-glow-x': ab.live === 'a' ? '25%' : '75%' } as CSSProperties) : undefined}
            >
              {/* The idle side's veil carries on into the ground under it, so its land meets the ground without an edge */}
              {ab &&
                (['a', 'b'] as const).map((side) => (
                  <div
                    key={side}
                    aria-hidden="true"
                    data-side={side}
                    data-idle={ab.live === side ? undefined : ''}
                    className={cn('room-ground-veil pointer-events-none absolute top-0 -z-[1] h-36 w-1/2', side === 'a' ? 'left-0' : 'right-0')}
                  />
                ))}
              <div className={cn('mx-auto flex w-full flex-col items-center text-center', ab ? 'room-ground mt-1 max-w-6xl gap-2.5' : '-mt-6 max-w-3xl gap-3')}>
                {ab ? (
                  <PairGround ab={ab} isDesktop={isDesktop} />
                ) : (
                  <>
                    <div className="min-w-0 max-w-full">
                      <p className="truncate font-display text-2xl leading-tight font-semibold tracking-[-0.02em] sm:text-4xl">{lead.title}</p>
                      {lead.name !== lead.title && <p className="mt-1 truncate text-base text-ink-soft sm:text-lg">{lead.name}</p>}
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
                    {lead.wave ? <LoudnessWave item={lead} wave={lead.wave} size="room" className="mt-2" /> : <Scrubber className="mt-1" />}
                    <Transport isDesktop={isDesktop} />
                  </>
                )}
              </div>
            </div>
            <Said />
          </div>
        </div>
        {ab && listen.pick && <Pick side={listen.pick} ab={ab} data={data} failed={failed} onRetry={retry} tone={room} />}
      </motion.div>
    </DialogStage>
  )
}

/** Back and ahead, and Play: the room's transport keys, on its centre axis. */
function TransportKeys({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1 sm:gap-3', className)}>
      <SkipButton by={-30} size="lg" />
      <SkipButton by={-10} size="lg" />
      <PlayToggle size="lg" className="mx-1" data-room-play />
      <SkipButton by={10} size="lg" />
      <SkipButton by={30} size="lg" />
    </div>
  )
}

/** The transport, on the room's centre axis; level stays with the mouse (a phone has its own buttons for it). */
function Transport({ isDesktop }: { isDesktop: boolean }) {
  return (
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
      <span />
      <TransportKeys />
      {isDesktop ? <VolumeControl className="justify-self-end" /> : <span />}
    </div>
  )
}

/** The release's data while split: it fills the picker and resolves `?b=`. Read fresh each time the room splits (a
 *  bounce may have landed since); the picker shows skeletons meanwhile, and a load that fails says so with a retry. */
function useRelease(id: string | null) {
  const [data, setData] = useState<ReleaseData | null>(null)
  // The release this split has read: cleared when the split ends, so the next one waits for its own read
  const [readFor, setReadFor] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!id) return void setReadFor(null)
    let live = true
    loadRelease('upcoming', id)
      .then((d) => live && (setData(d), setReadFor(id)))
      .catch(() => live && setFailed(id))
    return () => void (live = false)
  }, [id, attempt])
  const current = data && data.release.id === id ? data : null
  // An earlier read of this release is still worth listing; the failure only shows when there's nothing to list
  return { data: current, fresh: current !== null && readFor === id, failed: !current && failed === id, retry: () => (setFailed(null), setAttempt((n) => n + 1)) }
}

/** Compare: B prefilled with `partnerOf` what's playing (the bounce before it when it's the newest, else the newest), so
 *  the first tap answers "is the new one better?". With neither, B waits as an empty platter. */
function useCompare() {
  const player = usePlayer()
  const listen = useListenParam()
  const releaseId = player.ab?.a.releaseId ?? null
  const { data, fresh, failed, retry } = useRelease(releaseId)
  const prefill = useRef(false)
  const ab = player.ab

  // B as the URL says (Forward into A/B), or prefilled once on Compare
  useEffect(() => {
    if (!ab || ab.b || !data) return
    const row = (id: string) => {
      const version = data.versions.find((v) => v.id === id && isComparable(v))
      const track = version && data.tracks.find((t) => t.id === version.track_id)
      return version && track ? playableFrom(data.release, { track, version }) : null
    }
    let b: Playable | null = typeof listen.b === 'string' ? row(listen.b) : null
    // The prefill waits for this split's own read: an earlier one may not have the bounce that landed since
    if (!b && prefill.current && !fresh) return
    if (!b && prefill.current) {
      const now = data.versions.find((v) => v.id === ab.a.versionId)
      const partner = now && partnerOf(now, data.versions)
      b = partner ? row(partner.id) : null
    }
    prefill.current = false
    if (b) player.put('b', b)
  }, [ab, data, fresh, listen.b, player])

  // The URL follows what's on B (a pick, a swap), in place: it's the same step in history
  useEffect(() => {
    // Only while the URL still says split: leaving A/B drops `b` a beat before the decks join
    if (ab?.b && listen.b !== null && listen.b !== ab.b.versionId) listen.setB(ab.b.versionId)
  }, [ab?.b, listen])

  return {
    data,
    failed,
    retry,
    compare: () => {
      prefill.current = true
      void listen.split(null)
    },
  }
}

/** The two halves: each its own night (one of the two mirrored, so each moon sits in its outer corner and one song meets
 *  itself at the divider as one valley), its record and its name. The half you don't hear is veiled, its moon set, its
 *  ambient motion still. */
function PairTable({ ab, playing, isDesktop }: { ab: AB; playing: boolean; isDesktop: boolean }) {
  const { sync } = useListening()
  return (
    <div className="relative grid min-h-0 flex-1 grid-cols-2">
      {(['a', 'b'] as const).map((side) => (
        <Half key={side} side={side} ab={ab} playing={playing} sync={sync} isDesktop={isDesktop} />
      ))}
      <motion.span
        aria-hidden="true"
        className="room-divider pointer-events-none absolute inset-y-0 left-1/2 z-[3] w-px -translate-x-1/2"
        style={{ originY: 0 }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  )
}

function Half({ side, ab, playing, sync, isDesktop }: { side: Side; ab: AB; playing: boolean; sync: boolean; isDesktop: boolean }) {
  const listen = useListenParam()
  const { bind } = useAuditionContext()
  const deck = ab[side]
  const heard = ab.live === side
  // The other side's night stands in until B has a version of its own
  const scene = deck ?? ab.a
  const name = side.toUpperCase()
  // The mirror follows the moon, not the side: A wants it on the left, B on the right, each in its outer corner
  const moonRight = sceneOf(scene.sceneId, scene.scene, ZONES.roomPair).sky.moon.side === 1
  const mirrored = (side === 'a') === moonRight ? '-scale-x-100' : undefined
  // The header ends at 4.5rem on desktop; on a phone it's pushed down by the safe area, so the record is too. The
  // caption takes exactly 5rem under it (the gap, the 44 px chip, the gap, the 20 px readout line; 6.25rem on a phone, where it's two lines); the record keeps 92% of what's left, so the ground below has some air.
  const size = isDesktop ? 'size-[min(calc((100cqh-5rem)*0.92),57cqw)]' : 'size-[min(calc((100cqh-6.25rem)*0.92),72cqw)]'
  return (
    <section
      aria-label={`Side ${name}`}
      data-side={side}
      data-compact={isDesktop ? undefined : ''}
      data-signal={heard ? 'readers' : undefined}
      data-idle={heard ? undefined : ''}
      className="room-half art-scene relative isolate flex min-h-0 min-w-0 flex-col overflow-hidden"
      style={toned(side)}
    >
      <div className={cn('room-scene absolute inset-0 -z-10', mirrored)}>
        <Sky sceneId={scene.sceneId} fp={scene.scene} zone={ZONES.roomPair} />
      </div>
      {/* A figure, so the caption under the record is its caption */}
      <figure className={cn('relative z-[2] flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-3 pb-1 [container-type:size]', isDesktop ? 'pt-[4.5rem]' : 'pt-[calc(4rem+env(safe-area-inset-top))]')}>
        {deck ? (
          <motion.button
            type="button"
            layoutId={side === 'a' ? 'room-record-a' : undefined}
            initial={side === 'b' ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={SPRINGS.GLIDE}
            aria-pressed={heard}
            aria-busy={ab.pending === side || undefined}
            aria-label={`Listen to ${name}: ${deck.label}`}
            {...bind(side)}
            className="room-record ab-press relative shrink-0 rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
          >
            <Vinyl title={deck.release} releaseId={deck.releaseId} artworkId={deck.artworkId} spinning={playing && (sync || heard)} armDown={playing && heard} className={size} />
            {ab.pending === side && <Fetching side={side} className="absolute inset-[42%] size-auto text-[var(--accent)]" />}
          </motion.button>
        ) : (
          // The chip under it says "Pick a version": the only place the words appear
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => listen.openPick(side)}
            aria-label={`Pick a version for ${name}`}
            className={cn('room-empty press flex shrink-0 items-center justify-center rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/60', size)}
          >
            <Plus size={28} aria-hidden="true" className="text-[var(--accent)]" />
          </motion.button>
        )}
        <Caption side={side} ab={ab} isDesktop={isDesktop} />
      </figure>
      <Land sceneId={scene.sceneId} fp={scene.scene} zone={ZONES.roomPair} className={cn('room-scene scene-calm relative block w-full shrink-0', isDesktop ? 'h-[clamp(4rem,7cqw,8rem)]' : 'h-14', mirrored)} />
      {/* Over its night only, never the record or its words */}
      <div aria-hidden="true" className="room-veil pointer-events-none absolute inset-0 z-[1]" />
    </section>
  )
}

/** The side's file, said once, on the chip that changes it: its badge and the file's own name (after the song's title
 *  when A and B are two songs). Under it, always (so both captions are one height and the records line up), the
 *  version, its loudness and, on the trimmed side only, by how much. */
function Caption({ side, ab, isDesktop }: { side: Side; ab: AB; isDesktop: boolean }) {
  const listen = useListenParam()
  const deck = ab[side]
  const trim = ab.trim?.[side] ?? null
  const name = side.toUpperCase()
  // The file's own name leads (as on Tracks); the version and its loudness read under it. Two songs: the track first.
  const twoSongs = ab.b !== null && ab.a.sceneId !== ab.b.sceneId
  const label = deck ? (twoSongs ? `${deck.title} · ${deck.name}` : deck.name) : null
  return (
    <figcaption className="flex min-w-0 max-w-full flex-col items-center gap-1 text-center">
      <button
        type="button"
        onClick={() => listen.openPick(side)}
        aria-label={`Change ${name}: ${deck ? `${label}, ${deck.label}` : 'nothing yet'}`}
        className="press flex h-11 max-w-full min-w-0 items-center gap-2 rounded-full bg-room-void/40 pr-3 pl-2 backdrop-blur-md hover:bg-room-void/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <span aria-hidden="true" className="readout flex size-6 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
          {name}
        </span>
        {/* A phone's half is narrow: the name takes two lines in the chip's height rather than being cut */}
        <span className={cn(deck ? (isDesktop ? 'truncate text-[0.9375rem] font-medium' : 'line-clamp-2 text-left text-[0.8125rem] leading-tight font-medium break-words') : 'readout truncate', 'text-ink')}>{label ?? 'Pick a version'}</span>
        <ChevronsUpDown size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
      </button>
      {/* One line on desktop; two on a phone's narrow half, so the loudness is never the part cut off */}
      <span data-numeric aria-hidden={deck ? undefined : true} className={cn('readout flex max-w-full min-w-0 items-center justify-center gap-x-3 text-ink-soft', isDesktop ? 'h-5' : 'h-10 flex-wrap content-center')}>
        {deck && <span className={cn('truncate', !isDesktop && 'basis-full')}>{deck.label}{isDesktop && ' ·'}</span>}
        {deck && <span className="shrink-0">{deck.lufs === null ? 'Not measured' : `${reading(deck.lufs)} LUFS`}</span>}
        {deck && trim !== null && trim < 0 && <span className="shrink-0 text-accent-tertiary">trimmed {reading(trim)} dB</span>}
      </span>
    </figcaption>
  )
}

/** The ground, split: one grid (`.room-console` in app.css) for both decks, the A | B switch, Sync and Level match, and
 *  the transport. From 64rem of ground the waves sit either side of the switch, each under its own record; narrower
 *  they stack, and a phone orders it bottom-up so Play and the switch stay under the thumb. The edges that should meet
 *  (the switch, Play and the divider; a wave's inner end and its key's outer edge) are the same columns' edges. */
function PairGround({ ab, isDesktop }: { ab: AB; isDesktop: boolean }) {
  const axis = Math.max(ab.a.wave?.ms ?? 0, ab.b?.wave?.ms ?? 0) / 1000 || undefined
  const twoSongs = ab.b !== null && ab.a.sceneId !== ab.b.sceneId
  return (
    <div className="room-console" data-compact={isDesktop ? undefined : ''}>
      <DeckStrip side="a" deck={ab.a} axis={axis} twoSongs={twoSongs} />
      <ABSwitch />
      <DeckStrip side="b" deck={ab.b} axis={axis} twoSongs={twoSongs} />
      <SyncToggle className="room-key-sync" />
      <TransportKeys className="room-transport" />
      <MatchToggle ab={ab} className="room-key-match" />
      {isDesktop && <VolumeControl className="room-volume" />}
    </div>
  )
}

/** One side's playhead: its badge (Change, as the chip under its record does), then its wave; the Scrubber until it's
 *  measured; a flat trace while the side is empty. The last two stand at the pair wave's height (56 px × 1.2). */
function DeckStrip({ side, deck, axis, twoSongs }: { side: Side; deck: Playable | null; axis?: number; twoSongs: boolean }) {
  const listen = useListenParam()
  const name = side.toUpperCase()
  return (
    <div data-side={side} style={toned(side)} className="flex w-full min-w-0 items-center gap-2">
      <Tip label={`Change ${name}`} side="top">
        <button
          type="button"
          onClick={() => listen.openPick(side)}
          aria-label={`Change ${name}: ${deck ? `${twoSongs ? `${deck.title} · ` : ''}${deck.name}, ${deck.label}` : 'nothing yet'}`}
          className="press readout flex h-11 min-w-14 shrink-0 items-center justify-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-3 text-[var(--accent)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {name}
          <ChevronsUpDown size={12} aria-hidden="true" />
        </button>
      </Tip>
      {deck?.wave ? (
        <LoudnessWave item={deck} wave={deck.wave} size="pair" deck={side} axis={axis} className="min-w-0 flex-1" />
      ) : deck ? (
        <Scrubber deck={side} className="min-w-0 flex-1" />
      ) : (
        <span aria-hidden="true" className="room-flat h-[67.2px] min-w-0 flex-1" />
      )}
    </div>
  )
}

/** Sync and Level match are console keys: solid (the switch's top highlight), one width so they mirror about the axis
 *  (Level match's LED, icon and label need ~151 px), lit while they act. On compact each takes up to that width and
 *  they meet at the centre. */
const KEY = 'press glass-edge readout flex h-11 shrink-0 items-center whitespace-nowrap justify-center gap-2 rounded-xl border transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/50'
const LIT = 'surface-control-accent raise border-accent/45 text-ink'
const UNLIT = 'surface-control border-line/30 text-ink-soft hover:text-ink'
const useKeyWidth = () => (useShellMode().isCompact ? 'w-full max-w-40' : 'w-40')

/** Sync (one playhead under both) and Level match (both at the same loudness, down only): each remembered on this
 *  device. */
function SyncToggle({ className }: { className?: string }) {
  const { sync, set } = useListening()
  const width = useKeyWidth()
  return (
    <Tip label={sync ? 'One playhead under both' : 'Each side keeps its own place'} side="top">
      <button type="button" aria-pressed={sync} onClick={() => set({ sync: !sync })} className={cn(KEY, width, sync ? LIT : UNLIT, className)}>
        <Led lit={sync} />
        <Link2 size={14} aria-hidden="true" />
        Sync
      </button>
    </Tip>
  )
}

/** Its label never changes (so its width never does): when it can't act, the reason is its tip, a tap away on touch. */
function MatchToggle({ ab, className }: { ab: AB; className?: string }) {
  const { match, matchTo, set } = useListening()
  const { canTrim } = usePlayer()
  const width = useKeyWidth()
  const measured = ab.a.lufs !== null && ab.b !== null && ab.b.lufs !== null
  const can = canTrim && measured
  const reason = !canTrim ? 'Can’t trim on this device' : !measured ? 'Not measured yet' : null
  const tip = reason ?? (matchTo === 'streaming' ? 'Both at streaming level, or the quieter one' : 'Both at the quieter one’s loudness')
  const lit = can && match
  return (
    <Tip label={tip} side="top" toggle={!can}>
      <button
        type="button"
        aria-pressed={lit}
        aria-disabled={!can || undefined}
        onClick={() => can && set({ match: !match })}
        className={cn(KEY, width, lit ? LIT : can ? UNLIT : 'surface-control cursor-default border-line/30 text-ink-muted', className)}
      >
        <Led lit={lit} />
        <Scale size={14} aria-hidden="true" />
        Level match
        {reason && <span className="sr-only">, {reason}</span>}
      </button>
    </Tip>
  )
}

/** The picker for a side (`&pick=a|b`), in the room's light: choosing a row puts it there and closes. */
function Pick({ side, ab, data, failed, onRetry, tone }: { side: Side; ab: AB; data: ReleaseData | null; failed: boolean; onRetry: () => void; tone: CSSProperties }) {
  const player = usePlayer()
  const listen = useListenParam()
  return (
    <VersionPicker
      side={side}
      data={data}
      failed={failed}
      onRetry={onRetry}
      tone={tone}
      on={{ a: ab.a, b: ab.b }}
      onClose={() => void listen.closePick()}
      onPick={(item) => (player.put(side, item), void listen.closePick())}
    />
  )
}
