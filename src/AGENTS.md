# Mixlog Frontend — Agent Instructions

The app the browser runs: TanStack Start in SPA mode (`defaultSsr: false`, intentional), served by the same Worker as the server side ([`server/`](server/AGENTS.md)). It reaches data only through that side's server functions. It embodies the **Blue Hour** design language, a sibling of Cadence's Twilight Sanctuary; functional correctness and aesthetic integrity are equally non-negotiable. Everything in `src/` except `server/` follows this guide.

## 1. Non-Negotiables

- Client-rendered SPA. Do not introduce SSR assumptions: loaders run in the browser, and the shell is browser-only (`AppShell` sits inside `ClientOnly`).
- Data comes from server functions in `server/`, called from route loaders or components. Never raw `fetch` to the Worker, and never import `cloudflare:workers` here.
- Reusable hooks → `hooks/`; non-UI logic → `lib/` (client-safe, no server imports); shared UI → `components/` grouped by domain; Radix always through `components/primitives/`, never imported raw into domain components.
- No sterile SaaS styling: no white cards, harsh borders, file-manager grids or gray tables. Glass, mist, soft moonlit edges and breathing room; readability and usable controls take precedence over effects. Never hardcode a hex in a component: add a semantic token to `styles/app.css`.
- Musician words, never storage words (track, version, master, current; never asset, revision, active). One name per concept across the app.
- Toasts answer "where did it go?" Something that lands in place in view gets none.

## 2. Tech Stack

React 19 · TanStack Start + TanStack Router (file routes, SPA mode) · Tailwind CSS v4 (tokens in `styles/app.css`) + `tw-animate-css` · Radix UI (wrapped) · Framer Motion (sheets and springs) · Lucide icons · `cn` (`clsx` + `tailwind-merge`, `lib/utils.ts`) · Sora + Outfit via `@fontsource-variable` · TypeScript.

## 3. Runtime Shape

- `routes/__root.tsx`: the HTML shell (fonts, `APPEARANCE_BOOT` in the head so the theme lands before first paint, `suppressHydrationWarning` on `<html>` for it), root `validateSearch` for `?settings=`, `component: AppShell`, `notFoundComponent: NotFound`.
- `router.tsx`: preloads on intent, restores scroll. `routeTree.gen.ts` is generated; never edit it.
- `layout/AppShell` wraps everything in `MotionConfig` (reduced motion from Settings or the OS), shows `IconRail` or `PhoneDock`, the page `Outlet`, and `SettingsDialog`.
- The app version reaches the UI as `__APP_VERSION__` (`globals.d.ts`), defined from `package.json` in `vite.config.ts`.

## 4. Routes (`routes/`)

`/` redirects to `/upcoming`. Two sections, same shape: `/upcoming` and `/releases`, each with `/<section>/$releaseId` and `/<section>/$releaseId/$trackId`. Plus `/trash`. Settings is not a route: it opens over any page from `?settings=<tab>`.

- Routes are thin: read params and search, call a loader from `components/releases/loaders.ts`, render a shared page. Business logic never lives in a route file.
- A release is Upcoming until `released_at` is stamped, then it's under Releases (`components/releases/sections.ts`: `sectionOf`, `releaseLink`, `trackLink`). A loader redirects a link from the wrong section, and a single's track URL to its release, because a single's release is its track page. A track under the wrong release is not found.

## 5. Source Layout

```text
src/
├── routes/          # File routes, thin. routeTree.gen.ts is generated.
├── components/
│   ├── primitives/  # Building blocks ported from Cadence (Button, Dialog, SearchField…). Domain code imports these, never raw libraries.
│   ├── layout/      # AppShell, IconRail, PhoneDock, Page, Navigator, NavigationRow, NotFound
│   ├── shared/      # Used by more than one domain (EmptyState, UtilitySheet, ResponsiveOverlayPanel)
│   ├── releases/    # Section helpers, loaders, list/release/track pages
│   ├── settings/    # SettingsDialog, SettingsSheet, tabs/, rows
│   └── <domain>/    # player, uploads… created when the first file needs it
├── hooks/ui/        # use-shell-mode, use-appearance, use-sheet-gesture, use-keyboard-inset
├── lib/             # nav.ts (the one list of destinations), utils.ts, constants/motion.ts
├── styles/app.css   # Design tokens and utilities: the design source of truth
└── server/          # Worker side: see server/AGENTS.md
```

## 6. Design System (ported from Cadence)

