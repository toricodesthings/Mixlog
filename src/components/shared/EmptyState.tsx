/** A quiet fact about what isn't here yet. Never an error, never a nag. */
export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card glow-accent mx-auto mt-[8vh] w-full max-w-md rounded-3xl px-6 py-10 text-center">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="mx-auto mt-3 max-w-xs text-balance text-sm leading-relaxed text-ink-soft">{children}</p>
    </section>
  )
}
