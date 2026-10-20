// End to end against the REAL database: creates a garden named "qa_e2e" through the start
// screen, adds a plant, taps Regué, reloads and checks the watering survived, then makes a
// guest pass and checks a phone without a pass sees "privado". Delete the qa_e2e garden after.
//   npm run build && node tools/e2e.mjs
import { createRequire } from 'node:module'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire('C:/Users/mario/Documents/personal/sites/portfolio/package.json')
const { chromium } = require('playwright')
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/plantas\/?/, '/')
  if (p === '/') p = '/index.html'
  try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(path.join(ROOT, 'dist', p))) } catch { res.writeHead(404).end() }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}/`
const ok = (c, m) => console.log(`${c ? 'PASS' : 'FAIL'} ${m}`)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-AR' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(BASE + '#/', { waitUntil: 'networkidle' })
await page.getByPlaceholder('Las plantas de casa').fill('qa_e2e')
await page.getByPlaceholder('Mario').fill('QA')
await page.getByRole('button', { name: 'Crear jardín' }).click()
await page.waitForURL(/#\/g\/[^/]+\/ajustes/)
const key = page.url().match(/#\/g\/([^/]+)/)[1]
ok(true, `garden created ${key}`)
await page.getByText('Pases').first().waitFor()
ok(await page.getByText('QA · este teléfono').waitFor({ timeout: 10000 }).then(() => true, () => false), 'owner pass listed as this phone')

await page.goto(BASE + `#/g/${key}/nueva`)
await page.getByPlaceholder('Buscar: potus, helecho, monstera…').fill('helecho')
await page.getByRole('button', { name: /Helecho de Boston/ }).first().click()
await page.getByRole('button', { name: 'Guardar planta' }).click()
await page.waitForURL(/#\/g\/[^/]+\/p\//)
const plantId = page.url().split('/p/')[1]
ok(Boolean(plantId), `plant created ${plantId}`)
await page.waitForTimeout(1500)
await page.getByRole('button', { name: 'Regué' }).click()
ok(await page.getByRole('button', { name: 'Deshacer' }).isVisible(), 'button turns into Deshacer')
await page.waitForTimeout(2500)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
ok(await page.getByText('regada · QA').first().isVisible(), 'watering survives a reload, signed QA')

const other = await browser.newContext({ viewport: { width: 390, height: 844 } })
const p2 = await other.newPage()
await p2.goto(BASE + `#/g/${key}/p/${plantId}`, { waitUntil: 'networkidle' })
await p2.waitForTimeout(1500)
ok(await p2.getByText('Este jardín es privado').isVisible(), 'a phone without a pass sees it is private')
ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
await browser.close()
server.close()
