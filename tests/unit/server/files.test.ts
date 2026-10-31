import { describe, expect, it } from 'vitest'

import { MAX_ARTWORK_BYTES, MAX_AUDIO_BYTES, artworkProblem, audioProblem, audioTypeOf, contentRange, parseUploadKey, uploadKey } from '#/server/files'

describe('artworkProblem', () => {
  it('takes a picture within the cap', () => {
    expect(artworkProblem('image/png', 1024)).toBeNull()
    expect(artworkProblem('image/jpeg', MAX_ARTWORK_BYTES)).toBeNull()
  })

  it('refuses SVG, other types, empty or unknown sizes, and anything over the cap', () => {
    expect(artworkProblem('image/svg+xml', 1024)).toMatch(/PNG or JPG/)
    expect(artworkProblem('image/webp', 1024)).toMatch(/PNG or JPG/)
    expect(artworkProblem(null, 1024)).toMatch(/PNG or JPG/)
    expect(artworkProblem('image/png', 0)).toMatch(/empty/)
    expect(artworkProblem('image/png', Number.NaN)).toMatch(/empty/)
    expect(artworkProblem('image/png', MAX_ARTWORK_BYTES + 1)).toMatch(/20 MB/)
  })
})

describe('contentRange', () => {
  it('says which bytes a ranged read returned', () => {
    expect(contentRange({ offset: 0, length: 100 }, 1000)).toBe('bytes 0-99/1000')
    expect(contentRange({ offset: 900 }, 1000)).toBe('bytes 900-999/1000')
    expect(contentRange({ suffix: 100 }, 1000)).toBe('bytes 900-999/1000')
    expect(contentRange({ suffix: 5000 }, 1000)).toBe('bytes 0-999/1000')
    expect(contentRange({ offset: 0, length: 100, suffix: undefined }, 1000)).toBe('bytes 0-99/1000')
  })
})

describe('audio uploads', () => {
  it('stores a type by extension, whatever the browser said', () => {
    expect(audioTypeOf('a.WAV', '')).toBe('audio/wav')
    expect(audioTypeOf('a.aif', 'application/octet-stream')).toBe('audio/aiff')
    expect(audioTypeOf('a', 'audio/x-wav')).toBe('audio/wav')
    expect(audioTypeOf('notes.txt', 'text/plain')).toBeNull()
  })

  it('checks the stack, type and size', () => {
    expect(audioProblem('master', 'audio/wav', 1)).toBeNull()
    expect(audioProblem('artwork', 'audio/wav', 1)).not.toBeNull()
    expect(audioProblem('mix', 'image/png', 1)).not.toBeNull()
    expect(audioProblem('mix', 'audio/mpeg', MAX_AUDIO_BYTES + 1)).toMatch('4 GB')
  })

  it('round-trips an upload key and refuses anything else', () => {
    expect(parseUploadKey(uploadKey('t1', 'mix', 'v-1'))).toEqual({ trackId: 't1', kind: 'mix', versionId: 'v-1' })
    expect(parseUploadKey('tracks/t1/artwork/v1')).toBeNull()
    expect(parseUploadKey('tracks/../x/mix/v1')).toBeNull()
  })
})
