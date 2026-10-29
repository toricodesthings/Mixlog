import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

export type TrackRow = { id: string; title: string; updated_at: string }

export const listTracks = createServerFn().handler(async () => {
  const { results } = await env.DB.prepare('SELECT id, title, updated_at FROM tracks ORDER BY updated_at DESC').all<TrackRow>()
  return results
})
