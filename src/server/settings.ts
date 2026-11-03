import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/server/db'
import { readWith } from '#/server/input'
import { settings } from '#/server/schema'
import { DEFAULT_KEEP_DAYS, type KeepDays } from '#/server/shipping'

const KEEP = 'keep_after_release'
const stored = (days: KeepDays) => (days === null ? 'forever' : String(days))
const KeepInput = z.union([z.literal(7), z.literal(14), z.literal(30), z.null()], 'Keep them a week, two weeks, a month, or always.')

/** How long what didn't ship is kept after a release goes out; the default until it's chosen. */
export const keepDays = createServerOnlyFn(async (): Promise<KeepDays> => {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, KEEP))
  const parsed = KeepInput.safeParse(row?.value === 'forever' ? null : Number(row?.value))
  return row && parsed.success ? parsed.data : DEFAULT_KEEP_DAYS
})

/** The settings the Worker keeps, for the Settings dialog. */
export const getSettings = createServerFn().handler(async () => ({ keepDays: await keepDays() }))

export const saveKeepDays = createServerFn({ method: 'POST' })
  .validator(readWith(KeepInput))
  .handler(async ({ data }) => {
    await db.insert(settings).values({ key: KEEP, value: stored(data) }).onConflictDoUpdate({ target: settings.key, set: { value: stored(data) } })
  })
