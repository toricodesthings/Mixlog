# Mixlog Frontend — Agent Instructions

Everything in `src/` except `server/`: the SPA the browser runs, in the manifesto's **Blue Hour** language. Functional correctness and aesthetic integrity are equally non-negotiable; this guide is the baseline when a change conflicts with it.

## Skills

- **Required:** `modern-web-guidance` before any HTML, CSS or client JS change. Where a guide conflicts with this file, this file wins: Radix through `primitives/` over native dialogs and popovers, `Tuning`/`Transfer`/`Skeleton` over spinners, `Toaster` for toasts, `useShellMode()` over media and container queries for layout, `lib/time.ts` for dates, no `@keyframes` for state motion.
- `emil-design-eng` and `apple-design` only when brainstorming, designing, or forming layouts and components.

## Architecture

- Client-rendered only (`defaultSsr: false` is intentional; `AppShell` sits in `ClientOnly`). Never import `cloudflare:workers` or `server/` internals outside server functions.
- Data comes from server functions. File bytes are the exception: only `lib/files.ts` talks to the `/api` routes (XHR for uploads, for progress).
- `lib/` is client-safe. One of each: `lib/nav.ts` (destinations; nothing else lists them), `lib/files.ts`, `lib/time.ts`.
- Routes are thin: params, a loader from `components/releases/loaders.ts`, a shared page. Never edit `routeTree.gen.ts`.
- Preloads are reused for 5s, so a write must call `router.invalidate()` (never awaited before the screen moves).
- **The URL says where you are.** Page, part, search, filter, sort, view, open dialog and Settings are path or search params (validated in `validateSearch`, defaults left out). Only what a URL can't hold (picked files, a half-typed form) stays in memory. Writes are POST server functions whose result lands in the URL.
- Browser storage holds per-device conveniences only, every access in `try`/`catch`.
- Layout and input come only from `useShellMode()` (`isDesktop`, `isCompact`, `isTouch`), never breakpoints. Bottom sheets are touch-only. Z-index only through `.layer-*`.

## Words

Musician words, never storage words; an artist is *on* a track (main or featured). Toasts answer "where did it go?": nothing that lands visibly in place gets one.

## The feel

- **Optimistic:** a change shows on the same frame (`useOptimistic` or local state); on failure, put it back and say why in place. Only what can't be known first waits (file bytes, metering, a move between sections), and its control still answers within 100ms (`Tuning` or `Transfer`).
- **Interruptible:** anything moving can be grabbed or reversed and carries on from where it is. State motion uses framer springs (`SPRINGS`, `lib/constants/motion.ts`) or CSS transitions, never `@keyframes` (Radix's open/close excepted); a gesture hands its velocity to the spring. Nothing locks input.
- **Snappy:** state motion ≤ 300ms (press 100–160, tips 125–200, menus 150–250, sheets in ≤ 300 and faster out). Springs critically damped unless a flick carried momentum (bounce ≤ 0.15, never on hover). Keyboard actions don't animate. Pointer-following is a tween (`TWEENS.FOLLOW`), never a spring.
- **Solid, not flat:** one light from above, per mode in `app.css`: pressables get a top highlight and under-shade, wells sink; rows, text and ghost buttons stay flat; no stacked shadows.
- **Optical alignment:** play triangles nudged to centre, round icons a touch larger, readouts on the cap height.
- **Targets:** ≥ 44px on touch, ≥ 36px for a fine pointer; hit areas grow past their shape; destructive actions away from frequent ones.
- **Chunk past ~7:** lanes fold to their newest three; long numbers (UPC, ISRC) read in groups.
- **Accept loosely, output strictly:** normalise what's typed or pasted and show back what was understood.

## Look

- No hardcoded hex: add a semantic token to `styles/app.css`. Use the active-palette tokens (`accent*`), never the named `signal`/`tube`/`haze`. Surface tints are tuned per mode only in `app.css`.
- **Concentric corners:** child radius = parent radius − padding between them (and changes with it at `sm:`); a filling cover takes `rounded-[inherit]`. Side-by-side controls share one height and radius (44px, `rounded-xl`).
- **Every surface wears an instrument.** Reach for the existing ones first (`app.css` "SIGNAL GIMMICKS"): `Meter` for whatever plays, `Scope` (`flat` = no signal) atop every `EmptyState`, `Led`, `readout` lettering, `signal-rule`, `playhead-sweep`, `glass-edge`. Waiting is `Tuning` (work), `Transfer` (bytes) or `Skeleton` (known shape), never a stock spinner.
- Meter deltas read in Haze, never green or red. Platform logos (`simple-icons`) in ink, never brand colour.
- **Phantom:** at most one moment per screen (passing `phantom` to `Led`, `Meter` or `Scope` spends it); never a fill, control or feedback colour. When in doubt, Signal.
- When `BrandMark` changes, re-render `public/brand/` PNGs (180, 192, 512) and `public/favicon.ico`.

## Motion

- Ambient motion is slow, never carries meaning or delays an action, and its resting frame is a good still (reduced motion lands on it).
- Ambient keyframes animate only `transform`/`translate`/`opacity` on HTML boxes, never on `<svg>` (repaints every frame), so a scene's moving parts are HTML over its SVG.
- Per-frame writes (`use-scene-pointer`, `player/signal.ts`) set custom properties only on leaf elements (`[data-signal-read]`, `[data-playhead-read]`), never on a box with SVG inside, and never restart a transition per frame.
- `player/signal.ts` (Web Audio) runs on desktop only: on iPhone and iPad it can silence playback irreversibly.

## Shared surfaces

- Every page is `layout/Page` (`crumbs` never include the page itself), sets `<title>` via `head` (`Name · Mixlog`), and lands focus on its `h1` on a new path. Unsaved changes use `useLeaveGuard`.
- Empty is normal: `shared/EmptyState` (scope, readout, title, one next step), never an error.
- Compact sheets are `shared/UtilitySheet`; dialogs that make or do something are `shared/Composer`; picking from a list is `shared/Picker`; anything viewed full size is `shared/Viewer`. List browse state lives in pure, unit-tested `browse.ts` files.
- Settings tabs live in `settings/tabs/`, registered in `SettingsContent.tsx`; each setting has one home, and the dialog's search `keywords` stay in step with its rows.

## Access

Icon-only controls get `aria-label` + `Tip`; a tip carrying a fact is a toggletip (`Tip toggle`). Focus is `outline-hidden` plus a ring, never without one. Cameos are `aria-hidden` and what they show is also in text or `aria-*`. One meaning, one Lucide icon everywhere.

## Porting from Cadence

Copy the file, run `sed -i -E -f scripts/cadence-names.sed <files>` (on its CSS too), grep for `twilight|lantern|cadence` and add any miss to the script. Keep relative imports, bring its utilities and hooks, swap React Router APIs for TanStack's.

## Before calling it done

Walk the manifesto's eight principles for the page. Check the changed flow in the running app at desktop and phone widths, both themes and reduced motion: one obvious next step (on a track, Play), keyboard and touch, Back and Escape, empty, pending and error states. Resizing a browser proves layout only, not a real phone.
