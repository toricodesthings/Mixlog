# Mixlog Backend — Agent Instructions

The Worker side of the one Mixlog app: TanStack Start server functions on Cloudflare Workers, with D1 for metadata, a private R2 bucket for files, and Cloudflare Access as the only door. It serves one person, so there are no users, roles or tenancy code. It must stay edge-safe (no Node-only APIs, no long-lived connections) and never lose or overwrite a file. Code here is `src/server/`, `src/start.ts`, `migrations/` and `wrangler.jsonc`.

## 1. Tech Stack

| Concern | Technology |
|---|---|
| Runtime | Cloudflare Workers (`nodejs_compat`), entry `@tanstack/react-start/server-entry` |
| RPC | TanStack Start server functions (`createServerFn`) |
| Metadata | Cloudflare D1 through Drizzle (`db.ts`, schema in `schema.ts`, migrations by `drizzle-kit`) |
| Files | Cloudflare R2 through its Worker binding (`env.FILES`), private bucket `mixlog`; never the S3 API |
| Auth | Cloudflare Access JWTs, verified with `jose` against the team's JWKS |
| Input | Zod schemas, through `readWith` (`input.ts`) for our own error words |
| Lang | TypeScript |

## 2. Architecture

```text
src/
├── start.ts         # createStart: defaultSsr false + the access function middleware
└── server/
    ├── access.ts    # isAllowed (verifies the Access token), accessKeys (JWKS per isolate)
    ├── schema.ts    # The D1 schema in Drizzle: the source of truth for tables, checks and indexes
    ├── db.ts        # db: Drizzle over env.DB
    ├── input.ts     # Id, isId, idInput (route params as row IDs; anything else is not found), readWith (a Zod schema in our own words)
    ├── files.ts     # Pure file rules (artwork and audio types and caps, upload keys, finals, Content-Range), shared with the browser
    ├── details.ts   # Pure Details rules (detailsInput, ISRC and UPC), shared with the browser
    ├── releases.ts  # releaseQuery (cover, track count, length), listUpcoming, listReleased, getRelease (tracks, every version and which is current), createRelease (with `releasedOn`, straight to Releases), updateRelease (Details)
    └── versions.ts  # serveFile, addArtwork, start/putPart/complete/abortUpload: the handlers behind routes/api/
src/routes/api/      # Server routes, one line each: files.$versionId (GET), releases.$releaseId.artwork (POST), uploads (POST/PUT/DELETE), uploads.complete (POST)
migrations/          # NNNN_what.sql, generated from schema.ts by `pnpm db:generate` (0001 and 0002 predate it); meta/ is drizzle-kit's
```

- One file per domain (`releases.ts`, `versions.ts`, then `tracks.ts`, `notes.ts`… when they have functions), holding its server functions and the row types the UI imports. No `helpers.ts`/`utils.ts` catch-alls; shared server behaviour (`access`, `input`) gets its own named file.
- A server function validates → queries → shapes its result. Logic used by two functions becomes a named function in the domain file.
- `env` comes from `cloudflare:workers` and is imported only here; D1 is reached only through `db`.

## 3. Adding Code

- **New server function:** in its domain file, `createServerFn()` (`{ method: 'POST' }` for writes), `.validator(readWith(Schema))` for every input, a Zod schema whose messages are the artist's words (`idInput` for IDs), `.handler(...)`. Throw `notFound()` for a missing row, `redirect()` only from loaders. Add a test in `tests/integration/server/`.
- **Schema change:** edit `schema.ts`, then `pnpm db:generate` writes `migrations/NNNN_what.sql` (never hand-write one or edit an applied one; `pnpm db:check` checks them). `pnpm db:migrate` applies it locally; `pnpm db:migrate:remote` runs before the deploy that needs it, by the user.
- **New binding or var:** add it to `wrangler.jsonc`, then `pnpm cf-typegen`.
- **A plain HTTP endpoint** exists only for file bytes (an `<img>` or `<audio>` needs a URL; uploads stream) and non-browser clients (the later Go sync helper): a server route under `routes/api/` that calls a handler in `server/`, which checks `isAllowed` before anything else. Server routes don't get the function middleware.

## 4. Request Lifecycle

The Worker serves the prerendered SPA shell (no data in it). Every server function call runs the `access` function middleware (`start.ts`): `isAllowed` checks the `cf-access-jwt-assertion` header against `ACCESS_TEAM_DOMAIN`'s JWKS, issuer and `ACCESS_AUD`, and fails closed (missing config, missing token, any verification error → 403). It's skipped only under `pnpm dev` (`import.meta.env.DEV`). Function middleware, not request middleware, because the build prerenders the shell without a token; the `/api` handlers in `versions.ts` run the same check themselves, first. `defaultSsr: false` keeps loaders in the browser, so no data is fetched without a token.

## 5. Database Rules (D1)

