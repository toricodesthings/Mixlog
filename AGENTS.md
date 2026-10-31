# Mixlog — Repo Rules for Agents

## Build for certainty

Mixlog is one place for one artist's music in progress: every bounce, master, artwork, Canvas and video, versioned and playable anywhere. Every change must make finding and hearing the right version **easier**: fewer decisions, less to scan, nothing said twice, nothing that needs setup before it helps. Never lose a bounce; never overwrite one.

Ease must never come from removing capability. Keep the feature and move its weight off the artist: useful defaults, optional detail behind a labelled control, direct manipulation with a button alternative. Before calling anything done, ask: *on the bus, one hand, bad signal, could someone hear the right version without thinking?* If not, it isn't done. And it should never feel corporate or flat: Mixlog looks like a studio at blue hour, full of instruments (meters, scopes, LEDs, readouts) and one rare magenta light, Phantom. The tone and its rules are in `src/AGENTS.md` §1 and §6.

Before touching an area, read its guide: `src/AGENTS.md` (the app the browser runs: routes, components, hooks, styles) and `src/server/AGENTS.md` (the Worker side: server functions, Access, D1, R2, `migrations/`). Tests live in `tests/`, never next to source.

## MANIFESTO

Mixlog has a manifesto, [`docs/MANIFESTO.md`](docs/MANIFESTO.md). Read it before changing anything, especially UI. It is local only (git-ignored) and the baseline for every decision.

## One app, one Worker

TanStack Start in SPA mode on one Cloudflare Worker: the browser renders every page; the Worker serves the shell and runs server functions. D1 holds metadata, a private R2 bucket holds files, Cloudflare Access is the only door. No Hono, no SSR, no hand-rolled auth, no second service.

## A dependency before hand-written code

Before writing something, check whether the platform or a dependency already does it, and use that when it does it better: a native Cloudflare binding over an SDK (R2 through `env.FILES`, never the S3 API or an S3 package; D1 through `env.DB`, wrapped by Drizzle), the web platform over a library (`Intl`, `<input type="date">`, `crypto.randomUUID()`), then an installed dependency, and only then a new one. What's here and what it's for:

- **Zod** checks everything that comes in: server function inputs, `/api` request bodies, URL search params (`readWith(schema)` in `server/input.ts` turns the first problem into the artist's words). No `typeof` ladders.
- **Drizzle** (as in Cadence) is the schema (`server/schema.ts`), the queries (`server/db.ts`) and the migrations (`pnpm db:generate`, applied by Wrangler). No raw `env.DB` calls, no hand-written migrations.
- **jose** verifies Access tokens. Never hand-rolled auth.
- **TanStack Router / Start** for routing, URL state, loaders and server functions; **Radix** (through `components/primitives/`) for anything interactive a screen reader must get right; **framer-motion** for motion; **clsx + tailwind-merge** (`cn`) for classes; **lucide-react** for icons.

Hand-written code stays where it's Mixlog's own rule (stacks, versions, filename suggestions, the date model) or a few lines that a dependency would make larger. A new dependency is pinned, maintained, runs on Workers when it's server-side, and replaces more code than it adds.

## Tests

`tests/` mirrors `src/` under two roots, chosen by what the test touches:

- `tests/unit/`: pure logic, no Worker bindings, no D1 or R2 (`src/server/access.ts` → `tests/unit/server/access.test.ts`).
- `tests/integration/`: server functions and routes against local D1 and R2, faking only outside services.

Vitest runs in plain Node (`vitest.config.ts`, not the Vite app config). Import source through the `#/` alias (`#/server/access`), never `../../src`. A test that fails if the logic breaks is part of the change; trivial one-liners need none.

## Dates: one model, everywhere

Mixlog deals in **dates, never clock times** (Cadence's time model, trimmed). Every date the artist sees or types is a **LocalDate**, `YYYY-MM-DD` with no time and no zone (`release_date`). The ISO timestamps D1 writes (`created_at`, `released_at`) are **bookkeeping Instants**: never shown, read only as the day they fell on in the artist's **Zone** (an IANA name; today the device's). `src/lib/time.ts` is the one place that converts: `dayOf(instant, zone)`, `todayIn(zone)`, and `formatDay`, the only formatter. A day the server must judge (not in the future) comes with the client's zone.

Banned outside `lib/time.ts` (`pnpm check:time`): slicing or splitting a timestamp for a day, `toISOString()` for a day, `new Date("…T00:00")` parsing, `getTimezoneOffset`, `Date` local getters, `toLocaleDateString`/`Intl.DateTimeFormat`, and a UTC day in SQL. `pnpm test:tz` runs the tests in four zones.

## Commands

`pnpm dev` (http://localhost:3000) · `pnpm test` (all of `tests/`) · `test:unit` · `test:integration` · `test:tz` (all of it in four zones) · `check:time` · `pnpm typecheck` · `pnpm build` · `pnpm preview` · `pnpm run deploy` (plain `pnpm deploy` is a pnpm built-in) · `pnpm db:generate` (a migration from `server/schema.ts`) · `db:check` · `pnpm db:migrate` (local D1; `db:migrate:remote` for production) · `pnpm cf-typegen` (after changing bindings in `wrangler.jsonc`).

Before pushing: `pnpm typecheck`, `pnpm test`, `pnpm check:time` and `pnpm build` pass locally. CI (`.github/workflows/ci.yml`) reruns them plus the four-zone tests and a deploy dry-run on every PR and push to `main`, and its Security job fails on tracked secret files or `docs/`, embedded keys or tokens, and high-severity production dependency advisories. It's a health signal; deploys stay by hand.

## AGENTS.md files are the current truth

- Each AGENTS.md describes the code **as it is now**. If a change makes a line wrong, fix that line in the same change.
- **Edit, don't append.** Replace outdated lines; if you add one, merge or cut another. Keep them from growing.
- No history, dated notes, or plans in AGENTS.md. Those belong in `docs/`.

## Versions and releases

- The version lives **only** in `package.json`. The UI reads it as `__APP_VERSION__`. Never type it anywhere else.
- `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com)) is the one changelog. A user-visible change gets one plain-language, one-line bullet (≤120 characters) under `## [Unreleased]` in `### Added`, `### Changed`, `### Removed`, or `### Fixed`. Internal-only work gets none.
- Every release needs a one-line summary under its heading.
- Semver: major = big release or breaking change · minor = a feature added, changed, or removed · patch = fixes, tweaks, dependency bumps.
- Never bump versions or tag by hand. `pnpm release` (release-it) stamps `[Unreleased]`, bumps `package.json`, commits, tags `vX.Y.Z`, and pushes. Run it only when the user asks.

## Docs and planning live in `docs/` (local only, git-ignored)

- Start at `docs/README.md`. Never create docs anywhere else.
- A minor or major update gets one planning file: `docs/updates/X.Y.Z.md` (copy `docs/updates/TEMPLATE.md`). Audits and follow-ups are sections in that file. Once it ships, move it to `docs/archive/X.Y.Z/` and edit the affected AGENTS.md lines.
- `docs/archive/` is frozen history. Don't edit it or treat it as current.
- Never link to `docs/` from committed files other than this one and `CLAUDE.md`. It doesn't exist on GitHub.

A future Go sync helper and CLI lives in `sync/` as its own Go module, with its own guide.
