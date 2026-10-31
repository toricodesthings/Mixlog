# Mixlog Frontend — Agent Instructions

The app the browser runs: TanStack Start in SPA mode (`defaultSsr: false`, intentional), served by the same Worker as the server side ([`server/`](server/AGENTS.md)). It reaches data only through that side's server functions. It embodies the **Blue Hour** design language, a sibling of Cadence's Twilight Sanctuary; functional correctness and aesthetic integrity are equally non-negotiable. Everything in `src/` except `server/` follows this guide.

## 1. Non-Negotiables

- Client-rendered SPA. Do not introduce SSR assumptions: loaders run in the browser, and the shell is browser-only (`AppShell` sits inside `ClientOnly`).
- Data comes from server functions in `server/`, called from route loaders or components. File bytes are the one exception: they go through the `/api` routes, and only `lib/files.ts` talks to them (`fileUrl`, and `uploadArtwork`/`uploadAudio`, which send with XHR because only XHR reports upload progress). Never import `cloudflare:workers` here.
- Reusable hooks → `hooks/`; non-UI logic → `lib/` (client-safe, no server imports); shared UI → `components/` grouped by domain; Radix always through `components/primitives/`, never imported raw into domain components.
- **Tone.** Always fantasy, inspirational, techy, futuristic, visually striking, animated, design- and icon-heavy. Never corporate slop, complex, boring, flat or uninspiring. Cadence's sanctuary, but the room is also a studio: every surface wears an **audio-engineering cameo** or a **musical gimmick** (§6). A plain box with text in it is unfinished.
- No sterile SaaS styling: no white cards, harsh borders, file-manager grids or gray tables. Glass, mist, soft moonlit edges and breathing room; readability and usable controls take precedence over effects, and a cameo never adds a decision. Never hardcode a hex in a component: add a semantic token to `styles/app.css`.
- Musician words, never storage words (track, version, master, current; never asset, revision, active). One name per concept across the app.
- **The URL says where you are.** Anything that changes what's on screen (a page, a part, search, filter, sort, view, an open dialog or Settings) is a path or a search param, so a refresh, Back or a pasted link lands in the same place. Validate params in the route's `validateSearch`; leave defaults out. Writes stay POST server functions and never ride a link; their result lands in the URL (Save goes to the new release). Only things a URL can't hold stay in memory: picked files, a half-typed form.
- Toasts answer "where did it go?" Something that lands in place in view gets none.

## 2. Tech Stack

React 19 · TanStack Start + TanStack Router (file routes, SPA mode) · Tailwind CSS v4 (tokens in `styles/app.css`) + `tw-animate-css` · Radix UI (wrapped) · Framer Motion (sheets and springs) · Lucide icons · `cn` (`clsx` + `tailwind-merge`, `lib/utils.ts`) · Sora + Outfit via `@fontsource-variable`, system mono for readouts · TypeScript.

## 3. Runtime Shape

- `routes/__root.tsx`: the HTML shell (fonts, `APPEARANCE_BOOT` in the head so the theme lands before first paint, `suppressHydrationWarning` on `<html>` for it), root `validateSearch` for `?settings=`, `component: AppShell`, `notFoundComponent: NotFound`.
- `router.tsx`: preloads on intent, restores scroll. `routeTree.gen.ts` is generated; never edit it.
- `layout/AppShell` wraps everything in `MotionConfig` (reduced motion from Settings or the OS), shows `IconRail` or `PhoneDock`, the page `Outlet`, and `SettingsDialog`.
- The app version reaches the UI as `__APP_VERSION__` (`globals.d.ts`), defined from `package.json` in `vite.config.ts`.

## 4. Routes (`routes/`)

`/` redirects to `/upcoming`. Two sections, same shape: `/upcoming` and `/releases`, each with a release at `/<section>/$releaseId` (its Summary) and its parts under it: `/details`, `/artwork`, `/tracks`, `/tracks/$trackId`. The `$releaseId` layout route loads the release once (tracks, every version, current pins) and its parts read it with `getRouteApi`. Plus `/trash`. Settings is not a route: it opens over any page from `?settings=<tab>`. `routes/api/` holds server routes (file bytes); they render nothing and their logic lives in `server/`.

- Routes are thin: read params and search, call a loader from `components/releases/loaders.ts`, render a shared page. Business logic never lives in a route file.
- A release is Upcoming until `released_at` is stamped, then it's under Releases (`components/releases/sections.ts`: `sectionOf`, `releaseLink`, `trackLink`). A loader redirects a link from the wrong section, and a single's track URL to its Tracks part, because a single's release is its one track. A track under the wrong release is not found.

