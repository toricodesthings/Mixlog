# Mixlog Backend — Agent Instructions

The Worker side: `src/server/`, `src/server.ts` (Start's handler + the daily cron), `src/start.ts` (middleware), `src/routes/api/`, `migrations/`, `wrangler.jsonc`. Edge-safe: no Node-only APIs, no long-lived connections. This guide is the baseline when a change conflicts with it.

## Shape

- One file per domain (`releases.ts`, `tracks.ts`, `versions.ts`, `artists.ts`…) holds its server functions and the row types the UI imports. Shared behaviour gets its own named file (`access`, `input`, `log`), never `helpers.ts`/`utils.ts`. Pure rules the browser shares live in their own files (`files.ts`, `lanes.ts`, `shipping.ts`, `loudness.ts`, `details.ts`) and get unit tests.
- **Server function:** `createServerFn()` (`POST` for writes) → `.validator(readWith(Schema))`, a Zod schema in the artist's words (`idInput` for IDs, never hand-written `typeof` checks) → query → shape. Missing row: `notFound()`; a no: `Refusal`, never a bare `Error`; `redirect()` only from loaders.
- **HTTP endpoints** exist only for file bytes and non-browser clients: a route under `routes/api/` calling a handler in `server/` that checks `allowed` before anything else (server routes skip function middleware). A public read is never a server function or a flag on `serveFile`.
- New binding or var: `wrangler.jsonc`, then `pnpm cf-typegen`. Secrets go in `.dev.vars` and `wrangler secret`, never `wrangler.jsonc`. `limits.cpu_ms` is high because the cron measures whole songs (Workers Paid).

## Requests and auth

- Every answer gets `securityHeaders`; non-`GET`/`HEAD` calls must pass `sameOrigin`. Never drop either from `requestMiddleware`.
- **The meter host** (`METER_HOST`, outside Access): `server.ts` asks `meterHostAnswer` before Start sees the request: an allowlist (the page and built files) answers, every `/_serverFn/`, `/api/` and non-`GET`/`HEAD` request is a bare 404, and any other address gets the page shell as a 404, never its own route. `x-robots-tag` is dropped there. Empty `METER_HOST` turns it off.
- Every server function runs the `access` function middleware (function, not request, because the build prerenders the shell without a token). `isAllowed` fails closed (missing config, token or any verification error → 403), skipped only under `import.meta.env.DEV`. A change to it changes `tests/unit/server/access.test.ts`. No passwords, sessions, cookies, users or tenancy.
- **Logging** is `report` only (`log.ts`): warnings and failures, never the happy path. `failures`/`routeFailures` log anything not `isAnswer` and answer `SERVER_FAILED`, never the raw message, stack or SQL. A failure turned into an answer is `report('warn', …)`. Pass the error itself, not its string.

## D1

- Drizzle's builder through `db`; rows the UI reads name their columns, never `SELECT *`. What the builder can't say is a `sql` template with `${}`-bound values, never string-built.
- **A correlated subquery names its outer row in full** (`outer('releases', 'id')`): Drizzle writes a single-table column bare, which the subquery reads as its own. A query with its own logic gets a test in `tests/integration/server/`, through the query builder as `releaseQuery` is.
- A page's reads go in one `db.batch`; batch rows are keyed by column name, so same-named join columns need `.as()`. A new lookup checks `EXPLAIN QUERY PLAN` for a `SCAN` in a correlated subquery.
- Instants are written only by `stamp()` (`schema.ts`). SQL never computes a day (`date('now')` is UTC's); a day to judge arrives from the client with its zone.
- **Schema change:** `schema.ts` → `pnpm db:generate`; never hand-write or edit an applied migration (`pnpm db:check`). A generated rebuild of a referenced table (`versions`) cascades on D1 (foreign keys stay on): set the referencing rows aside and restore them in that migration, as `0004` does. `pnpm db:migrate:remote` runs before the deploy that needs it, only when the user asks.
- Worker-read settings are rows in `settings` (a missing row is the default); per-device ones stay in the browser.

## Versions

- **Immutable.** A version row changes only by its stamps, its `analysis` (filled when null or replaced by a newer `METER`; never in R2 metadata) and its lane (`fileVersion`), which keeps its number. Mixes and masters share one sequence (`versions_track_bounce`), other kinds number per stack, and pruned versions still count, so no number is reused.
- **The final** is the track's `master` pin in `current_pins`: lossless, set only by the artist. Other stacks' current follows newest unless pinned. Pruned versions are never current or newest and leave every query.
- A measured mix or master stamps `tracks.scene`/`releases.scene` once (`WHERE scene IS NULL`), never rewritten.
- **Moving to Releases** (`shipRelease`, rules in `shipping.ts`) needs every final; one batch stamps the release and what ships, and sets the rest aside with `pruned_at` (licenses and artwork stay). `unshipRelease` works while `moveBackWindow` allows; then the cron's `erasePruned` deletes each file, then its row. `keepDays()` is read when used (null keeps everything).
- Only two things replace a file, each stored and recorded before the old row and file are deleted: artwork (one per release) and, in Releases, a slot named by `replaces`/`x-replaces`.

## R2

- Bucket binding only (`env.FILES`), never the S3 API; no tokens, CORS or signed URLs reach the browser, nor do keys.
- **Keys** come from `fileKey` (`files.ts`), foldered like the song with the rows' own IDs; key plus custom metadata (release, track, kind, version, filename) must recover every file without D1. A key is fixed at upload; `versions.r2_key` is what's served.
- **Audio** uploads are R2 multipart through the Worker in 10 MB parts, never whole (request bodies cap near 100 MB). Nothing reaches D1 until complete; the number is taken inside the completing `INSERT`; a failed insert deletes the object. `filingOf` is checked at start and completion.
- **Artwork, licenses, Canvas** are single requests with size caps and type checks in `files.ts` (licenses and Canvas checked by first bytes). Artwork's WebP preview (`env.IMAGES`) is disposable: a failure warns and the original is served.
- `serveFile` serves the exact upload: ranges, `private, immutable` (licenses `no-store`), `nosniff`, a sandboxing CSP. No transcodes or hidden copies beyond artwork's `?preview`.

## Tests

Integration tests run real queries: `vitest.config.ts` maps `cloudflare:workers` to `tests/support/cloudflare-workers.ts` (D1 over in-memory SQLite built from `migrations/`, R2 in memory); `tests/integration/migrations.test.ts` runs migrations D1's way.
