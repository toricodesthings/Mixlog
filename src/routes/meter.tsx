import { Link, createFileRoute } from '@tanstack/react-router'

import { MeterPage } from '#/components/meter/MeterPage'
import { Scope } from '#/components/primitives'

// The public meter: bare (MeterShell), and on its own host it's the whole site (router.tsx). Not in lib/nav.ts.
export const Route = createFileRoute('/meter')({
  staticData: { bare: true },
  head: () => ({
    meta: [
      { title: 'Meter · Mixlog' },
      { name: 'description', content: 'Measure a bounce on your own device: loudness, true peak, phase, low end and what each platform does to it. Nothing is uploaded.' },
    ],
  }),
  component: MeterPage,
  notFoundComponent: MeterNotFound,
})

function MeterNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <Scope flat className="mb-3" />
      <p className="readout text-accent">404 · No signal</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Nothing at this address</h1>
      <Link to="/meter" className="readout mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-accent">Open the meter</Link>
    </main>
  )
}