## 5. Source Layout

```text
src/
├── routes/          # File routes, thin. routeTree.gen.ts is generated.
├── components/
│   ├── primitives/  # Building blocks ported from Cadence (Button, Dialog, SearchField…). Domain code imports these, never raw libraries.
│   ├── layout/      # AppShell, IconRail, PhoneDock, Page, NavigationRow, NotFound
│   ├── shared/      # Used by more than one domain (EmptyState, MetaLine, UtilitySheet, ResponsiveOverlayPanel)
│   ├── releases/    # Section helpers, loaders, browse (search/filter/sort), stacks, ReleaseArt, ArtworkButton, ReleaseList, ReleaseLayout and its parts
│   ├── uploads/     # NewReleaseDialog, DropOverlay, suggest (reads a filename as title and stack)
│   ├── settings/    # SettingsDialog, SettingsSheet, tabs/, rows
│   └── <domain>/    # player… created when the first file needs it
├── hooks/ui/        # use-shell-mode, use-appearance, use-file-drop, use-sheet-gesture, use-keyboard-inset, use-lens-scrub…
├── lib/             # nav.ts (the one list of destinations), files.ts (the only file transfers), time.ts (the only date conversion), utils.ts, constants/motion.ts
├── styles/app.css   # Design tokens and utilities: the design source of truth
└── server/          # Worker side: see server/AGENTS.md
```

## 6. Design System (ported from Cadence)

