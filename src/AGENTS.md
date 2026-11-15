# Mixlog Frontend — Agent Instructions

The app the browser runs: TanStack Start in SPA mode (`defaultSsr: false`, intentional), served by the same Worker as [`server/`](server/AGENTS.md) and reaching data only through its server functions. It embodies the **Blue Hour** design language, a sibling of Cadence's Twilight Sanctuary. Functional correctness and aesthetic integrity are equally non-negotiable. Everything in `src/` except `server/` follows this guide.

## 1. Non-Negotiables

### Architecture

- Client-rendered SPA, no SSR assumptions: loaders run in the browser, and `AppShell` sits inside `ClientOnly`.
- Data comes from server functions in `server/`, called from route loaders or components. File bytes are the one exception: they go through the `/api` routes, and only `lib/files.ts` talks to them (uploads use XHR because only XHR reports progress). Never import `cloudflare:workers` here.
- Placement: hooks → `hooks/`; non-UI logic → `lib/` (client-safe, no server imports); shared UI → `components/` by domain. Radix only through `components/primitives/`.
- **The URL says where you are.** Anything that changes what's on screen (page, part, search, filter, sort, view, open dialog, Settings) is a path or search param, so refresh, Back or a pasted link lands in the same place.
  - Validate params in the route's `validateSearch`; leave defaults out.
  - Writes stay POST server functions and never ride a link; their result lands in the URL (Save goes to the new release).
  - Only what a URL can't hold stays in memory: picked files, a half-typed form.

### Words and feedback

- Musician words, never storage words (track, version, master, current; never asset, revision, active). An artist is *on* a track, main or featured, never "billed". One name per concept.
- Toasts answer "where did it go?" Something that lands in place in view gets none. Use only `primitives/Toaster`'s `toast` (mounted once in `AppShell`, styled by app.css "TOASTS").

### Tone and look

- **Tone:** fantasy, inspirational, techy, futuristic, visually striking, animated, design- and icon-heavy. Never corporate, complex, boring, flat or uninspiring. The room is a studio: every surface wears an **audio-engineering cameo** or a **musical gimmick** (§6). A plain box with text in it is unfinished.
- No sterile SaaS styling: no white cards, harsh borders, file-manager grids or gray tables. Use glass, mist, soft moonlit edges and breathing room. Readability and usable controls outrank effects, and a cameo never adds a decision.
- Never hardcode a hex in a component: add a semantic token to `styles/app.css`.

### The eight principles

Apple's [design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles), read for Mixlog. Walk all eight before designing or changing a page.

| Principle | In Mixlog |
|---|---|
| **Purpose** | The page hears the right version or ships it, and its main control is that. |
| **Agency** | Play is one tap from wherever a version shows; nothing forced; everything undoes. |
| **Responsibility** | Say what happens to the files before it happens. |
| **Familiarity** | A row reads like a streaming app's (play, title, length). The same thing looks and acts the same everywhere. |
| **Flexibility** | Thumb, keyboard and screen reader; phone and wide. |
| **Simplicity** | Each fact once; icons and readouts over sentences; most important first, left to right, top to bottom; detail one layer down. |
| **Craft** | Aligned columns, tabular figures, both themes, reduced motion, seen in the running app. |
| **Delight** | Certainty, then wonder that stays out of the music's way. |

## 2. Tech Stack

React 19 · TanStack Start + Router (file routes) · Tailwind CSS v4 (tokens in `styles/app.css`) · Radix UI and Sonner (both wrapped) · Framer Motion · Lucide icons · `cn` (`lib/utils.ts`) · Sora + Outfit, system mono for readouts · TypeScript.

## 3. Runtime Shape