- Queries are Drizzle's builder (`db.select(...)`, `db.insert(...)`, `db.batch([...])`); a row the UI reads names its columns in its own shape (`release_date: releases.releaseDate`), never `SELECT *`. What the builder can't say (the current-version rule, numbering inside one `INSERT … SELECT`) is a `sql` template: values are `${}`-bound, never string-built.
- **A correlated subquery names its outer row in full** (`outer('releases', 'id')` in `releases.ts`): in a single-table select Drizzle writes a column bare (`"id"`), which the subquery reads as its own table's. `tests/integration/server/releases.test.ts` catches it.
- IDs are text; a route param reaches a query only through `idInput`.
- Dates follow the root guide's model: a day is `YYYY-MM-DD` (`release_date`, the day it goes or went out); `created_at`/`released_at` are `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` bookkeeping, never a day by themselves. SQL never computes a day (`date('now')` is UTC's day, not the artist's): a day to judge arrives from the client with its zone and is checked with `lib/time.ts` (`createRelease`'s `releasedOn` ≤ `todayIn(zone)`).
- **Every track belongs to a release.** A release is Upcoming while `released_at` is null and Released once it's stamped.
- **Versions are immutable.** A version is never updated or overwritten, only followed by a new number in its stack (per track or per release, by kind). The one exception is artwork: a release has one, so a new one replaces it (below). Current is a pin (`current_pins`), not a flag on the version. What was released stays exactly what was released.
- D1 is never the only record of a file: each R2 object's key and custom metadata carry its track, kind and version.

## 6. Files (R2)

- The bucket is private, never public or listable, reached only through the Worker.
- Audio and video go through the Worker in chunks, never whole (a Worker request body caps near 100 MB). Audio today: `POST /api/uploads` starts an R2 multipart upload for a track's stack (`master`, `mix`, `instrumental`, `acapella`; MP3, WAV, AIFF, FLAC, M4A or OGG, typed by extension; 4 GB at most), `PUT /api/uploads?key&uploadId&part` sends each 10 MB part (the browser retries a part three times), `POST /api/uploads/complete` joins them and inserts the version, `DELETE` drops the parts of one that won't finish. Nothing is in D1 until it's whole: the key (`tracks/<track>/<kind>/<versionId>`) and the object's metadata carry the track, stack and filename. The number is taken at completion inside the INSERT, so an abandoned upload never leaves a gap and two finishing at once can't share one. A failed insert deletes the object: never a half-version.
- **Artwork** is the one single-request upload: `POST /api/releases/$releaseId/artwork`, the body is the image, streamed straight into R2. PNG or JPG only (what distributors take; never SVG), 20 MB at most (`files.ts`). **One per release:** the new one is stored and recorded first (if the D1 row fails, its object is deleted), then the old row and file are deleted.
- `GET /api/files/$versionId` serves any version exactly as uploaded: range requests for playback, `private, immutable` caching (a version never changes), `nosniff` and a sandboxing CSP. No transcodes, no hidden copies.
- One path in dev and production. No R2 API tokens, CORS, or signed URLs ever reach the browser.

## 7. Auth

Delegated to Cloudflare Access, never built. No passwords, sessions, cookies or user tables. `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are plain vars in `wrangler.jsonc` (public identifiers, not secrets). Never weaken `isAllowed`'s fail-closed checks; a change to it changes `tests/unit/server/access.test.ts` in the same change.

## 8. Tests

`tests/unit/server/` (pure logic: `access.test.ts` signs tokens with a local key set; `files.test.ts`; `details.test.ts`; the filename reading is `tests/unit/components/uploads/suggest.test.ts`) · `tests/integration/server/` (queries run for real: `vitest.config.ts` maps `cloudflare:workers` to `tests/support/cloudflare-workers.ts`, D1's API over an in-memory SQLite built from `migrations/`; R2 isn't there yet). Commands: `pnpm test` (everything), `test:unit`, `test:integration`.

## 9. Environment & Bindings

| Binding | Purpose |
|---|---|
| `DB` | D1 database `mixlog` (migrations in `migrations/`) |
| `FILES` | R2 bucket `mixlog` |
| `ACCESS_TEAM_DOMAIN` | `https://<team>.cloudflareaccess.com`, issuer and JWKS host |
| `ACCESS_AUD` | The Access application's audience tag |

`pnpm dev` simulates D1 and R2 locally in `.wrangler/state` (delete it to start over). Secrets, if any arrive, go in `.dev.vars` locally and `wrangler secret` in production, never in `wrangler.jsonc`.

## 10. Commands

```bash
pnpm dev | test:unit | test:integration | typecheck | build
pnpm db:generate | db:check | db:migrate | db:migrate:remote | cf-typegen
pnpm run deploy
```

Deploying and remote migrations touch production: run them only when the user asks.

## 11. Anti-Patterns

A server function without the `access` middleware or input validation · raw `env.DB` calls or a hand-written migration · hand-written `typeof` checks where a Zod schema belongs · an S3 client or SDK for R2 · string-built SQL · `UPDATE` or overwrite on a version or its file · whole-file audio or video uploads, or signed URLs · an `/api` handler that reads before `isAllowed` · `cloudflare:workers` imported outside `server/` · hand-rolled auth, sessions or cookies · tenancy code · editing an applied migration · secrets in `wrangler.jsonc` · stack traces or SQL in error responses · `helpers.ts`/`utils.ts` catch-alls.

## 12. Checklist

Identify domain → `schema.ts` + `pnpm db:generate` if persistence changed → server function with a Zod validator → Drizzle query → never overwrite a file or version → tests → `pnpm typecheck`, `pnpm test`, `pnpm build`.

If this document conflicts with a proposed change, this document is the baseline.
