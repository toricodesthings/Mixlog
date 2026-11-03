import { expect, it } from 'vitest'

import { sentOf, sizeOf, timeLeft } from '#/components/uploads/progress'

it('says sizes, what’s sent, and the time left once it can judge', () => {
  expect([sizeOf(300), sizeOf(48.2 * 1024 ** 2), sizeOf(1.24 * 1024 ** 3)]).toEqual(['1 KB', '48.2 MB', '1.24 GB'])
  expect(sentOf(0.25, 48 * 1024 ** 2)).toBe('12.0 of 48.0 MB')
  expect([timeLeft(10, 100, 2), timeLeft(10, 100, 4), timeLeft(1, 100, 10), timeLeft(100, 100, 9)]).toEqual([null, '35 s left', '17 min left', null])
})

it('sends only audio to a lane, and only lossless files to the Final lane: the first as the final, the rest as masters', async () => {
  const { sortDrop } = await import('#/components/uploads/use-lane-upload')
  const f = (name: string) => new File(['x'], name)
  const sent = (files: File[], lane: 'final' | 'mix') => {
    const { send, note } = sortDrop(files, lane)
    return [send.map((s) => `${s.file.name}→${s.target}`), note]
  }
  expect(sent([f('a.mp3'), f('cover.png')], 'mix')).toEqual([['a.mp3→mix'], 'One file isn’t audio, so it was left out.'])
  expect(sent([f('a.wav'), f('b.flac')], 'final')).toEqual([['a.wav→final', 'b.flac→master'], 'a.wav is the final; the other 1 went to Masters.'])
  expect(sent([f('a.mp3')], 'final')).toEqual([[], 'A test can’t be the final. Drop its WAV, AIFF or FLAC.'])
})
