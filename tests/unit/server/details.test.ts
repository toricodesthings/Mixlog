import { describe, expect, it } from 'vitest'

import { detailsInput, isrcOf, lyricsInput, upcOf } from '#/server/details'

const base = { id: 'r1', title: ' Night Drive ', format: 'ep', releaseDate: '', upc: '', tracks: [{ id: 't1', title: 'One', isrc: '' }], released: false, zone: 'America/Toronto' }

describe('details', () => {
  it('reads ISRCs and UPCs the way distributors print them', () => {
    expect(isrcOf('us-s1z-26-00001')).toBe('USS1Z2600001')
    expect(isrcOf('USS1Z260000')).toBeNull()
    expect(upcOf('1234 5678 9012')).toBe('123456789012')
    expect(upcOf('12345')).toBeNull()
    expect(upcOf('123456789013')).toBeNull() // wrong check digit
    expect(upcOf('4006381333931')).toBe('4006381333931') // an EAN-13
  })

  it('trims, keeps empty fields empty, and names a single’s track after it', () => {
    expect(detailsInput(base)).toMatchObject({ title: 'Night Drive', releaseDate: null, upc: null, tracks: [{ title: 'One', isrc: null, origin: 'original' }] })
    expect(detailsInput({ ...base, format: 'single' }).tracks[0].title).toBe('Night Drive')
  })

  it('keeps lyrics as typed, and whose song a track is', () => {
    expect(lyricsInput({ trackId: 't1', lyrics: '#VERSE\n  Line one\n\nLine two  \n' }).lyrics).toBe('#VERSE\n  Line one\n\nLine two')
    expect(lyricsInput({ trackId: 't1', lyrics: ' \n ' }).lyrics).toBeNull()
    const track = { id: 't1', title: 'One', origin: 'cover' }
    expect(detailsInput({ ...base, tracks: [track] }).tracks[0].origin).toBe('cover')
    expect(() => detailsInput({ ...base, tracks: [{ ...track, origin: 'bootleg' }] })).toThrow(/original, a cover or a remix/)
  })

  it('refuses what a distributor would', () => {
    expect(() => detailsInput({ ...base, upc: '12' })).toThrow(/UPC/)
    expect(() => detailsInput({ ...base, tracks: [{ id: 't1', title: 'One', isrc: 'nope' }] })).toThrow(/ISRC/)
    expect(() => detailsInput({ ...base, format: 'single', tracks: [base.tracks[0], { id: 't2', title: 'Two' }] })).toThrow(/single/)
  })

  it('plans any day in Upcoming; a release went out on a day that has come', () => {
    expect(detailsInput({ ...base, releaseDate: '2999-01-01' }).releaseDate).toBe('2999-01-01')
    expect(() => detailsInput({ ...base, released: true, releaseDate: '2999-01-01' })).toThrow(/come/)
    expect(() => detailsInput({ ...base, released: true })).toThrow(/come/)
    expect(detailsInput({ ...base, released: true, releaseDate: '2026-08-01' }).releaseDate).toBe('2026-08-01')
  })
})
