# Mixlog Backend — Agent Instructions

The Worker side of the one Mixlog app: TanStack Start server functions on Cloudflare Workers, with D1 for metadata, a private R2 bucket for files, and Cloudflare Access as the only door. It serves one person, so there are no users, roles or tenancy code. It must stay edge-safe (no Node-only APIs, no long-lived connections) and never lose or overwrite a file. Code here is `src/server/`, `src/start.ts`, `migrations/` and `wrangler.jsonc`.

## 1. Tech Stack

| Concern | Technology |
|---|---|
| Runtime | Cloudflare Workers (`nodejs_compat`), entry `@tanstack/react-start/server-entry` |
| RPC | TanStack Start server functions (`createServerFn`) |
| Metadata | Cloudflare D1 (`env.DB`), plain SQL with bound parameters |
| Files | Cloudflare R2 (`env.FILES`), private bucket `mixlog` |
| Auth | Cloudflare Access JWTs, verified with `jose` against the team's JWKS |
| Lang | TypeScript |

## 2. Architecture

```text
src/
├── start.ts         # createStart: defaultSsr false + the access function middleware
└── server/
    ├── access.ts    # isAllowed (verifies the Access token), accessKeys (JWKS per isolate)
    ├── input.ts     # idInput: route params as row IDs; anything else is not found
    ├── releases.ts  # listUpcoming, listReleased, getRelease
    └── tracks.ts    # getTrack
migrations/          # D1 schema, NNNN_what.sql, the schema's source of truth
```

- One file per domain (`releases.ts`, `tracks.ts`, then `versions.ts`, `uploads.ts`…), holding its server functions and the row types the UI imports. No `helpers.ts`/`utils.ts` catch-alls; shared server behaviour (`access`, `input`) gets its own named file.
- A server function validates → queries → shapes its result. Logic used by two functions becomes a named function in the domain file.
- `env` comes from `cloudflare:workers` and is imported only here.

## 3. Adding Code

- **New server function:** in its domain file, `createServerFn()` (`{ method: 'POST' }` for writes), `.validator(...)` for every input (`idInput` for IDs), `.handler(...)`. Throw `notFound()` for a missing row, `redirect()` only from loaders. Add a test in `tests/integration/server/`.
- **Schema change:** a new `migrations/NNNN_what.sql`, never an edit to an applied one. `pnpm db:migrate` locally; `pnpm db:migrate:remote` runs before the deploy that needs it, by the user.
- **New binding or var:** add it to `wrangler.jsonc`, then `pnpm cf-typegen`.
- **A plain HTTP endpoint** exists only for non-browser clients (the later Go sync helper), as a server route under `/api/` that adds `access` to its `middleware`.

## 4. Request Lifecycle

The Worker serves the prerendered SPA shell (no data in it). Every server function call runs the `access` function middleware (`start.ts`): `isAllowed` checks the `cf-access-jwt-assertion` header against `ACCESS_TEAM_DOMAIN`'s JWKS, issuer and `ACCESS_AUD`, and fails closed (missing config, missing token, any verification error → 403). It's skipped only under `pnpm dev` (`import.meta.env.DEV`). Function middleware, not request middleware, because the build prerenders the shell without a token. `defaultSsr: false` keeps loaders in the browser, so no data is fetched without a token.

## 5. Database Rules (D1)

- Always bound parameters (`.prepare(sql).bind(...)`), never string-built SQL from input. Name the columns you return; no `SELECT *` sent to the UI.
- IDs are text; a route param reaches a query only through `idInput`.
- **Every track belongs to a release.** A release is Upcoming while `released_at` is null and Released once it's stamped.
- **Versions are immutable.** A version is never updated or overwritten, only followed by a new number in its stack (per track or per release, by kind). Current is a pin (`current_pins`), not a flag on the version. What was released stays exactly what was released.
- D1 is never the only record of a file: each R2 object's key and custom metadata carry its track, kind and version.

## 6. Files (R2)

- The bucket is private, never public or listable, reached only through the Worker.
- Uploads go through the Worker in chunks, never whole: the browser sends ~10 MB parts and the Worker writes each with `env.FILES` multipart (a Worker request body caps near 100 MB). An interrupted upload resumes; it never leaves a half-version behind.
- Playback streams from `env.FILES` with range requests. What plays is exactly what was uploaded: no transcodes, no hidden copies.
- One path in dev and production. No R2 API tokens, CORS, or signed URLs ever reach the browser.

## 7. Auth

Delegated to Cloudflare Access, never built. No passwords, sessions, cookies or user tables. `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are plain vars in `wrangler.jsonc` (public identifiers, not secrets). Never weaken `isAllowed`'s fail-closed checks; a change to it changes `tests/unit/server/access.test.ts` in the same change.

## 8. Tests

`tests/unit/server/` (pure logic: `access.test.ts` signs tokens with a local key set) · `tests/integration/server/` (server functions against local D1 and R2; only outside services are faked). Commands: `pnpm test` (everything), `test:unit`, `test:integration`.

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
pnpm db:migrate | db:migrate:remote | cf-typegen
pnpm run deploy
```

Deploying and remote migrations touch production: run them only when the user asks.

## 11. Anti-Patterns

A server function without the `access` middleware or input validation · string-built SQL · `UPDATE` or overwrite on a version or its file · whole-file uploads or signed URLs · `cloudflare:workers` imported outside `server/` · hand-rolled auth, sessions or cookies · tenancy code · editing an applied migration · secrets in `wrangler.jsonc` · stack traces or SQL in error responses · `helpers.ts`/`utils.ts` catch-alls.

## 12. Checklist

Identify domain → migration if persistence changed → server function with validator → bound SQL → never overwrite a file or version → tests → `pnpm typecheck`, `pnpm test`, `pnpm build`.

If this document conflicts with a proposed change, this document is the baseline.
