<h1 align="center">Mixlog</h1>

<p align="center"><strong>Every version, one place, any room.</strong></p>

Mixlog keeps a song's whole life in one place: test bounces and final masters, artwork, Canvas loops and videos, versioned and playable from any device. It's built for one artist per deployment. Fork it, point it at your own Cloudflare account, and it holds your music.

> [!NOTE]
> Early development. The [changelog](./CHANGELOG.md) records what has shipped.

## How it's built

One TanStack Start app on Cloudflare Workers. Files live in a private R2 bucket and go up in resumable chunks through the Worker. Track and version details live in D1. Cloudflare Access handles sign-in, so Mixlog never stores a password.

## Run it locally

**Requirements:** Node.js 22.22.0 or newer and pnpm (via Corepack).

```bash
corepack enable
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000`. See [AGENTS.md](./AGENTS.md) for the layout and conventions.

## License

[AGPL-3.0-only](./LICENSE).
