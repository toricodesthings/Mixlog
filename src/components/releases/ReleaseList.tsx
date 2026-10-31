import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Album, ArrowUpDown, ChevronRight, LayoutGrid, LayoutList, ListMusic, Music, Timer, Upload, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import type { ReleaseRow } from '#/server/releases'
import { useFileDrop } from '../../hooks/ui/use-file-drop'
import { Button, Meter } from '../primitives'
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
  const view: View = search.view ?? 'list'
  const format: FormatFilter = search.format ?? 'all'
  const sort = sortOf(section, search.sort ?? null)
  const setQuery = (q: string) => set({ q })
  const setView = (v: View) => set({ view: v === 'panels' ? 'panels' : undefined })
  const setFormat = (f: FormatFilter | null) => set({ format: f === 'all' || f === null ? undefined : f })
  const setSort = (s: string) => set({ sort: s as ListSearch['sort'] })
  const shown = browse(section, releases, { query, format, sort, zone: deviceZone() })
  const [title, body] = EMPTY[section]
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
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
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
            <ul className="surface-card flex flex-col gap-1 rounded-3xl p-2">
              {shown.map((release) => (
                <li key={release.id}>
                  <ReleaseRowLink section={section} release={release} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
    <Link {...releaseLink(section, release.id)} className="group playhead-sweep press flex min-h-18 items-center gap-4 rounded-2xl p-2 pr-3 transition-colors hover:bg-accent-dim">
      <ReleaseArt title={release.title} artworkId={release.artwork_id} size="row" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-display text-[17px] font-semibold tracking-tight text-ink">{release.title}</span>
        <MetaLine facts={[dateLabel(section, release, deviceZone()), ...releaseFacts(release, FORMAT_LABEL[release.format])]} />
      </span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-muted transition-[translate,color] group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  )
}

/** The cover first, then a grid of lit tiles: format, tracks, length. */
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
      className="surface-card glass-edge group relative flex flex-col gap-3 rounded-[1.75rem] p-3 transition-[translate,box-shadow] duration-(--duration-smooth) ease-(--ease-out-expo) hover:-translate-y-1 hover:glow-accent"
    >
      <span className="relative block">
        <ReleaseArt title={release.title} artworkId={release.artwork_id} size="panel" />
        <span aria-hidden="true" className="glass absolute right-3 bottom-3 flex items-center rounded-full px-2.5 py-2 opacity-0 transition-opacity duration-(--duration-normal) group-hover:opacity-100 group-focus-visible:opacity-100">
          <Meter className="h-3.5" />
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-1">
        <span className="truncate font-display text-lg font-semibold tracking-tight text-ink">{release.title}</span>
        <MetaLine facts={[dateLabel(section, release, deviceZone())]} />
      </span>
      <dl className="grid grid-cols-3 gap-2">
        {tiles.map(({ icon: Icon, label, value }) => (
          <div key={label} className="surface-item flex min-w-0 flex-col gap-1.5 rounded-2xl px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-ink-muted">
              <Icon size={13} aria-hidden="true" className="shrink-0 text-accent" />
              <span className="readout truncate text-[9.5px]">{label}</span>
            </dt>
            <dd data-numeric className="truncate text-sm font-semibold text-ink">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Link>
  )
}
