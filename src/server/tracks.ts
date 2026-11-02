import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'

import { db } from '#/server/db'
import { lyricsInput } from '#/server/details'
import { stampNow, tracks } from '#/server/schema'

/** Saves a track's lyrics: the writing room's autosave, a whole text each time, so the last save wins. */
export const saveLyrics = createServerFn({ method: 'POST' })
  .validator(lyricsInput)
  .handler(async ({ data }) => {
    const saved = await db.update(tracks).set({ lyrics: data.lyrics, updatedAt: stampNow }).where(eq(tracks.id, data.trackId)).returning({ id: tracks.id })
    if (!saved.length) throw notFound()
  })
