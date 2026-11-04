import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { initSync, measure_seekable, Pump } from '#meter'

const RATE = 48_000

// The committed pkg/, as the browser and the Worker load it.
beforeAll(() => {
  initSync({ module: readFileSync(new URL('../../../meter/pkg/mixlog_meter_bg.wasm', import.meta.url)) })
})

/** 24-bit / 48 kHz stereo sine at −23 dBFS. */
function wav(seconds: number): Uint8Array {
  const frames = seconds * RATE
  const out = new Uint8Array(44 + frames * 6)
  const view = new DataView(out.buffer)
  const text = (at: number, s: string) => [...s].forEach((c, i) => (out[at + i] = c.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + frames * 6, true); text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true)
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 6, true); view.setUint16(32, 6, true); view.setUint16(34, 24, true)
  text(36, 'data'); view.setUint32(40, frames * 6, true)
  const a = 10 ** (-23 / 20)
  for (let n = 0; n < frames; n++) {
    const x = Math.round(a * Math.sin((2 * Math.PI * 1000 * n) / RATE) * 8_388_607)
    for (const c of [0, 1]) {
      const at = 44 + n * 6 + c * 3
      out[at] = x & 0xff; out[at + 1] = (x >> 8) & 0xff; out[at + 2] = (x >> 16) & 0xff
    }
  }
  return out
}

const seekable = (bytes: Uint8Array, hint: string) =>
  measure_seekable(bytes.length, (at: number, len: number) => bytes.subarray(at, at + len), hint)

describe('meter (committed pkg)', () => {
  const bytes = wav(20)

  it('reads a −23 dBFS sine as −23.0 LUFS', () => {
    const a = seekable(bytes, 'wav')
    expect(a.format).toEqual({ codec: 'pcm', rate: RATE, bits: 24, channels: 2, kbps: null })
    expect(a.ms).toBe(20_000)
    expect(Math.abs(a.lufs + 23)).toBeLessThanOrEqual(0.1)
    expect(a.wave).toHaveLength(256)
  })

  it('reads the same through Pump in 1 MB chunks', () => {
    const pump = new Pump('wav')
    for (let at = 0; at < bytes.length; at += 1 << 20) pump.push(bytes.subarray(at, at + (1 << 20)))
    expect(pump.finish()).toEqual(seekable(bytes, 'wav'))
  })

  it('matches ffmpeg on the test master', () => {
    // ffmpeg -i src/server/fixtures/test-master.mp3 -af ebur128=peak=true -f null -  →  I: −10.7 LUFS
    const mp3 = new Uint8Array(readFileSync(new URL('../../../src/server/fixtures/test-master.mp3', import.meta.url)))
    const a = seekable(mp3, 'mp3')
    expect(a.format.codec).toBe('mp3')
    expect(Math.abs(a.lufs + 10.7)).toBeLessThanOrEqual(0.2)
  })

  it('calls bytes it can’t decode unreadable, without crashing', () => {
    expect(() => seekable(new Uint8Array(10_000).fill(7), 'ogg')).toThrow('unreadable')
  })
})
