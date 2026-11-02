import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Album, ArrowUpDown, ChevronRight, LayoutGrid, LayoutList, ListMusic, Music, Timer, Upload, type LucideIcon } from 'lucide-react'
import { useState, type PointerEvent } from 'react'

import type { ReleaseRow } from '#/server/releases'
import { useFileDrop } from '../../hooks/ui/use-file-drop'
import { Button, Meter, useHoverSlide } from '../primitives'
import * as DropdownMenu from '../primitives/DropdownMenu'
import { SearchField } from '../primitives/SearchField'
import { SegmentedControl } from '../primitives/SegmentedControl'
import { Page } from '../layout/Page'
import { EmptyState } from '../shared/EmptyState'
import { MetaLine } from '../shared/MetaLine'
import { DropOverlay } from '../uploads/DropOverlay'
import { NewReleaseDialog } from '../uploads/NewReleaseDialog'
import { ReleaseArt } from './ReleaseArt'
import { deviceZone } from '../../lib/time'
import { SORTS, browse, listSearch, dateLabel, formatLength, releaseFacts, sortOf, type FormatFilter, type ListSearch, type View } from './browse'
import { FORMAT_LABEL, SECTIONS, releaseLink, type Section } from './sections'

const EMPTY = {
  upcoming: ['Nothing in progress', 'Drop a bounce anywhere here to start a single or EP. MP3 tests while it’s moving, the final WAV once it’s right.'],
  released: ['No releases yet', 'Drop what’s already out anywhere here, with the day it went out. New music starts in Upcoming.'],
} as const

const FORMATS: { value: FormatFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'single', label: 'Singles' },
  { value: 'ep', label: 'EPs' },
  { value: 'album', label: 'Albums' },
]

const VIEWS = [
  { value: 'list', label: <span className="max-sm:sr-only">List</span>, icon: <LayoutList size={16} aria-hidden="true" /> },
  { value: 'panels', label: <span className="max-sm:sr-only">Panels</span>, icon: <LayoutGrid size={16} aria-hidden="true" /> },
] as const

