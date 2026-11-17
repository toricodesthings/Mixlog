# Mixlog — Repo Rules for Agents

Read [`docs/MANIFESTO.md`](docs/MANIFESTO.md) (local only) before any change, especially UI, then the guide for the area: `src/AGENTS.md` (browser app) or `src/server/AGENTS.md` (Worker, D1, R2, Access, `migrations/`).

## The bar

- Every change makes hearing the right version **easier** (fewer decisions, nothing said twice, no setup), never by removing capability: move its weight into defaults or optional detail.
- *On the bus, one hand, bad signal, could someone hear the right version without thinking?* If not, it isn't done.
- Never lose or overwrite a bounce.
- **Symmetry:** anything side by side lines up to the pixel; a near miss is a bug.

## Code

- TanStack Start (SPA) on one Cloudflare Worker; D1 metadata, private R2 files, Cloudflare Access as the only door. No Hono, SSR, hand-rolled auth or second service.
- Before writing code: native binding (`env.FILES`, `env.DB` via Drizzle) → web platform → installed dependency → a new one (pinned, maintained, Workers-safe, removes more code than it adds).
- Tests mirror `src/` in `tests/unit/` (pure logic) or `tests/integration/` (over `tests/support/`), imported via `#/`. Logic that can break ships with a test.

## Dates

Days, never clock times (except a version's landing time). A shown or typed day is a LocalDate `YYYY-MM-DD`; `created_at`/`released_at`/`pruned_at` are Instants written only by `stamp()`, read in the artist's zone. `src/lib/time.ts` is the only converter; nothing parses a formatted date back; a day the server judges comes with the client's zone. `pnpm check:time` enforces it.

## Workflow

- Before pushing: `pnpm typecheck`, `lint`, `test`, `check:time`, `build`. Deploy is `pnpm run deploy`, by hand. After `meter/` changes, `pnpm meter:build` and commit `meter/pkg`; after binding changes, `pnpm cf-typegen`; migrations only via `pnpm db:generate`.
- AGENTS.md files describe the code as it is now: fix wrong lines in the same change, edit don't append, no history or plans.
- Version lives only in `package.json`. Each user-visible change gets one plain ≤120-char bullet under `## [Unreleased]` in `CHANGELOG.md` (Added/Changed/Removed/Fixed); each release a one-line summary. Semver: major = breaking, minor = feature, patch = fixes and bumps. Never bump or tag by hand; `pnpm release` only when asked.
- Docs live only in `docs/` (start at `docs/README.md`). A minor or major update gets `docs/updates/X.Y.Z.md` from `TEMPLATE.md`, moved to `docs/archive/X.Y.Z/` (frozen) once shipped. Link to `docs/` only from this file and `CLAUDE.md`.
