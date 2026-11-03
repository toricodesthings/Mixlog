import { describe, expect, it } from 'vitest'

import { MAX_ARTWORK_BYTES, MAX_AUDIO_BYTES, MAX_LICENSE_BYTES, artworkProblem, audioProblem, audioTypeOf, contentRange, fileKey, licenseProblem, licenseTypeOf, startsLike } from '#/server/files'

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

})

describe('fileKey', () => {
  it('folders a file under its release, then its track, then its stack', () => {
    expect(fileKey({ releaseId: 'r1', trackId: 't1' }, 'master', 'v1')).toBe('releases/r1/tracks/t1/master/v1')
    expect(fileKey({ releaseId: 'r1' }, 'artwork', 'v2')).toBe('releases/r1/artwork/v2')
  })
})

describe('licenses', () => {
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0])

  it('takes a PDF or a Word document, by extension', () => {
    expect(licenseTypeOf('Sample clearance.PDF')).toBe('application/pdf')
    expect(licenseTypeOf('license.docx')).toBe(DOCX)
    expect(licenseTypeOf('license.doc')).toBe('application/msword')
    expect(licenseTypeOf('license.docm')).toBeNull()
    expect(licenseTypeOf('license.html')).toBeNull()
  })

  it('checks the type and size', () => {
    expect(licenseProblem('application/pdf', 1)).toBeNull()
    expect(licenseProblem('text/html', 1)).toMatch(/PDF or a Word/)
    expect(licenseProblem(DOCX, 0)).toMatch(/empty/)
    expect(licenseProblem(DOCX, MAX_LICENSE_BYTES + 1)).toMatch(/20 MB/)
  })

  it('refuses a file whose bytes aren’t the type it claims', () => {
    expect(startsLike('application/pdf', new TextEncoder().encode('%PDF-1.7\n'))).toBe(true)
    expect(startsLike(DOCX, bytes(0x50, 0x4b, 0x03, 0x04))).toBe(true)
    expect(startsLike('application/msword', bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBe(true)
    expect(startsLike('application/pdf', new TextEncoder().encode('<html><script>'))).toBe(false)
    expect(startsLike(DOCX, new TextEncoder().encode('%PDF-1.7'))).toBe(false)
    expect(startsLike('text/html', new TextEncoder().encode('<html>'))).toBe(false)
  })
})