- `routes/__root.tsx` is the HTML shell. `APPEARANCE_BOOT` in the head sets the theme before first paint (hence `suppressHydrationWarning` on `<html>`). Root `validateSearch` owns `?settings=`, `?listen` and the room's `&b=` and `&pick=`.
- `router.tsx` preloads on intent, restores scroll, and shows one pending page after 200ms (`releases/Pending`'s `PagePending`). `routeTree.gen.ts` is generated; never edit it.
- `layout/AppShell` wraps everything in `MotionConfig` (reduced motion from Settings or the OS) and renders `IconRail` or `PhoneDock`, the page `Outlet` and `SettingsDialog`. Beside it, `layout/Boot` (in the shell HTML, CSS only: sparse stars, a valley with amp tubes at its edges, the mark drawing in and out) stays over the shell until the first page's loader settles or 1.6s from navigation start, then flies into the valley (each depth grows from the crest, nearer ones more) as it fades.
- The app version reaches the UI as `__APP_VERSION__` (`globals.d.ts`), defined from `package.json`.

## 4. Routes (`routes/`)

`/` redirects to `/upcoming`. `/upcoming` and `/releases` share one shape: a release at `/<section>/$releaseId` (its Summary) and its parts under it (`/details`, `/artwork`, `/tracks`, `/tracks/$trackId`). Also `/artists` (and `/artists/$artistId`) and `/trash`. Settings is not a route: it opens over any page from `?settings=<tab>`. `routes/api/` holds server routes (file bytes); they render nothing and their logic lives in `server/`.

- Routes are thin: read params and search, call a loader from `components/releases/loaders.ts`, render a shared page. No business logic in route files.
- The `$releaseId` layout route loads the release once (tracks, every version, current pins); its parts read it with `getRouteApi`.
- A release is Upcoming until `released_at` is stamped, then Releases (`releases/sections.ts`: `sectionOf`, `releaseLink`, `trackLink`). A loader redirects a link from the wrong section, and a single's track URL to its Tracks part (a single's release is its one track). A track under the wrong release is not found.

## 5. Source Layout

```text
src/
├── routes/          # File routes, thin
├── components/
│   ├── primitives/  # Cadence-ported building blocks; domain code imports these, never raw libraries
│   ├── layout/      # AppShell, IconRail, PhoneDock, Page, NotFound
│   ├── shared/      # Used by more than one domain (EmptyState, MetaLine, UtilitySheet, Composer, Picker, Viewer)
│   ├── releases/    # Release list, layout and parts; loaders, browse, stacks
│   ├── artists/     # Artist list, editor, picker
│   ├── uploads/     # New-release and upload dialogs, filename suggestions, upload queue
│   ├── settings/    # Dialog, sheet, tabs/
│   ├── player/      # The player's two <audio> (A/B), bars, listening room, LoudnessWave
│   ├── meters/      # A version's meters (bridge and wide panel)
│   ├── scene/       # A song's own night: generate (pure data), palette, Sky, Land
│   └── <domain>/    # created when the first file needs it
├── hooks/           # ui/ (shell mode, appearance, drop, sheets…), releases/
├── lib/             # nav.ts (the one list of destinations), files.ts (the only file transfers), meter.ts (+ worker), time.ts (the only date conversion), utils.ts, constants/motion.ts
├── styles/app.css   # Design tokens and utilities: the design source of truth
└── server/          # Worker side: see server/AGENTS.md
```

## 6. Design System (ported from Cadence)

### The feel

One glance and nothing is off. Every change honours all of these:

