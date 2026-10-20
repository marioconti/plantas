// Renders the app icon (the "é" with its level bar, white on green) to PNG at the sizes the
// page links: 32 (favicon), 180 (apple-touch-icon) and 512.
//   node tools/render-icons.mjs
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const require = createRequire('C:/Users/mario/Documents/personal/sites/portfolio/package.json')
const { chromium } = require('playwright')
const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '..', 'public', 'icons')
const browser = await chromium.launch()
for (const [size, name] of [[512, 'icon-512.png'], [180, 'apple-touch-icon.png'], [32, 'icon-32.png']]) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: size / 512 })
  await page.goto(pathToFileURL(path.join(HERE, 'icon.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(OUT, name) })
  await page.close()
}
await browser.close()
console.log('icons written to public/icons')
