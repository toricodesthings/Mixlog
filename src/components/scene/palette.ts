import { useEffect, useState, type CSSProperties } from 'react'

import { fileUrl } from '../../lib/files'

/** The side of the square the artwork is sampled at, unsmoothed, so its colours aren't averaged into mud first. */
const SAMPLE = 48
const BINS = 24
const BIN = 360 / BINS

/** sRGB (0–255) to OKLCH: [lightness 0–1, chroma, hue in degrees]. */
function oklch(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, Math.hypot(a, bb), ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360]
}

const ring = (i: number) => (i + BINS) % BINS

/**
 * An artwork's colours, as the room's custom properties: `--art-h` (its dominant hue: the accent and the glow),
 * `--art-h2` (a second strong hue, or a neighbour of the first: the sky and the grounds) and `--art-k` (how colourful
 * it is, 0.3–1.25). Hue comes from OKLCH hue bins weighted by chroma, so a blue cover with a red stripe reads blue, not
 * purple. Only hue and chroma are taken; app.css sets every lightness, so text keeps its contrast whatever the cover.
 * A grey cover keeps the title's hue, faintly (`--art-k` alone); a cover with no dominant hue (noise, a rainbow) keeps
 * the title's colours entirely (nothing).
 */
export function paletteOf(pixels: Uint8ClampedArray): Record<string, string> {
  const weight = new Array<number>(BINS).fill(0)
  const x = new Array<number>(BINS).fill(0)
  const y = new Array<number>(BINS).fill(0)
  const chroma = new Array<number>(BINS).fill(0)
  let seen = 0
  let colourful = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    seen++
    const [L, C, h] = oklch(pixels[i], pixels[i + 1], pixels[i + 2])
    if (C < 0.04 || L < 0.12 || L > 0.95) continue
    colourful++
    const w = C * (1 - Math.abs(L - 0.6))
    const bin = Math.floor(h / BIN) % BINS
    weight[bin] += w
    x[bin] += Math.cos((h * Math.PI) / 180) * w
    y[bin] += Math.sin((h * Math.PI) / 180) * w
    chroma[bin] += C * w
  }
  if (!seen || colourful / seen < 0.12) return { '--art-k': '0.3' }

  const smooth = weight.map((w, i) => weight[ring(i - 1)] * 0.25 + w * 0.5 + weight[ring(i + 1)] * 0.25)
  const mean = smooth.reduce((sum, w) => sum + w, 0) / BINS
  const top = smooth.indexOf(Math.max(...smooth))
  // Hues all the way round (noise, a rainbow) cancel out; two strong ones don't, they stand far above the mean.
  const spread = Math.hypot(x.reduce((a, b) => a + b, 0), y.reduce((a, b) => a + b, 0)) / (mean * BINS)
  if (smooth[top] < mean * 1.5 || (spread < 0.2 && smooth[top] < mean * 2.5)) return {}

  /** The weighted circular mean hue of a bin and its neighbours. */
  const hueAround = (bin: number) => {
    const near = [ring(bin - 1), bin, ring(bin + 1)]
    const sum = (list: number[]) => near.reduce((total, i) => total + list[i], 0)
    return ((Math.atan2(sum(y), sum(x)) * 180) / Math.PI + 360) % 360
  }
  const h = hueAround(top)
  const apart = (i: number) => Math.min(Math.abs(i - top), BINS - Math.abs(i - top)) * BIN >= 40
  const second = smooth.reduce((best, w, i) => (apart(i) && w >= smooth[top] * 0.25 && (best < 0 || w > smooth[best]) ? i : best), -1)
  const near = [ring(top - 1), top, ring(top + 1)]
  const c = near.reduce((sum, i) => sum + chroma[i], 0) / near.reduce((sum, i) => sum + weight[i], 0)
  return {
    '--art-h': h.toFixed(1),
    '--art-h2': (second < 0 ? (h + 340) % 360 : hueAround(second)).toFixed(1),
    '--art-k': Math.min(1.25, Math.max(0.3, c / 0.12)).toFixed(2),
  }
}

/** The artwork's colours (above); none until it has loaded, so the title's colours stand in. */
export function useArtPalette(url: string | null) {
  const [palette, setPalette] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    setPalette(null)
    if (!url) return
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = SAMPLE
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return
      context.imageSmoothingEnabled = false
      context.drawImage(image, 0, 0, SAMPLE, SAMPLE)
      setPalette(paletteOf(context.getImageData(0, 0, SAMPLE, SAMPLE).data))
    }
    image.src = url
    return () => {
      image.onload = null
    }
  }, [url])
  return palette
}

/** A title's own hue, stable across visits: cyan through violet to magenta, the Blue Hour family. */
export function titleHue(title: string) {
  let hash = 0
  for (const char of title) hash = (hash * 31 + char.codePointAt(0)!) | 0
  return 180 + (Math.abs(hash) % 150)
}

/**
 * The room a release's artwork makes (`.art-room` in app.css): its hues and how colourful it is, as custom properties
 * for whatever stands in that room (a release's pages, the listening room). The title's hues stand in until the
 * artwork is read, or when it has no colour of its own.
 */
export function useRoomStyle(title: string, artworkId: string | null) {
  const palette = useArtPalette(artworkId && fileUrl(artworkId))
  const hue = titleHue(title)
  return { '--art-h': hue, '--art-h2': hue - 20, '--art-k': 1, ...palette } as CSSProperties
}
