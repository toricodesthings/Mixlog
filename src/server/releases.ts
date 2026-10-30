import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import { idInput } from '#/server/input'

export type ReleaseFormat = 'single' | 'ep' | 'album'
export type ReleaseRow = { id: string; title: string; format: ReleaseFormat; release_date: string | null; released_at: string | null }

const COLUMNS = 'id, title, format, release_date, released_at'

/** Upcoming: soonest date first, undated after. Releases: newest out first. */
export const listUpcoming = createServerFn().handler(async () => {
  const { results } = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM releases WHERE released_at IS NULL ORDER BY release_date IS NULL, release_date, created_at DESC`,
  ).all<ReleaseRow>()
  return results
})

export const listReleased = createServerFn().handler(async () => {
  const { results } = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM releases WHERE released_at IS NOT NULL ORDER BY COALESCE(release_date, released_at) DESC`,
  ).all<ReleaseRow>()
  return results
})

export const getRelease = createServerFn()
  .validator(idInput)
  .handler(async ({ data: id }) => {
    const release = await env.DB.prepare(`SELECT ${COLUMNS} FROM releases WHERE id = ?`).bind(id).first<ReleaseRow>()
    if (!release) throw notFound()
    const { results: tracks } = await env.DB.prepare('SELECT id, title FROM tracks WHERE release_id = ? ORDER BY position, created_at')
      .bind(id)
      .all<{ id: string; title: string }>()
    return { release, tracks }
  })