- **Token names:** `room-*` (grounds and surfaces: `bg-room-surface`) · `ink`, `ink-soft`, `ink-muted` (text) · `line`, `line-light`, `line-strong` (borders) · `accent`, `accent-soft`, `accent-dim`, `accent-secondary`, `accent-tertiary` (the active palette; never the named `signal`/`tube`/`haze` directly) · `phantom` (the rare accent, below) · `on-accent` (text on a solid accent) · `panel`, `panel-raised` · `bg-atmosphere` (the page background) · `glow-accent` · `preview-*` (the theme cards' miniatures).
- **Porting from Cadence:** copy the file, then run `sed -i -E -f scripts/cadence-names.sed <files>` on it (and on any CSS you bring), which maps Cadence's names (`twilight-*`, `accent-primary`, `glow-lantern`, `data-cadence-*`…) to Mixlog's; then grep the file for `twilight|lantern|cadence` and map anything the script doesn't know, adding the rule to the script. Keep relative imports (`../../lib/utils`, `../../hooks/ui/…`), since the layout mirrors Cadence's; bring its CSS utilities and hooks with it; swap React Router APIs for TanStack Router ones (`useNavigate`, `Link`, `useSearch`).
- **Phantom, the unexpected accent** (`text-phantom`, `to-phantom`, `phantom-spark`; +48V magenta, `#ff6bd6` / `#a3127a`). Rare is the point: the brand mark's peak, plus **at most one** Phantom moment per screen (the flat trace's dot on Not found; later the newest bounce landing, the playhead's spark). Never a fill, a control, a feedback colour, the only carrier of meaning, or palette-responsive. Passing `phantom` to `Led`, `Meter` or `Scope` spends that screen's one moment; when in doubt, Signal.
- **Cameos and gimmicks** (the room is a studio; `styles/app.css` "SIGNAL GIMMICKS"). Reach for these before inventing a new one, and pick the one a real studio would use for the job:
  - `primitives/Meter`: EQ bars, still at rest, dancing while `live` or while a `[data-meter-host]` ancestor is hovered. The brand mark (`peak` lights its tip in Phantom); later, whatever is playing.
  - `primitives/Scope`: an oscilloscope screen; `flat` is *no signal*. Tops every `EmptyState`.
  - `primitives/Led`: a console light, `accent` / `tube` / `phantom`, optionally `breathe`. The current destination in the rail and dock; later, upload and on-device state (with words beside it).
  - `readout`: mono, tracked, uppercase, tabular lettering for version numbers, formats, timecodes, track numbers and eyebrows (`EmptyState`'s `readout`: *Ch 01 · −∞ dB*). Still musician words.
  - `signal-rule` (page header hairline), `playhead-sweep` (rows you point at), the graticule behind `bg-atmosphere`, `glass-edge` on hero cards.
- **Ported so far:** primitives `Button`, `Input`, `Switch`, `Tooltip`/`Tip`, `ScrollArea` (+ `menu-styles`), `DropdownMenu`, `SegmentedControl` (its lens glides and scrubs), `Dialog` (+ `dialog-styles`; a docked sheet on a touch phone), `SearchField`; `shared/UtilitySheet` over `shared/ResponsiveOverlayPanel` (every compact sheet); `layout/NavigationRow`; hooks `use-shell-mode`, `use-sheet-gesture`, `use-keyboard-inset`, `use-lens-scrub`, `use-opening-release-guard`; `lib/constants/motion.ts` (`SPRINGS`); `settings/SettingsLayout` + `SettingRows`. `ContextMenu` and `Select` come next.
- **Surface ladder,** top to bottom: `bg-atmosphere` (ground) → `surface-deck` → `surface-shell` → `surface-card` → `surface-item` → `surface-row` → `surface-control` → floating (`surface-dialog`, `surface-floating`). Tints are tuned per mode only in `app.css`, never per component.
- **Modes:** Daylight is `data-theme="daylight"` on `<html>`, reduced motion `data-motion="reduced"`; every surface must work in both themes and with reduced motion. Z-index only through `.layer-*`.
- **Layout and input** come from `useShellMode()` only (`isDesktop`: wide and laptop; `isCompact`: tablet and phone; `isTouch`), never raw breakpoints, `matchMedia` or `innerWidth` in components. A bottom sheet is touch-only.
- **Motion** comes in two kinds. *State motion* explains what opened, moved or changed: springs from `SPRINGS`, sheets and menus a fast CSS ease-out. *Ambient motion* is the room alive (meters, scope pulse, LED breathe, playhead sweep): CSS keyframes in `app.css`, slow, decorative, never meaning-bearing, never delaying an action, and every loop's resting frame is a good still (the global reduced-motion rule lands on it). Flourishes are musical, never generic: no confetti, no rewards.
- **Access:** hit targets ≥ 44×44px on touch; icon-only controls need `aria-label` + `Tip`; never `outline-none` without a replacement; never state through colour or motion alone. One meaning, one Lucide icon on every surface (Upcoming `CalendarClock`, Releases `Disc3`, Trash `Trash2`, Settings `Settings`); the brand mark is `Meter peak`, not an icon. Every cameo is `aria-hidden`; what it shows is also said in text or `aria-*`.

## 7. Shell and Pages

- `IconRail` on desktop (icons; expanded with labels, kept per device in `mixlog.rail.expanded`) and `PhoneDock` on compact. Both read `lib/nav.ts`, the one list of destinations: Upcoming, Releases, Trash; Settings sits with them as `SETTINGS_ENTRY` but opens over the page. Nothing else lists destinations.
- Every page is `layout/Page`: `title` plus `crumbs` (the pages above it, never itself; desktop shows the trail, compact only the way back up): Upcoming › Blue Hour EP › Track. `lead` sits before the title (a release's cover), `meta` under it (its `MetaLine`).
- **Upcoming and Releases always have two forms, List and Panels** (`releases/ReleaseList`), and always search (title, every word), filter (format) and sort above them. Search, format, sort, view and the open Upload dialog are all in the URL (`?q=&format=&sort=&view=&upload`, `listSearch` in `browse.ts`), so a refresh, Back or a link keeps them; defaults are left out. The logic is `releases/browse.ts`, pure and unit-tested.
  - **Every release wears its cover** (`ReleaseArt`): its current artwork, or a monogram pressed from the title's first letter in the title's own hue. On a row it sits before the title like a streaming app's track row; on its own page it's the header's `lead` (`ArtworkButton`). **One artwork per release, and only through its cover:** click the cover, or drop a PNG or JPG right on it (`releases/use-cover-drop`, on the release page and in the new-release dialog); a new one replaces the old. An image dropped anywhere else is left out with the reason.
  - **The date** is the day it was started in Upcoming and the day it went out in Releases (`releaseDay`, `dateLabel`, through `lib/time.ts` in the device's zone): *Started Oct 12*, *Released Oct 12*. Never a clock time.
  - **Facts** follow in a `MetaLine`, split by lit dots: date · format · tracks · length (the current masters added up). An unknown fact is left out, never shown as zero.
  - **Both take music.** Files dropped anywhere on the page (`use-file-drop`; the `DropOverlay` arms the input, the screen's Phantom moment) or picked from **Upload** open `uploads/NewReleaseDialog`: a new release on Upcoming, one already out on Releases (it also asks the day it went out, today by default). Dropping never saves: images are left out (artwork goes on the cover), the filenames suggest the title, format (one song a single, two to four an EP, five or more an album) and each bounce's stack (`uploads/suggest.ts`), shown and correctable, and only **Save** creates the release, then sends the artwork and bounces one at a time with a light and words per file. A single's files are versions of its one track; on an EP or album, files with the same title are one track. A failure keeps what made it and **Try again** sends only the rest.
  - **List** is one card of rows: cover, title, facts, chevron. **Panels** is a grid of cards: the cover large, title and date, then a grid of icon tiles (format, tracks, length). Each fact is said once per form.
- **Inside a release** (`releases/ReleaseLayout`): its header (cover, title, facts; the Summary drops the facts because it says them itself), and its parts. With room (`isDesktop`) they're a panel beside the page; without, a strip of tabs under the header. The list pages never show it, and it never lists other releases.
  - **Summary** (`ReleaseSummary`): the release as its own place, never a dashboard: a sky in its own hue (`.release-sky`, the artwork blurred behind it) with its facts as instruments and a horizon trace; the **signal path** (bounces → masters → finals → artwork → details, each lit or quietly waiting, each a link to its part); the **tracklist** like the back of a record.
  - **Details** (`ReleaseDetailsForm`, saved together on Save with `updateRelease`): Upcoming asks title, format and a planned day; Releases adds the release day, UPC and each track's ISRC. Optional but the title and a release's day.
  - **Artwork & Canvas** (`ReleaseArtwork`): the cover large (click or drop, one per release), and the places held for Canvas and other material.
  - **Tracks** (`ReleaseTracks`): each track's log, every stack newest first, its current version lit, a final (lossless) or a test, what shipped stamped. A single's log is the whole part; an EP's track opens on its own (`/tracks/$trackId`).
  - **Move to Releases** sits at the panel's foot in Upcoming (the header on compact). Not built yet: it says so on hover and does nothing.
- Empty is normal: an empty section is `shared/EmptyState` (a scope, a `readout`, a title, one next step), never an error. Pass `flat` when there's no signal yet.

## 8. Settings

- Opens over any page from `?settings=<tab>` (`settings/use-settings-param.ts`: opening pushes, switching tabs replaces, so Back closes it). `SettingsDialog` on desktop (searchable categories; each category's `keywords` are its row titles, kept in step with the tab; `menu` maps to the first tab), `SettingsSheet` on compact (`menu` lists categories, a tab drills in, Sign out at the foot).
- Tabs live in `settings/tabs/`, registered in `SettingsContent.tsx`; each setting has one home.
- Appearance (theme, reduced motion) is per device: `hooks/ui/use-appearance.ts` (`mixlog.theme`, `mixlog.motion`), applied to `<html>` before first paint by `APPEARANCE_BOOT`. Sign out is Access's `/cdn-cgi/access/logout` (`SIGN_OUT_URL` in `tabs/AboutTab.tsx`).
- Browser storage holds per-device conveniences only, every read and write in `try`/`catch`; anything that must survive goes through the server.

## 9. Commands

```bash
pnpm dev | typecheck | test:unit | build | preview
```

Typecheck at minimum after changes. UI changes are checked in the running app on desktop and phone widths, in both themes.

## 10. Anti-Patterns

Hardcoded hex in components · a date parsed, sliced or formatted outside `lib/time.ts`, or a clock time on screen · Phantom twice on one screen, on a control or fill, or as feedback · a flat surface with no cameo or atmosphere · ambient motion that carries meaning, delays an action, or has an ugly resting frame · generic celebration (confetti, success fanfare) · raw `@radix-ui/*` in domain components · raw `fetch` to the Worker · `cloudflare:workers` or `server/` internals imported outside server functions · business logic in route files · breakpoints or `matchMedia` outside `useShellMode` · a second list of destinations · a page as its own crumb · a success toast for something visible in place · storage words in the UI · generic SaaS panels and tables · view state (a filter, sort, tab or open dialog) in `useState` or `localStorage` instead of the URL · editing `routeTree.gen.ts`.

## 11. Checklist

- Build: owning domain → ease check (fewer decisions, less to scan, nothing twice, no capability lost) → thin route + shared page → primitives and semantic tokens → which instrument is this? (a cameo from §6; Phantom only if the screen hasn't spent it) → server function for data.
- Review the changed flow: one obvious next step (on a track, Play); keyboard and touch access; Back and Escape behave; empty, pending and error states; daylight and reduced motion; the tone check (striking, techy, musical, not flat or corporate).
- Verify with `pnpm typecheck` and the running app. Browser resizing proves layout only, not a real phone.

If this document conflicts with a proposed change, this document is the baseline.
