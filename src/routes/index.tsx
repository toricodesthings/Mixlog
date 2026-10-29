import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <h1 className="font-display text-5xl font-semibold text-text">Mixlog</h1>
        <p className="mt-3 text-text-soft">Every version, one place, any room.</p>
      </div>
    </main>
  )
}
