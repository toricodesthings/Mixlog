# Mixlog — Repo Rules for Agents

Mixlog is one place for one artist's music in progress: every bounce, master, artwork, Canvas and video, versioned and playable anywhere. Every change must make finding and hearing the right version **easier**: fewer decisions, less to scan, nothing said twice, nothing that needs setup before it helps. Never lose a bounce; never overwrite one.

Read `docs/MANIFESTO.md` before changing anything, especially UI. It is local only (git-ignored) and the baseline for every decision.

## Stack

One full-stack app on one Cloudflare Worker: TanStack Start (SPA mode: the browser renders every page; the Worker runs server functions and server routes) · React 19 · Tailwind CSS v4 (tokens in `src/styles/app.css`) · Cloudflare D1 (metadata) · Cloudflare R2 (files, private) · Cloudflare Access (auth, verified in request middleware). No Hono, no SSR, no hand-rolled auth.

## Where things go

```text
src/
├── routes/          # File routes, thin: read params/search, compose components. routeTree.gen.ts is generated.
├── components/
│   ├── primitives/  # Building blocks (Button, Dialog, Menu…), ported from Cadence. Domain code imports these, never raw libraries.
│   ├── layout/      # Shell, page headers, phone dock
│   ├── shared/      # Used by more than one domain
│   └── <domain>/    # player, tracks, releases, uploads… created when the first file needs it
├── hooks/           # Reusable hooks
├── lib/             # Client-safe logic and constants (no server imports)
├── server/          # Server-only: server functions, middleware, D1 and R2 access
└── styles/app.css   # Design tokens and utilities: the design source of truth
tests/               # Mirrors src/, never next to source
```

- UI talks to the server through **server functions** (`createServerFn`) in `src/server/`. Plain HTTP endpoints exist only for non-browser clients (the later Go sync helper) as **server routes** under `/api/`.
- Files never pass through the Worker: the browser uploads straight to R2 with signed multipart URLs.
- Never hardcode a hex in a component; add a semantic token to `app.css`.
- A future Go sync helper and CLI lives in `sync/` as its own Go module.

## AGENTS.md files are the current truth

- Each AGENTS.md describes the code **as it is now**. If a change makes a line wrong, fix it in the same change.
- **Edit, don't append.** No history, dated notes, or plans in AGENTS.md; those belong in `docs/`.

## Commands

`pnpm dev` (http://localhost:3000) · `pnpm build` · `pnpm typecheck` · `pnpm preview` · `pnpm deploy` · `pnpm cf-typegen` (after changing bindings in `wrangler.jsonc`).

## Versions and releases

- The version lives **only** in `package.json`. Never type it anywhere else.
- `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com)) is the one changelog. A user-visible change gets one plain-language, one-line bullet (≤120 characters) under `## [Unreleased]` in `### Added`, `### Changed`, `### Removed`, or `### Fixed`. Internal-only work gets none.
- Every release needs a one-line summary under its heading.
- Semver: major = big release or breaking change · minor = a feature added, changed, or removed · patch = fixes, tweaks, dependency bumps.
- Never bump versions or tag by hand. `pnpm release` (release-it) stamps `[Unreleased]`, bumps `package.json`, commits, tags `vX.Y.Z`, and pushes. Run it only when the user asks.

## Docs and planning live in `docs/` (local only, git-ignored)

- Start at `docs/README.md`. Never create docs anywhere else.
- A minor or major update gets one planning file: `docs/updates/X.Y.Z.md` (copy `docs/updates/TEMPLATE.md`). Audits and follow-ups are sections in that file. Once it ships, move it to `docs/archive/X.Y.Z/`.
- `docs/archive/` is frozen history.
- Never link to `docs/` from committed files other than this one and `CLAUDE.md`. It doesn't exist on GitHub.
