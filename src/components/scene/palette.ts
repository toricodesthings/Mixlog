import { useEffect, useState, type CSSProperties } from 'react'

import { previewUrl } from '../../lib/files'

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
const clampK = (v: number) => Math.max(0, Math.min(1.25, v))
/** 0 below `edge0`, 1 above `edge1`, eased between: how much a share of colour counts toward the room's own k. */
const smoothstep = (edge0: number, edge1: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** The strongest hue bin with at least 1% of pixels at C ≥ 0.08 (a small, strong colour: a red coat, a neon sign),
 *  for the night's lights when the cover itself is otherwise grey. Its own mean hue, unweighted. */
function spotOf(count: number[], sx: number[], sy: number[], seen: number): number | null {
  let best = -1
  for (let i = 0; i < count.length; i++) if (count[i] / seen >= 0.01 && (best < 0 || count[i] > count[best])) best = i
  return best < 0 ? null : ((Math.atan2(sy[best], sx[best]) * 180) / Math.PI + 360) % 360
}

/**
 * An artwork's colours, as the room's custom properties: `--art-h` (its dominant hue: the accent and the glow),
 * `--art-h2` (a second strong hue, or a neighbour of the first: the sky and the grounds), `--art-k` (how colourful it
 * is, continuous, 0–1.25) and, when the cover is otherwise grey, `--art-spot-h`/`--art-spot-k` (a small strong colour
 * for the night's lights alone). Hue comes from OKLCH hue bins weighted by chroma, so a blue cover with a red stripe
 * reads blue, not purple; `--art-k` follows how much of the cover is actually colourful (`cover`, a smoothstep of its
 * share) and the cover's overall tint (`cast`, the mean OKLab a/b over every opaque pixel), so a grey cover gives a
 * grey room instead of borrowing a hue, and a cover lit in one strong colour stays fully coloured. Only hue and
 * chroma are taken; app.css sets every lightness, so text keeps its contrast whatever the cover. A cover with no
 * dominant hue and no real cast either (noise, a rainbow: colourful everywhere, cancelling out) returns nothing, so
 * the id's hue stands in at full colour.
 */
export function paletteOf(pixels: Uint8ClampedArray): Record<string, string> {
  const weight = new Array<number>(BINS).fill(0)
  const x = new Array<number>(BINS).fill(0)
  const y = new Array<number>(BINS).fill(0)
  const chroma = new Array<number>(BINS).fill(0)
  const spotCount = new Array<number>(BINS).fill(0)
  const spotX = new Array<number>(BINS).fill(0)
  const spotY = new Array<number>(BINS).fill(0)
  let seen = 0
  let coverCount = 0
  let castCount = 0
  let castX = 0
  let castY = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    seen++
    const [L, C, h] = oklch(pixels[i], pixels[i + 1], pixels[i + 2])
    const rad = (h * Math.PI) / 180
    const [cos, sin] = [Math.cos(rad), Math.sin(rad)]
    if (C >= 0.04) coverCount++
    if (C >= 0.08) {
      const bin = Math.floor(h / BIN) % BINS
      spotCount[bin]++
      spotX[bin] += cos
      spotY[bin] += sin
    }
    if (L < 0.12 || L > 0.95) continue
    castX += C * cos
    castY += C * sin
    castCount++
    if (C < 0.04) continue
    const w = C * (1 - Math.abs(L - 0.6))
    const bin = Math.floor(h / BIN) % BINS
    weight[bin] += w
    x[bin] += cos * w
    y[bin] += sin * w
    chroma[bin] += C * w
  }
  if (!seen) return { '--art-k': '0' }

  const share = coverCount / seen
  const cover = smoothstep(0.03, 0.3, share)
  const castC = castCount ? Math.hypot(castX, castY) / castCount : 0
  const castH = castCount ? ((Math.atan2(castY, castX) * 180) / Math.PI + 360) % 360 : 0
  const spot = spotOf(spotCount, spotX, spotY, seen)

  const smooth = weight.map((w, i) => weight[ring(i - 1)] * 0.25 + w * 0.5 + weight[ring(i + 1)] * 0.25)
  const mean = smooth.reduce((sum, w) => sum + w, 0) / BINS
  const top = smooth.indexOf(Math.max(...smooth))
  // Hues all the way round (noise, a rainbow) cancel out; two strong ones don't, they stand far above the mean.
  const spread = mean ? Math.hypot(x.reduce((a, b) => a + b, 0), y.reduce((a, b) => a + b, 0)) / (mean * BINS) : 0
  const noDominant = !mean || smooth[top] < mean * 1.5 || (spread < 0.2 && smooth[top] < mean * 2.5)

  const withSpot = (props: Record<string, string>, k: number) =>
    k < 0.35 && spot !== null ? { ...props, '--art-spot-h': spot.toFixed(1), '--art-spot-k': '0.75' } : props

  if (noDominant) {
    // Genuinely colourful, all the way round, in no one hue: the title's own colours stand in, at full strength.
    if (share >= 0.3) return {}
    const k = clampK(castC / 0.05)
    return withSpot({ '--art-h': castH.toFixed(1), '--art-h2': castH.toFixed(1), '--art-k': k.toFixed(2) }, k)
  }

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
  const k = clampK(Math.max((c / 0.12) * cover, castC / 0.05))
  return withSpot(
    { '--art-h': h.toFixed(1), '--art-h2': (second < 0 ? (h + 340) % 360 : hueAround(second)).toFixed(1), '--art-k': k.toFixed(2) },
    k,
  )
}

/** The artwork's colours (above); none until it has loaded, so the title's colours stand in. */
function useArtPalette(url: string | null) {
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

/** A release's own hue, stable across visits and a rename: cyan through violet to magenta, the Blue Hour family.
 *  Keyed by id, not title, so a rename never changes the room or the monogram (1.3.0). */
export function idHue(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) | 0
  return 180 + (Math.abs(hash) % 150)
}

/**
 * The room a release's artwork makes (`.art-room` in app.css): its hues and how colourful it is, as custom properties
 * for whatever stands in that room (a release's pages, the listening room). The id's hue stands in until the artwork
 * is read, or when the release has no artwork at all.
 */
export function useRoomStyle(id: string, artworkId: string | null) {
  const palette = useArtPalette(artworkId && previewUrl(artworkId))
  const hue = idHue(id)
  return { '--art-h': hue, '--art-h2': hue - 20, '--art-k': 1, ...palette } as CSSProperties
}
