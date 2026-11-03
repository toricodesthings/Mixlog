import { describe, expect, it } from 'vitest'

import { LANES, lanesOf, moveProblem, nextLane, playOf, type Lane } from '#/server/lanes'

const v = (id: string, kind: string, number: number, content_type = 'audio/mpeg', is_final = 0, is_current = 0) => ({ id, track_id: 't', kind, number, content_type, is_final, is_current })
const WAV = 'audio/wav'

describe('a track’s lanes', () => {
  const rows = [
    v('x1', 'mix', 1),
    v('x2', 'mix', 2),
    v('m3', 'master', 3),
    v('m4', 'master', 4, WAV, 1),
    v('i1', 'instrumental', 1, WAV),
    v('i2', 'instrumental', 2, WAV, 0, 1),
    v('l1', 'license', 1, 'application/pdf'),
    { ...v('other', 'master', 9, WAV, 1), track_id: 'u' },
  ]

  it('files the pinned master as the final, the rest newest first, and one row per alternate', () => {
    const lanes = lanesOf('t', rows)
    expect(lanes.final?.id).toBe('m4')
    expect(lanes.master.map((r) => r.id)).toEqual(['m3'])
    expect(lanes.mix.map((r) => r.id)).toEqual(['x2', 'x1'])
    expect(lanes.alternates.map((a) => [a.kind, a.top.id, a.earlier.map((r) => r.id)])).toEqual([['instrumental', 'i2', ['i1']]])
  })

  it('plays the final, else the newest master, else the newest mix', () => {
    expect(playOf('t', rows)?.id).toBe('m4')
    expect(playOf('t', rows.filter((r) => r.id !== 'm4'))?.id).toBe('m3')
    expect(playOf('t', rows.filter((r) => r.kind === 'mix'))?.id).toBe('x2')
    expect(playOf('t', [])).toBeNull()
  })
})

describe('moving between lanes', () => {
  const test = v('m', 'master', 3)
  const wav = v('w', 'master', 4, WAV)
  const cases: [string, ReturnType<typeof v>, Lane, RegExp | null][] = [
    ['mix → master', v('x', 'mix', 1), 'master', null],
    ['test mix → final', v('x', 'mix', 1), 'final', /test can’t be the final/],
    ['WAV mix → final', v('x', 'mix', 1, WAV), 'final', null],
    ['test master → final', test, 'final', /test can’t be the final/],
    ['WAV master → final', wav, 'final', null],
    ['master → mix', test, 'mix', null],
    ['final → master', v('f', 'master', 4, WAV, 1), 'master', null],
    ['final → mix', v('f', 'master', 4, WAV, 1), 'mix', null],
  ]
  it.each(cases)('in Upcoming, %s', (_, version, to, problem) => {
    const said = moveProblem(version, to, 'upcoming')
    if (problem) expect(said).toMatch(problem)
    else expect(said).toBeNull()
  })

  it('in Releases, only gives a track its final', () => {
    expect(moveProblem(wav, 'final', 'released')).toBeNull()
    expect(moveProblem(test, 'final', 'released')).toMatch(/test/)
    expect(moveProblem(wav, 'master', 'released')).toMatch(/one file per slot/)
    expect(moveProblem(v('i', 'instrumental', 1, WAV), 'final', 'upcoming')).toMatch(/Only mixes and masters/)
  })

  it('steps up and down one lane, and stops at the edges', () => {
    expect(LANES.map((l) => [nextLane(l, -1), nextLane(l, 1)])).toEqual([[null, 'master'], ['final', 'mix'], ['master', null]])
  })
})
