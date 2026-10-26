// Cuts the chosen generated logo (docs/plantas/logo/L01.png, Figma AI, 2026-10-24) into the files the
// app uses: the lockup with a transparent background, the bare icon, and the home-screen/tab icons.
// Run: node tools/logo-cut.mjs
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire('C:/Users/mario/Documents/personal/sites/portfolio/package.json')
const { chromium } = require('playwright')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.resolve(ROOT, '../../docs/plantas/logo/L01.png')
const OUT = path.join(ROOT, 'public')

const src = 'data:image/png;base64,' + (await readFile(SRC)).toString('base64')
const browser = await chromium.launch()
const page = await browser.newPage()
const files = await page.evaluate(async (src) => {
  const img = new Image()
  img.src = src
  await img.decode()
  const W = img.width, H = img.height
  const c = new OffscreenCanvas(W, H)
  const x = c.getContext('2d')
  x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, W, H)
  const px = d.data
  // The background is the corner colour. Pixels near it become transparent, with a soft edge.
  const bg = [px[0], px[1], px[2]]
  for (let i = 0; i < px.length; i += 4) {
    const dist = Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2])
    px[i + 3] = dist < 18 ? 0 : dist < 48 ? Math.round(255 * (dist - 18) / 30) : 255
  }
  x.putImageData(d, 0, 0)

  const solid = (cx, cy) => px[(cy * W + cx) * 4 + 3] > 40
  const colFilled = (cx) => { for (let cy = 0; cy < H; cy++) if (solid(cx, cy)) return true; return false }
  const box = (x0, x1) => {
    let t = H, b = 0
    for (let cx = x0; cx <= x1; cx++) for (let cy = 0; cy < H; cy++) if (solid(cx, cy)) { t = Math.min(t, cy); b = Math.max(b, cy) }
    return { x0, x1, t, b }
  }
  // Runs of filled columns; the widest empty gap splits the icon from the word.
  const runs = []
  let start = -1
  for (let cx = 0; cx < W; cx++) {
    const f = colFilled(cx)
    if (f && start < 0) start = cx
    if (!f && start >= 0) { runs.push([start, cx - 1]); start = -1 }
  }
  if (start >= 0) runs.push([start, W - 1])
  let split = 0, gap = 0
  for (let i = 1; i < runs.length; i++) if (runs[i][0] - runs[i - 1][1] > gap) { gap = runs[i][0] - runs[i - 1][1]; split = i }
  const all = box(runs[0][0], runs[runs.length - 1][1])
  const icon = box(runs[0][0], runs[split - 1][1])

  const word = box(runs[split][0], runs[runs.length - 1][1])
  // The R has no descender and no accent: its bottom row is the word's baseline.
  const baseline = box(runs[split][0], runs[split][1]).b
  // The lockup as generated floats the word mid-height, so the sprout's soil hangs a cap height
  // below the letters (Mario, 2026-10-26: "el logo está desalineado"). Rebuilt so the soil and
  // the baseline are one ground line: the can pours from above, everything stands on the same floor.
  // As generated, the drawing is 1.6 times the word's height and the word looked small in the app
  // bar ("dejalo bien", 2026-10-26). The drawing is scaled to the word's full height, accent to
  // descender, and still stands on the baseline.
  const lockup = (pad) => {
    const iw = icon.x1 - icon.x0 + 1, ih = icon.b - icon.t + 1
    const k = (word.b - word.t + 1) / ih
    const sw = iw * k, sh = ih * k
    const gap = 30
    const iconTop = baseline - sh // soil on the baseline
    const top = Math.min(iconTop, word.t), bottom = Math.max(baseline, word.b)
    const ww = word.x1 - word.x0 + 1, wh = word.b - word.t + 1
    const o = new OffscreenCanvas(Math.ceil(sw + gap + ww + pad * 2), Math.ceil(bottom - top + 1 + pad * 2))
    const ox = o.getContext('2d')
    ox.imageSmoothingQuality = 'high'
    ox.drawImage(c, icon.x0, icon.t, iw, ih, pad, iconTop - top + pad, sw, sh)
    ox.drawImage(c, word.x0, word.t, ww, wh, pad + sw + gap, word.t - top + pad, ww, wh)
    return o
  }
  const crop = (b, pad) => {
    const w = b.x1 - b.x0 + 1 + pad * 2, h = b.b - b.t + 1 + pad * 2
    const o = new OffscreenCanvas(w, h)
    o.getContext('2d').drawImage(c, b.x0 - pad, b.t - pad, w, h, 0, 0, w, h)
    return o
  }
  // A square tile: the icon centred on paper, at the given size and share of the tile.
  const tile = (size, share, fill) => {
    const ic = crop(icon, 0)
    const o = new OffscreenCanvas(size, size)
    const ox = o.getContext('2d')
    ox.fillStyle = fill
    ox.fillRect(0, 0, size, size)
    const s = size * share / Math.max(ic.width, ic.height)
    const w = ic.width * s, h = ic.height * s
    ox.imageSmoothingQuality = 'high'
    ox.drawImage(ic, (size - w) / 2, (size - h) / 2, w, h)
    return o
  }
  // Down to a height that is still sharp at 3x on the largest place it shows (the start screen).
  const fit = (o, h) => {
    const r = new OffscreenCanvas(Math.round(o.width * h / o.height), h)
    const rx = r.getContext('2d')
    rx.imageSmoothingQuality = 'high'
    rx.drawImage(o, 0, 0, r.width, r.height)
    return r
  }
  const png = async (o) => {
    const blob = await o.convertToBlob({ type: 'image/png' })
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(s)
  }
  return {
    'brand/logo.png': await png(fit(lockup(4), 240)),
    'brand/mark.png': await png(fit(crop(icon, 4), 240)),
    'icons/icon-512.png': await png(tile(512, 0.72, '#EEF0EB')),
    'icons/apple-touch-icon.png': await png(tile(180, 0.72, '#EEF0EB')),
    'icons/icon-32.png': await png(tile(32, 0.9, '#EEF0EB')),
    size: { all, icon, word, baseline, W, H },
  }
}, src)
await browser.close()

await mkdir(path.join(OUT, 'brand'), { recursive: true })
for (const [name, b64] of Object.entries(files)) {
  if (name === 'size') continue
  await writeFile(path.join(OUT, name), Buffer.from(b64, 'base64'))
}
console.log(JSON.stringify(files.size))
