import { createFileRoute } from '@tanstack/react-router'

import { listTracks } from '#/server/tracks'

export const Route = createFileRoute('/')({ loader: () => listTracks(), component: Home })

function Home() {
  const tracks = Route.useLoaderData()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="surface-shell layer-shell-header safe-header-top sticky top-0 flex min-h-[var(--shell-header-h)] items-center border-b border-line px-4 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-muted">Library</p>
          <h1 className="font-display text-xl font-semibold">Mixlog</h1>
        </div>
      </header>

      <main className="safe-bottom flex flex-1 items-center justify-center px-4 py-10">
        {tracks.length > 0 ? (
          <ul className="w-full max-w-md space-y-2">
            {tracks.map((track) => (
              <li key={track.id} className="surface-item rounded-2xl px-4 py-3 font-medium">
                {track.title}
              </li>
            ))}
          </ul>
        ) : (
        <section className="surface-card glow-accent w-full max-w-md rounded-3xl px-6 py-10 text-center">
          <h2 className="font-display text-2xl font-semibold">No tracks yet</h2>
          <p className="mx-auto mt-3 max-w-xs text-balance text-sm leading-relaxed text-ink-soft">
            Every bounce you add lands here: MP3 tests while it&rsquo;s moving, the final WAV once it&rsquo;s right.
          </p>
        </section>
        )}
      </main>
    </div>
  )
}
