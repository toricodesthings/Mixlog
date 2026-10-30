import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import { idInput } from '#/server/input'
import type { ReleaseRow } from '#/server/releases'

export type TrackDetail = { id: string; title: string; release_id: string }

/** A track with the release it belongs to. */
export const getTrack = createServerFn()
  .validator(idInput)
  .handler(async ({ data: id }) => {
    const track = await env.DB.prepare('SELECT id, title, release_id FROM tracks WHERE id = ?').bind(id).first<TrackDetail>()
    if (!track) throw notFound()
    const release = await env.DB.prepare('SELECT id, title, format, release_date, released_at FROM releases WHERE id = ?')
      .bind(track.release_id)
      .first<ReleaseRow>()
    if (!release) throw notFound()
    return { track, release }
  })