- **Token names:** `room-*` (grounds and surfaces: `bg-room-surface`) · `ink`, `ink-soft`, `ink-muted` (text) · `line`, `line-light`, `line-strong` (borders) · `accent`, `accent-soft`, `accent-dim`, `accent-secondary`, `accent-tertiary` (the active palette; never the named `signal`/`tube`/`haze` directly) · `on-accent` (text on a solid accent) · `panel`, `panel-raised` · `bg-atmosphere` (the page background) · `glow-accent` · `preview-*` (the theme cards' miniatures).
- **Porting from Cadence:** copy the file, then run `sed -i -E -f scripts/cadence-names.sed <files>` on it (and on any CSS you bring), which maps Cadence's names (`twilight-*`, `accent-primary`, `glow-lantern`, `data-cadence-*`…) to Mixlog's; then grep the file for `twilight|lantern|cadence` and map anything the script doesn't know, adding the rule to the script. Keep relative imports (`../../lib/utils`, `../../hooks/ui/…`), since the layout mirrors Cadence's; bring its CSS utilities and hooks with it; swap React Router APIs for TanStack Router ones (`useNavigate`, `Link`, `useSearch`).
- **Ported so far:** primitives `Button`, `Input`, `Skeleton`, `Switch`, `ActivityBadge`, `Tooltip`/`Tip`, `Popover`, `ScrollArea` (+ `menu-styles`), `Dialog` (+ `dialog-styles`; a docked sheet on a touch phone), `SearchField`; `shared/UtilitySheet` over `shared/ResponsiveOverlayPanel` (every compact sheet); `layout/NavigationRow`; hooks `use-shell-mode`, `use-sheet-gesture`, `use-keyboard-inset`; `lib/constants/motion.ts` (`SPRINGS`); `settings/SettingsLayout` + `SettingRows`. Menus, `Select` and `SegmentedControl` come next.
- **Surface ladder,** top to bottom: `bg-atmosphere` (ground) → `surface-deck` → `surface-shell` → `surface-card` → `surface-item` → `surface-row` → `surface-control` → floating (`surface-dialog`, `surface-floating`). Tints are tuned per mode only in `app.css`, never per component.
- **Modes:** Daylight is `data-theme="daylight"` on `<html>`, reduced motion `data-motion="reduced"`; every surface must work in both themes and with reduced motion. Z-index only through `.layer-*`.
- **Layout and input** come from `useShellMode()` only (`isDesktop`: wide and laptop; `isCompact`: tablet and phone; `isTouch`), never raw breakpoints, `matchMedia` or `innerWidth` in components. A bottom sheet is touch-only.
- **Motion** explains what opened, moved or changed; springs from `SPRINGS`, sheets and menus a fast CSS ease-out. No celebration, ever.
- **Access:** hit targets ≥ 44×44px on touch; icon-only controls need `aria-label` + `Tip`; never `outline-none` without a replacement; never state through colour or motion alone. One meaning, one Lucide icon on every surface (Upcoming `CalendarClock`, Releases `Disc3`, Trash `Trash2`, Settings `Settings`, the logo `AudioWaveform`).

## 7. Shell and Pages

- `IconRail` on desktop (icons; expanded with labels, kept per device in `mixlog.rail.expanded`) and `PhoneDock` on compact. Both read `lib/nav.ts`, the one list of destinations: Upcoming, Releases, Trash; Settings sits with them as `SETTINGS_ENTRY` but opens over the page. Nothing else lists destinations.
- Every page is `layout/Page`: `title` plus `crumbs` (the pages above it, never itself; desktop shows the trail, compact only the way back up): Upcoming › Blue Hour EP › Track.
- `layout/Navigator` (the section's releases, desktop only) sits beside a release or track, never beside the list page it would repeat (`releases/SectionLayout`).
- Empty is normal: an empty section is `shared/EmptyState` with one next step, never an error.

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

Hardcoded hex in components · raw `@radix-ui/*` in domain components · raw `fetch` to the Worker · `cloudflare:workers` or `server/` internals imported outside server functions · business logic in route files · breakpoints or `matchMedia` outside `useShellMode` · a second list of destinations · a page as its own crumb · a success toast for something visible in place · storage words in the UI · generic SaaS panels and tables · editing `routeTree.gen.ts`.

## 11. Checklist

- Build: owning domain → ease check (fewer decisions, less to scan, nothing twice, no capability lost) → thin route + shared page → primitives and semantic tokens → server function for data.
- Review the changed flow: one obvious next step (on a track, Play); keyboard and touch access; Back and Escape behave; empty, pending and error states; daylight and reduced motion.
- Verify with `pnpm typecheck` and the running app. Browser resizing proves layout only, not a real phone.

If this document conflicts with a proposed change, this document is the baseline.