/** Upcoming or Releases: search, filter and sort above the releases, as a list or as panels. */
export function ReleaseList({ section, releases }: { section: Section; releases: ReleaseRow[] }) {
  // Everything here lives in the URL (`?q=&format=&sort=&view=&upload`), so a refresh, Back or a link keeps it.
  const search: ListSearch = useSearch({ strict: false })
  const navigate = useNavigate()
  // Refining the list replaces the entry (typing shouldn't flood Back); opening the dialog adds one, so Back closes it.
  const set = (next: Partial<ListSearch>, replace = true) =>
    void navigate({ to: '.', search: (prev: ListSearch) => listSearch({ ...prev, ...next }), replace, resetScroll: false })
  const query = search.q ?? ''
  const view: View = search.view ?? 'panels'
  const format: FormatFilter = search.format ?? 'all'
  const sort = sortOf(section, search.sort ?? null)
  const setQuery = (q: string) => set({ q })
  const setView = (v: View) => set({ view: v === 'list' ? 'list' : undefined })
  const setFormat = (f: FormatFilter | null) => set({ format: f === 'all' || f === null ? undefined : f })
  const setSort = (s: string) => set({ sort: s as ListSearch['sort'] })
  const shown = browse(section, releases, { query, format, sort, zone: deviceZone() })
  const [title, body] = EMPTY[section]
  const slide = useHoverSlide()
  const formatLabel = format === 'ep' ? 'EPs' : FORMATS.find((f) => f.value === format)!.label.toLowerCase()
  // Files dropped anywhere (or picked) open a new release, saved only on Save. On Releases it's one already out.
  // The open dialog is `?upload`; the files themselves can't ride in a URL, so a refresh opens it empty. While it holds
  // files, Back leaves it open rather than dropping them unseen.
  const [picked, setPicked] = useState<File[] | null>(null)
  const open = search.upload === true || (picked !== null && picked.length > 0)
  const openWith = (files: File[]) => (setPicked(files), !search.upload && set({ upload: true }, false))
  const close = () => (setPicked(null), set({ upload: undefined }))
  const dragging = useFileDrop(openWith, !open) // once open, the dialog takes its own drops
  const upload = (
    <Button onClick={() => openWith([])} aria-label="Upload" className="max-sm:w-11 max-sm:px-0">
      <Upload size={16} aria-hidden="true" />
      <span className="max-sm:hidden">Upload</span>
    </Button>
  )

  return (
    <Page title={SECTIONS[section].label} actions={releases.length > 0 && upload}>
      {dragging && <DropOverlay released={section === 'released'} />}
      {open && <NewReleaseDialog section={section} files={picked ?? []} onFilesChange={setPicked} onClose={close} />}
      {releases.length === 0 ? (
        <EmptyState title={title} readout={section === 'upcoming' ? 'Ch 01 · −∞ dB' : 'Off air'} flat action={upload}>
          {body}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <SearchField value={query} onValueChange={setQuery} aria-label={`Search ${SECTIONS[section].label}`} placeholder="Search by title" className="min-w-0 basis-full sm:basis-64 sm:flex-1" />
            <div className="-mx-1 flex min-w-0 flex-1 overflow-x-auto px-1 [scrollbar-width:none] max-sm:[mask-image:linear-gradient(90deg,black_80%,transparent)] sm:flex-none">
              <SegmentedControl ariaLabel="Format" value={format} onChange={setFormat} options={FORMATS} />
            </div>
            <SortMenu section={section} sort={sort} onSort={setSort} />
            <SegmentedControl ariaLabel="View" value={view} onChange={setView} options={VIEWS} />
          </div>

          <p className="readout -mb-2 px-1 text-ink-muted" aria-live="polite">
            {shown.length} of {releases.length} · {SORTS[section].find((s) => s.value === sort)!.label}
          </p>

          {shown.length === 0 ? (
            <EmptyState
              title="Nothing matches"
              readout="0 found"
              flat
              action={
                <Button variant="secondary" onClick={() => (setQuery(''), setFormat(null))}>
                  Show everything
                </Button>
              }
            >
              {query.trim() ? `Nothing ${format === 'all' ? '' : `in ${formatLabel} `}has “${query.trim()}” in its title.` : `No ${formatLabel} here yet.`}
            </EmptyState>
          ) : view === 'list' ? (
            <ul className="surface-card relative flex flex-col gap-1 rounded-3xl p-2" {...slide.group}>
              {slide.light}
              {shown.map((release) => (
                <li key={release.id} className="relative" {...slide.row}>
                  <ReleaseRowLink section={section} release={release} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] sm:gap-4">
              {shown.map((release) => (
                <li key={release.id}>
                  <ReleasePanel section={section} release={release} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Page>
  )
}

function SortMenu({ section, sort, onSort }: { section: Section; sort: string; onSort: (sort: string) => void }) {
  const current = SORTS[section].find((s) => s.value === sort)!
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" aria-label={`Sort: ${current.label}`} className="px-3.5">
          <ArrowUpDown size={16} aria-hidden="true" />
          <span className="max-lg:hidden">{current.label}</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="min-w-[13rem]">
        <DropdownMenu.RadioGroup value={sort} onValueChange={onSort}>
          {SORTS[section].map(({ value, label, icon: Icon }) => (
            <DropdownMenu.RadioItem key={value} value={value} className="gap-2">
              <Icon size={14} aria-hidden="true" className="text-ink-muted" />
              {label}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}

/** Like a streaming app's track row: the cover, the title large, the facts under it. */
function ReleaseRowLink({ section, release }: { section: Section; release: ReleaseRow }) {
  return (
    <Link {...releaseLink(section, release.id)} className="group playhead-sweep press flex min-h-18 items-center gap-4 rounded-2xl p-2 pr-3">
      <ReleaseArt title={release.title} artworkId={release.artwork_id} size="row" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-display text-lg font-semibold tracking-tight text-ink">{release.title}</span>
        <MetaLine facts={[dateLabel(section, release, deviceZone()), ...releaseFacts(release, FORMAT_LABEL[release.format])]} className="text-sm" />
      </span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-muted transition-[translate,color] group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  )
}

/** Leans a glass card away from the mouse, as if pressed, and puts its light under it (`.glass-card` does the rest). */
function lean(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return
  const card = event.currentTarget
  const box = card.getBoundingClientRect()
  const x = (event.clientX - box.left) / box.width
  const y = (event.clientY - box.top) / box.height
  card.style.setProperty('--mx', `${x * 100}%`)
  card.style.setProperty('--my', `${y * 100}%`)
  card.style.setProperty('--rx', `${(y - 0.5) * 5}deg`)
  card.style.setProperty('--ry', `${(0.5 - x) * 5}deg`)
}

const settle = (event: PointerEvent<HTMLElement>) => ['--rx', '--ry'].forEach((p) => event.currentTarget.style.removeProperty(p))

/** The cover first, then lit chips: format, tracks, length (each named for screen readers; the icon says it at a glance). */
function ReleasePanel({ section, release }: { section: Section; release: ReleaseRow }) {
  const tiles: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: release.format === 'single' ? Music : Album, label: 'Format', value: FORMAT_LABEL[release.format] },
    { icon: ListMusic, label: 'Tracks', value: String(release.track_count) },
    { icon: Timer, label: 'Length', value: release.duration_ms ? formatLength(release.duration_ms) : '—' },
  ]
  return (
    <Link
      {...releaseLink(section, release.id)}
      data-meter-host
      data-lift
      onPointerMove={lean}
      onPointerLeave={settle}
      className="surface-card glass-edge glass-card group relative flex flex-col gap-2.5 rounded-[1.5rem] p-2.5"
    >
      <span className="relative block overflow-hidden rounded-[1.4rem]">
        <ReleaseArt title={release.title} artworkId={release.artwork_id} size="panel" className="glass-card-art" />
        <span aria-hidden="true" className="glass absolute right-3 bottom-3 flex items-center rounded-full px-2.5 py-2 opacity-0 transition-opacity duration-(--duration-normal) group-hover:opacity-100 group-focus-visible:opacity-100">
          <Meter className="h-3.5" />
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-1">
        <span className="truncate font-display text-base font-semibold tracking-tight text-ink">{release.title}</span>
        <MetaLine facts={[dateLabel(section, release, deviceZone())]} className="text-[13px]" />
      </span>
      <dl className="flex flex-wrap gap-1.5">
        {tiles.map(({ icon: Icon, label, value }) => (
          <div key={label} className="surface-item flex min-w-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5">
            <dt>
              <Icon size={13} aria-hidden="true" className="shrink-0 text-accent" />
              <span className="sr-only">{label}</span>
            </dt>
            <dd data-numeric className="truncate text-[13px] font-semibold text-ink">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Link>
  )
}