- **Optimistic, always (Doherty).** What the artist changes shows changed on the same frame (`useOptimistic` or local state); the server call runs behind it.
  - Never await `router.invalidate()` before the screen moves. On failure, put it back and say why in place (Settings › Releases' keep window is the model).
  - Wait only for what can't be known first (file bytes, the meter measuring, a move between Upcoming and Releases), and even then the control answers within 100ms (`Tuning` or `Transfer`, in words). Nothing goes past 400ms without an answer.
- **Interruptible.** Anything moving can be grabbed or reversed mid-flight and carries on from where it is on screen.
  - State uses framer springs or CSS transitions, not `@keyframes` (Radix's short open/close keyframes are fine).
  - A gesture hands its release velocity to the spring that finishes it. Nothing locks input while it moves.
- **Snappy, still fluid.** State motion ≤ 300ms: press 100–160, tips 125–200, menus 150–250, sheets and dialogs ≤ 300 in and faster out.
  - Springs are critically damped unless a flick carried momentum (then bounce ≤ 0.15; none on hover).
  - No instant jump where something moved, no tail to wait out. Keyboard actions don't animate.
- **Solid, not flat.** One light from above, set per mode in `app.css`: pressable things carry a top highlight and an under-shade; wells sink. Rows, text and ghost buttons stay flat; no stacked shadows.
- **Optical, not mathematical.** Align what the eye sees: play triangles nudged to their centre, round icons a touch larger than square ones, readouts on the text's cap height. Check screenshots at both sizes, in both themes.
- **Fitts.** Frequent targets big and close: ≥ 44×44px on touch, ≥ 36px for a fine pointer. A hit area grows past its shape (a row plays from anywhere but its own buttons). Primary actions within thumb's reach; destructive ones away from frequent ones.
- **Miller.** About seven things at once; chunk the rest: lanes fold to their newest three, long lists group, long numbers read in groups (UPC, ISRC).
- **Postel.** Accept what's typed or pasted (spaces, hyphens, case, accents, a loosely written date), normalise it, and show back what was understood. Only output is strict.
- **Jakob.** What music apps and DAWs taught people works the same here: a row plays on tap, Space plays and pauses, the full player swipes down. The look is Mixlog's own; the gestures and shortcuts are borrowed.

### Shape and surfaces

- **Corners.** `corner-shape: superellipse(1.5)` (top of `app.css`, inside `@supports`; unsupported browsers get a plain arc) on every `rounded-*` except `rounded-full`, `rounded-none` and `rounded-[inherit]`. It is Apple's continuous corner, softened: the full squircle (`2`) reads sharp at the same radius. Pseudo-elements and `rounded-[inherit]` children inherit it, so edges, glows and sweeps trace their host.
  - **Concentric, always:** a child's radius = its parent's radius − the padding between them. 24px card + `p-3` → `rounded-xl`; 32px card + `p-4` → `rounded-2xl`; 12px control + 3px (padding and border) → `rounded-[9px]`.
  - Where padding changes at `sm:`, the inner radius changes with it.
  - A cover or image that fills its container takes `rounded-[inherit]`.
  - Controls side by side share one height and radius (44px, `rounded-xl`); a lens or item inside fills its track exactly.
- **Surface ladder,** top to bottom: `bg-atmosphere` (ground) → `surface-deck` → `surface-shell` → `surface-card` → `surface-item` → `surface-row` → `surface-control` → floating (`surface-dialog`, `surface-floating`). Tints are tuned per mode only in `app.css`, never per component.
- **Tokens:** `room-*` (grounds and surfaces) · `ink`, `ink-soft`, `ink-muted` (text) · `line`, `line-light`, `line-strong` (borders) · `accent`, `accent-soft`, `accent-dim`, `accent-secondary`, `accent-tertiary` (the active palette; never the named `signal`/`tube`/`haze`) · `phantom` · `on-accent` · `panel`, `panel-raised` · `glow-accent`.

### Motion

Apple's Liquid Glass feel (glass that answers a hand with a soft spring, light that follows the pointer, nothing stiff or showy), built by Emil Kowalski's rules: ease-out, transforms and opacity only, hover only on a fine pointer, leaving faster than arriving. Timing and interruption are under *The feel*. Two kinds, never confused:

- **State motion** explains what opened, moved or changed: springs from `SPRINGS` (`lib/constants/motion.ts`); sheets and menus a fast CSS ease-out.
  - What follows the pointer is a short, strong ease-out tween, never a spring (`TWEENS.FOLLOW`, 200ms).
  - A list's hover is one light that glides to the row you point at (`useHoverSlide`), never a background per row.
  - A card you point at is glass (`.glass-card`): it rises on `--spring-liquid`, leans from the pointer, and its cover drifts forward.
- **Ambient motion** is the room alive (meters, scope pulse, LED breathe, playhead sweep).
  - CSS keyframes in `app.css` on `transform`/`translate`/`opacity` of an HTML box. Chrome composites those only there; on an `<svg>` they repaint every frame, so a scene's moving parts are HTML over its SVG.
  - Slow, decorative, never meaning-bearing, never delaying an action. Every loop's resting frame is a good still (reduced motion lands on it).
- Flourishes are musical, never generic: no confetti, no rewards.

### Cameos and gimmicks

The room is a studio (`app.css` "SIGNAL GIMMICKS"). Reach for these before inventing one, and pick what a real studio would use for the job.

- **`primitives/Meter`:** EQ bars, still at rest, dancing while `live` or while a `[data-meter-host]` ancestor is hovered. Use it for whatever is playing.
  - **The signal** (`player/signal.ts`) runs on desktop only (no touch points: Web Audio routing can silence iPhone and iPad playback, and can't be undone). An `AnalyserNode` taps the player's two `<audio>`, each through its own gain (A/B's audible side and trim), and writes `--level-0…4`, `--bass`, `--kick` and `data-live` on every `[data-signal]` element each frame, with no re-render. A host as large as the room is `data-signal="readers"`: it takes `data-live`, and the levels go only to its `[data-signal-read]` elements (set on the host, they'd restyle every star and hill under it each frame); the playhead clock hands `LoudnessWave`'s to its `[data-playhead-read]` layers the same way. Off under reduced motion, from the next frame; when off, everything keeps its own dance.
- **`primitives/Scope`:** an oscilloscope screen; `flat` is *no signal*. Tops every `EmptyState`.
- **`primitives/Led`:** a console light, `accent` / `tube` / `phantom`, optionally `breathe`. For the current destination, an upload waiting its turn, a saving state, a track's final.
- **Waiting** has three instruments, never a stock spinner or pulse:
  - `Tuning`: the studio works without a file moving (a page, a save, a move).
  - `Transfer` (`up` or `down`): file bytes (every upload, a license being read, Play while the file arrives).
  - `Skeleton`: where the shape is known (pending pages, a cover until its artwork loads, PDF pages).
- **The meters** (`meters/MeterBridge`, `player/LoudnessWave`): a version's loudness as capsule bars on one fixed amplitude scale everywhere (`player/wave.ts`), then three folds: **Readings** (open), **Penalty** (open; platform logos from `simple-icons` in ink, never brand colour) and **More** (folded). A change since the version before reads in Haze, never green or red; true peak over −1 dBTP lights Tube. Tokens `--wave-*`, `--meter-*`.
- **`readout`:** mono, tracked, uppercase, tabular lettering for version numbers, formats, timecodes, track numbers and eyebrows (*Ch 01 · −∞ dB*). Still musician words.
- **Page furniture:** `signal-rule` (header hairline), `playhead-sweep` (rows you point at), the graticule behind `bg-atmosphere`, `glass-edge` on hero cards.

### Phantom and the brand mark

- **Phantom** (`text-phantom`, `to-phantom`, `phantom-spark`; +48V magenta): the unexpected accent. Rare is the point: the brand mark's held note, plus **at most one** Phantom moment per screen (the flat trace's dot on Not found; the newest bounce landing, its LED lit once).
  - Never a fill, a control, a feedback colour, the only carrier of meaning, or palette-responsive.
  - Passing `phantom` to `Led`, `Meter` or `Scope` spends that screen's one moment. When in doubt, Signal.
- **The brand mark** (`primitives/BrandMark`; assets in `public/brand/`): five bars (*Mix·log* said aloud) under a Phantom whole note held by a hand-drawn fermata. Coloured by role, never one sweep: bars Signal → Haze, fermata Rose → **Ember** (the mark's only use of `ember`), the note the lamp. Re-render the PNGs and `public/favicon.ico` when it changes.

### Modes, layout and access

- **Modes:** Daylight is `data-theme="daylight"` on `<html>`; reduced motion is `data-motion="reduced"` (Settings or the OS), which keeps colour and opacity transitions. Every surface works in both themes and with reduced motion. Z-index only through `.layer-*`.
- **Layout and input** come from `useShellMode()` only (`isDesktop`: wide and laptop; `isCompact`: tablet and phone; `isTouch`), never raw breakpoints, `matchMedia` or `innerWidth`. A bottom sheet is touch-only.
- **Access:**
  - Hit targets per *Fitts*. Icon-only controls need `aria-label` + `Tip`.
  - Focus is `outline-hidden` plus a ring (forced colours paint the outline); never `outline-hidden` without a replacement.
  - A tip that carries a fact is a toggletip (`Tip toggle`, a `<button>`).
  - Never state through colour or motion alone. Every cameo is `aria-hidden`, and what it shows is also said in text or `aria-*`.
  - One meaning, one Lucide icon on every surface (Upcoming `CalendarClock`, Releases `Disc3`, Trash `Trash2`, Settings `Settings`, compare A/B `SquareSplitHorizontal`, change a side `ChevronsUpDown`). The brand mark is `BrandMark`, not an icon.

### Shared surfaces and porting

- Every compact sheet is `shared/UtilitySheet`. Every dialog that makes or does something is `shared/Composer` (dialog on desktop, that sheet on compact); a new one goes through it, with its settings in `ComposerRows`. Pick one thing from a searchable, grouped list through `shared/Picker` (a Composer with a listbox; ↑ ↓ Enter, no submit; `releases/VersionPicker` is its first use): a group can carry an icon, a count, a section heading and a lit lane rule, as a lane does on Tracks; its rows share one `useHoverSlide` light (the pointer's and ↑ ↓'s) and `playhead-sweep`; `tone` gives it a release's light. Anything looked at full size (a license, a cover, a picture) is `shared/Viewer`: a framed panel over the page wider, the Photos viewer on a phone (edge to edge under floating glass, the title dead centre), its tools in a `ViewerBar` with `useZoom` (−/+, ⌘/Ctrl −, + and 0, a trackpad pinch).
- **Porting from Cadence:** copy the file, then run `sed -i -E -f scripts/cadence-names.sed <files>` on it (and on any CSS you bring). Then grep it for `twilight|lantern|cadence`, map anything the script doesn't know, and add the rule to the script.
  - Keep relative imports; bring its CSS utilities and hooks with it.
  - Swap React Router APIs for TanStack Router ones (`useNavigate`, `Link`, `useSearch`).

## 7. Shell and Pages

### Shell

- `IconRail` on desktop and `PhoneDock` on compact (Cadence's floating glass dock with a gliding lens tab that scrubs under the finger; the mini player rides on top; scrolling down tucks it, `use-dock-tucked`). Both read `lib/nav.ts`, the one list of destinations: Upcoming, Releases, Artists, Trash. Settings sits with them as `SETTINGS_ENTRY` but opens over the page. Nothing else lists destinations.
- Under `pnpm dev` only, the rail adds a Developer menu (`server/dev.ts`); a build drops it.
- Every route sets its `<title>` through `head` (`Name · Mixlog`), and a new path lands focus on the page's `h1`.
- A page with unsaved changes asks before another page replaces it (`shared/LeaveGuard`'s `useLeaveGuard`; a search change passes), and the browser asks before the tab closes.
- Every page is `layout/Page`: `title` plus `crumbs` (the pages above it, never itself; compact shows only the way back up). `lead` sits before the title (a release's cover), `meta` under it (its `MetaLine`).
- Empty is normal: an empty section is `shared/EmptyState` (a scope, a `readout`, a title, one next step), never an error. Pass `flat` when there's no signal yet.

### Upcoming and Releases

Both always have two forms, **Panels** (the default) and **List** (`releases/ReleaseList`), and always search (title, every word), filter (format) and sort. All of it is in the URL (`listSearch` in `browse.ts`), with defaults left out. `browse.ts` is pure and unit-tested.

- **Every release wears its cover** (`ReleaseArt`): its current artwork (its small WebP preview; only the Artwork part loads the original), or a monogram of the title's first letter in the title's own hue.
- **One artwork per release, and only through its cover:** click it, or drop a PNG or JPG on it (`use-drop-target`). A new one replaces the old. An image dropped anywhere else is left out, with the reason.
- **The date** is the day it was started in Upcoming and the day it went out in Releases (*Started Oct 12*, *Released Oct 12*), through `lib/time.ts`. Never a clock time.
- **Who it's by:** each main artist's face and name (`listUpcoming`/`listReleased`'s `artists`): its own line under a panel's title (the chips pin to the foot, so a row's panels line up), the line's lead in List.
- **Facts** follow in a `MetaLine`, split by lit dots: date · format · tracks · length. An unknown fact is left out, never shown as zero. Each fact is said once per form.
- **Both take music.** Files dropped anywhere on the page (`DropOverlay`, the screen's Phantom moment) or picked from **Upload** open `uploads/NewReleaseDialog`: a new release on Upcoming, one already out on Releases (it also asks the day it went out).
  - Its **Artist** row starts on Settings' default artist; every track starts with whoever it says (or none).
  - Dropping never saves; only **Save** creates the release, then sends artwork and bounces one at a time with a light and words per file. A failure keeps what made it, and **Try again** sends only the rest.
  - Filenames suggest the title, the format (one song a single, two to four an EP, five or more an album) and each bounce's lane, shown and correctable through the shared `LaneMenu` (`uploads/suggest.ts`). Images are left out (artwork goes on the cover).
  - On Releases every file is its track's final; tests or a second final are left out with the reason.

### Inside a release

`releases/ReleaseLayout` is the release's own room (`.art-room`): the artwork's hue and chroma, read by `scene/palette.ts`, retint the grounds and accent inside, so contrast holds. The rail, dock and player keep Signal (the bar's A | B switch included), except the A/B picker opened from the room, which wears `.art-tone`: the room's accent alone, so A matches the room behind it. List pages never show it, and it never lists other releases.

- With room (`isDesktop`) the parts are a panel beside the page, whose header holds the cover, title and facts, leaving the page's header the way back up and its actions. Without, the page's header holds them and the parts are a strip of tabs under it.
- **The panel's foot** (the header on compact) holds:
  - **Save and exit:** submits Details through its `form` id, then goes to the list. Elsewhere it just goes.
  - **Move to Releases** (Upcoming; `MoveToReleasesDialog`, `?move`): each track's Final lane (the same `Lane` as Tracks, so a missing final is dropped, picked or sent there), the day it went out, and what's kept, set aside and erased, said once before anything moves.
  - **Move back to Upcoming** (Releases, while Settings keeps what didn't ship): brings every set-aside version back.
- **Upload** (`uploads/UploadDialog`, `?upload`): in Upcoming, wherever one track's lanes are the page, the header adds it. It picks the lane (starting on the one bounced into last), then one drop zone handed to the track's own `send`.

#### Summary (`ReleaseSummary`)

The release as its own place, never a dashboard, edge to edge (`Page`'s `bleed`; the scene says the title as the `h1`). Every fact appears once.

- **The night** is the song's own: `scene/generate.ts`'s `sceneOf`, seeded by the first measured bounce's fingerprint, stamped once and never redrawn, every colour from the artwork. `scene/Sky` and `scene/Land` render it.
- **The signal path** floats on glass in the sky (`stationsOf` in `stacks.ts`): mixes → masters → final → artwork → details in Upcoming, without mixes and masters in Releases. Each station is lit or quietly waiting, and links to its part.
- **On the ground**, like a now-playing: the cover, the title, its facts, **Play** (each track's `playOf`: the final, else the newest master, else the newest mix) and a segment per track. For an EP or album, the playable **tracklist** below. A single is its track: Play is all of it.

#### Details (`ReleaseDetailsForm`, saved together with `updateRelease`)

- **Fields:** Upcoming asks title, format and a planned day. Releases adds the release day, UPC and each track's ISRC. Everything is optional except the title and a release's day.
- **Artists** (`artists/ArtistPicker`, `?artists=<trackId>`): chips with Main or Feat.; saved on its own on Done (`setTrackArtists`).
- **Lyrics** (`LyricsPanel`): written in place or in the full-screen room; saved on their own as they're written (`use-lyrics.ts`).
- **Origin:** Original, Cover or Remix, asked once for the release when it has one track. A cover or remix shows its **license** (`LicenseControl`: click or drop a PDF or Word document), read in place at `?license=<versionId>` (a `Viewer`): pages on a desk with paging and zoom, each laid out at its size before it draws.

#### Artwork & Canvas (`ReleaseArtwork`)

- The cover large (click or drop; one per release); its glass corner button opens it full size (`?full`, a `Viewer`) with its pixels measured.
- Each track's **Canvas** (`ReleaseCanvas`): a 9:16 frame looping muted, still with Play under reduced motion. Click or drop an MP4: the next version in Upcoming; in Releases its slot's one file, replaced after a confirm naming both. Its length and shape are measured in the browser and shown beside Spotify's 3–8 s · 9:16, with a Tube LED where it differs. Never refused.

#### Tracks (`ReleaseTracks`)

Each track's lanes, drawn by one set of components in either section (`Lane`, `VersionRow`, `LaneMenu`; the rules are `server/lanes.ts`).

- **Upcoming:** Final (one row, the master the artist filed there; empty, a slot to drop on or click), Masters, Mixes (each folded to its newest three), with a signal trace lit up to the highest lane holding something; then Alternates (one row per kind; they don't move). Each lane's **Add** (or a file dropped on it) sends into that lane, one file at a time, each a pending `UploadRow` until it lands in place.
- **Releases:** one row per slot, no numbers: the final and its alternates, each with Meters and **Replace** (or a file dropped on the row), confirmed on the row naming both files before the old one is erased. A track without a final shows the empty Final slot.
- **A row** reads Play, its number (a mix and a master share one sequence per song), what changed (its note, else its filename), format, the day and time it landed (`formatMoment`), then **Meters**, **Move** and Download. On a phone the number, format and time sit under the name; nothing runs under the buttons.
- **Meters** (`?meters=<versionId>`) dock at the room's right edge on wide, unfolded under the row anywhere narrower, never a sheet.
- **Moving** a mix or master: the menu, a drag onto a lane (native drag and drop, mouse only), or Alt+↑/↓. The move keeps the file and its number; a lane that won't take it dims and says why; focus follows the row and a live region says it.
- A single skips the track heading (the header is its track). An EP or album ends with **Add a track** (`AddTrack`, `?add`).

### The player (`player/`)

Two `<audio>` in the shell (the second is A/B's and has no file until the room splits), so navigating never touches playback; `item` is always what you hear. The bar docks under the pages with a mouse; on touch, `MiniPlayer` rides on the dock, and a tap or swipe up opens the **listening room** (`?listen`): the playing *song's* own night (its track's, not its release's) with a record turning at 33⅓, then what's playing, its `LoudnessWave` as the playhead (the `Scrubber` until it's measured) and the transport.

- **A/B** (Upcoming only; **Compare** in the room's header, `&b=<versionId>`, B prefilled with `partnerOf` what's playing: the bounce before it when it's the newest, else the newest): the room splits, a night and a record each side, each moon in its outer corner (one half mirrored; none on a phone), the side you don't hear veiled with its moon set, and the song's title moves up to the header. The split is the player's: lowering the room keeps it (the URL mirrors it only while the room is open; `useOpenRoom` reopens it as it was), and it ends on Compare, Back out of `&b=`, Stop, or playing another release's version. Switch by pressing a record, the `ABSwitch` (also in `PlayerBar` and `MiniPlayer` while split) or a key (A, B, X, anywhere in the app: one `AuditionProvider` in `AppShell`): it changes on press-down; a tap latches, a hold over 300 ms goes back, a drag past 12 px goes back (`ab.ts`, hold off in Settings). It never switches into silence: a side still loading waits, and switching back or its file failing calls that off. The split ground is one grid (`.room-console`): from 64rem of ground the waves sit either side of the switch, each under its record, narrower they stack. **Sync** runs both decks, the silent one pulled back past 40 ms of drift; off, each keeps its place. **Level match** (off by default) trims the louder side down with `matchOf`, shown in dB on that side. Both are console keys, per device (`use-listening.ts`). **Change** is the chip under each record (the file's own name, `Playable.name`, as the room's and bar's titles carry it; the version and loudness under it) and the badge beside each wave: it opens `VersionPicker` (`&pick=a|b`; closing it is a step back, so Back never reopens it), the release's lanes as on Tracks, each track's newest bounce and the one before it tagged in place; the other side's version swaps the two. Leaving keeps what you hear playing.

### Artists (`artists/`)

Everyone who can be on a track: portraits (the default, no card around the circle) or a list, searched by name or role, all in the URL (`?q=&view=list&add`, `browse.ts`, unit-tested). An artist's page holds their picture (click or drop; one, replaced; its corner button opens it full size at `?full`), name, main role and supporting roles, links (web addresses or emails), and every track they're on, each wearing its release's artwork when there is one.

## 8. Settings

- Opens over any page from `?settings=<tab>` (`use-settings-param.ts`: opening pushes, switching tabs replaces, so Back closes it). `SettingsDialog` on desktop (searchable; each category's `keywords` are its row titles, kept in step with the tab); `SettingsSheet` on compact.
- Tabs live in `settings/tabs/`, registered in `SettingsContent.tsx`; each setting has one home.
- **Releases** holds the default artist on every new track (`saveDefaultArtist`), and keeps what didn't ship for a week, two weeks (default), a month, or forever, each shorter choice saying how many versions it would erase tonight. It lives in the Worker (`getSettings`/`saveKeepDays`), not the device, because the cleanup cron reads it.
- **Listening** (what Level match aims for: the quieter one, streaming's −14 or a custom −32…0 LUFS, typed loosely through `lufsOf`; whether a hold auditions) is per device (`use-listening.ts`, with the room's own Sync and Level match).
- **Appearance** (theme, reduced motion) is per device (`use-appearance.ts`), applied before first paint by `APPEARANCE_BOOT`.
- Browser storage holds per-device conveniences only, every read and write in `try`/`catch`. Anything that must survive goes through the server.

## 9. Commands

```bash
pnpm dev | typecheck | test:unit | build | preview
```

Typecheck at minimum after changes. Check UI changes in the running app at desktop and phone widths, in both themes.

## 10. Anti-Patterns

**Code**

- Hardcoded hex in components.
- Raw `@radix-ui/*` in domain components, or raw `fetch` to the Worker.
- `cloudflare:workers` or `server/` internals outside server functions.
- Business logic in route files; editing `routeTree.gen.ts`.
- Breakpoints or `matchMedia` outside `useShellMode`.
- A date parsed, sliced or formatted outside `lib/time.ts`, or a clock time on screen anywhere but a version's (`formatMoment`).

**Behaviour and motion**

- A change that waits on the server before it shows.
- `@keyframes` for state motion, or state motion over 300ms.
- A drag that hits a hard stop or loses its speed on release.
- Ambient motion that carries meaning, delays an action, or has an ugly resting frame.
- View state (filter, sort, tab, open dialog) in `useState` or `localStorage` instead of the URL.

**Look and words**

- Phantom twice on one screen, on a control or fill, or as feedback.
- A flat surface with no cameo or atmosphere; generic SaaS panels and tables.
- Confetti or fanfare, or a success toast for something visible in place.
- Storage words in the UI.
- A second list of destinations, or a page as its own crumb.

## 11. Checklist

- **Build:** owning domain → the eight principles (§1), one answer each; no capability lost → thin route + shared page → primitives and semantic tokens → which instrument is this? (a cameo from §6; Phantom only if the screen hasn't spent it) → server function for data.
- **Review the changed flow:** one obvious next step (on a track, Play); *The feel* (§6), rule by rule; keyboard and touch access; Back and Escape behave; empty, pending and error states; daylight and reduced motion; the tone check (striking, techy, musical, not flat or corporate).
- **Verify** with `pnpm typecheck` and the running app. Browser resizing proves layout only, not a real phone.

If this document conflicts with a proposed change, this document is the baseline.
