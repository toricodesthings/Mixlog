// Server functions in plain Node. Start's compiler turns `.handler(body)` into `.handler(clientStub, body)` for the
// Worker; without it `.handler(body)` is only the client stub, which skips the validator. This setup file splits it
// the same way, and `call` runs a server function as the Worker would: validator, then handler, in a Start context.
// The global `access` middleware (start.ts) isn't run: Access is covered by tests/unit/server/access.test.ts.
import { AsyncLocalStorage } from 'node:async_hooks'
import { vi } from 'vitest'

vi.mock('@tanstack/react-start', async (importOriginal) => {
  const start = await importOriginal<typeof import('@tanstack/react-start')>()
  const split = (builder: any): any => ({ ...builder, validator: (v: unknown) => split(builder.validator(v)), handler: (fn: unknown) => builder.handler(fn, fn) })
  return { ...start, createServerFn: (options?: Parameters<typeof start.createServerFn>[0]) => split(start.createServerFn(options)) }
})

// Start keeps its request context under this global key (@tanstack/start-storage-context).
const key = Symbol.for('tanstack-start:start-storage-context')
const storage: AsyncLocalStorage<object> = ((globalThis as Record<symbol, AsyncLocalStorage<object>>)[key] ??= new AsyncLocalStorage())

type ServerFn<R> = (options: never) => Promise<R>

/** Runs a server function with `data`; resolves to its result or rejects with what it threw (`notFound()` included). */
export async function call<R>(fn: ServerFn<R>, data?: unknown): Promise<R> {
  const run = (fn as unknown as { __executeServer: (o: { data: unknown }) => Promise<{ result: R } | { error: unknown }> }).__executeServer
  const out = await storage.run({ startOptions: {}, contextAfterGlobalMiddlewares: {}, request: new Request('https://mixlog.test/') }, () => run({ data }))
  if ('error' in out) throw out.error
  return out.result
}
