// Visual QA without touching the real database: serves dist/, answers the Supabase calls from
// an in-memory fake garden (sample data, clearly not real), drives every screen at 320, 390 and
// 1280 px, and saves screenshots plus overflow and console checks.
//   npm run build && node tools/qa.mjs [--only=plant]
// Writes to docs/qa/ (inside the repo, ignored by git) and prints what it measured.
import { createRequire } from 'node:module'
import http from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire('C:/Users/mario/Documents/personal/sites/portfolio/package.json')
const { chromium } = require('playwright')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'qa')
await mkdir(OUT, { recursive: true })
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7)
const photos = JSON.parse(await readFile(path.join(ROOT, 'src/data/species-photos.json'), 'utf8'))

// ---------------------------------------------------------------- static server for dist/
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' }
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/plantas\/?/, '/')
  if (p === '/') p = '/index.html'
  try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(path.join(ROOT, 'dist', p))) } catch { res.writeHead(404).end() }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}/`

// ---------------------------------------------------------------- the fake garden
const KEY = 'qaQAqaQAqaQAqaQAqaQA12'
const PASS = 'qa-owner-pass-0000000000000000'
const now = new Date()
const at = (daysAgo, h = 9) => { const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(h, 10, 0, 0); return d.toISOString() }
const plant = (id, name, species, location, water_warm, water_cold, mist_days, feed_days, extra = {}) => ({
  garden: KEY, id, name, species, species_text: '', location, water_warm, water_cold, mist_days, feed_days, notes: '', photo: null,
  acquired_on: null, archived: false, created_at: at(80), updated_at: at(1), ...extra,
})
const plants = [
  plant('helecho-01', 'Helecho del living', 'nephrolepis-exaltata', 'Living, ventana', 4, 7, 2, 30, { acquired_on: at(75).slice(0, 10), notes: 'Vino del vivero de Belgrano. Le gusta el baño cuando hay vapor.', photo: 'qa/helecho.webp' }),
  plant('potus', 'Potus', 'epipremnum-aureum', 'Cocina, estante', 7, 12, null, 30),
  plant('monstera', 'Monstera', 'monstera-deliciosa', 'Living, rincón', 7, 14, null, 30),
  plant('sansevieria', 'Sansevieria', 'dracaena-trifasciata', 'Pasillo', 14, 30, null, null),
  plant('calathea', 'Calathea', 'goeppertia-orbifolia', 'Dormitorio', 5, 8, null, null),
  plant('albahaca', 'Albahaca', 'ocimum-basilicum', 'Balcón', 2, 4, null, null),
  plant('ficus', 'Ficus de la abuela', null, 'Balcón', 7, 12, null, null, { species_text: 'Ficus benjamina' }),
]
let n = 0
const ev = (plantId, type, daysAgo, extra = {}) => ({ id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, garden: KEY, plant: plantId, type, at: at(daysAgo), note: '', photo: null, by_name: n % 3 ? 'Mario' : 'Juan', ...extra })
const SEED = [
  ...[49, 44, 40, 35, 31, 26, 22, 17, 13, 7].map((d) => ev('helecho-01', 'water', d)),
  ...[48, 46, 43, 41, 39, 36, 34, 30, 27, 25, 21, 18, 16, 12, 10, 8, 3, 1].map((d) => ev('helecho-01', 'mist', d, { at: at(d, 19) })),
  ev('helecho-01', 'feed', 20), ev('helecho-01', 'note', 15, { note: 'Dos frondas nuevas arriba. Puntas secas abajo.' }),
  ev('helecho-01', 'photo', 60, { photo: 'qa/helecho.webp' }), ev('helecho-01', 'photo', 30, { photo: 'qa/helecho.webp' }), ev('helecho-01', 'photo', 2, { photo: 'qa/helecho.webp' }),
  ...[41, 34, 27, 20, 14, 7].map((d) => ev('potus', 'water', d)), ev('potus', 'prune', 25),
  ...[40, 32, 25, 18, 11, 5].map((d) => ev('monstera', 'water', d)), ev('monstera', 'turn', 9), ev('monstera', 'repot', 45),
  ...[44, 30, 15].map((d) => ev('sansevieria', 'water', d)),
  ...[30, 25, 19, 14].map((d) => ev('calathea', 'water', d)), ev('calathea', 'treat', 12, { note: 'Arañuela. Jabón potásico.' }),
  ...[6, 4, 2, 0].map((d) => ev('albahaca', 'water', d, { at: at(d, 8) })),
]
let events = []
const garden = { key: KEY, name: 'Casa', cold_months: [5, 6, 7, 8, 9], access: 'private', open_until: null, created_at: at(80) }
const me = { role: 'owner', name: 'Mario' }

async function rpc(fn, a) {
  if (fn === 'plants_load') {
    if (a.p_pass !== PASS) return [400, { message: 'private garden' }]
    return [200, { me, garden, plants, events }]
  }
  if (fn === 'plants_log') { events = [{ ...ev(a.p_plant, a.p_type, 0), id: a.p_id, at: a.p_at, note: a.p_note }, ...events]; return [200, events[0]] }
  if (fn === 'plants_unlog') { events = events.filter((e) => e.id !== a.p_id); return [204, null] }
  if (fn === 'plants_passes_list') return [200, [
    { id: 'p1', name: 'Mario', role: 'owner', expires_at: null, revoked: false, created_at: at(80), last_used_at: at(0), mine: true },
    { id: 'p2', name: 'Juan', role: 'owner', expires_at: null, revoked: false, created_at: at(79), last_used_at: at(1), mine: false },
    { id: 'p3', name: 'Laura (vacaciones)', role: 'guest', expires_at: at(-6), revoked: false, created_at: at(3), last_used_at: null, mine: false },
  ]]
  if (fn === 'plants_history') return [200, []]
  if (fn === 'plants_save_plant') return [200, a.p]
  return [200, null]
}

// ---------------------------------------------------------------- the run
const browser = await chromium.launch()
const shots = [
  ['start', '#/'],
  ['private', `#/g/${KEY}`, { noPass: true }],
  ['garden', `#/g/${KEY}`],
  ['plant', `#/g/${KEY}/p/helecho-01`],
  ['plant-full', `#/g/${KEY}/p/helecho-01`, { full: true }],
  ['plant-watered', `#/g/${KEY}/p/helecho-01`, { tap: 'Regué' }],
  ['plant-ok', `#/g/${KEY}/p/monstera`],
  ['plant-new-tag', `#/g/${KEY}/p/jazmin-01`],
  ['diary', `#/g/${KEY}/diario`, { full: true }],
  ['guide', `#/g/${KEY}/guia`],
  ['species', `#/g/${KEY}/guia/nephrolepis-exaltata`, { full: true }],
  ['edit', `#/g/${KEY}/p/helecho-01/editar`, { full: true }],
  ['new', `#/g/${KEY}/nueva`],
  ['settings', `#/g/${KEY}/ajustes`, { full: true }],
  ['brand', '#/marca', { full: true }],
].filter(([name]) => !only || name.startsWith(only))

for (const W of [320, 390, 1280]) {
  for (const [name, hash, opt = {}] of shots) {
    const desk = W >= 900
    events = SEED.map((e) => ({ ...e }))
    const ctx = await browser.newContext({ viewport: { width: W, height: desk ? 860 : 844 }, deviceScaleFactor: desk ? 1 : 2, isMobile: !desk, hasTouch: !desk, locale: 'es-AR', reducedMotion: 'reduce' })
    await ctx.addInitScript(([k, p, noPass]) => { if (!noPass) localStorage.setItem(`plants:pass:${k}`, p) }, [KEY, PASS, Boolean(opt.noPass)])
    await ctx.route(/supabase\.co\/rest\/v1\/rpc\//, async (route) => {
      const fn = route.request().url().split('/rpc/')[1]
      const [status, body] = await rpc(fn, JSON.parse(route.request().postData() || '{}'))
      await route.fulfill({ status, contentType: 'application/json', body: body == null ? '' : JSON.stringify(body) })
    })
    await ctx.route(/supabase\.co\/storage\/v1\/object\/public\//, (route) => route.fulfill({ status: 302, headers: { location: photos['nephrolepis-exaltata'].url } }))
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(BASE + hash, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    if (opt.tap) { await page.getByRole('button', { name: opt.tap, exact: false }).first().click(); await page.waitForTimeout(500) }
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    await page.screenshot({ path: path.join(OUT, `${W}-${name}.png`), fullPage: Boolean(opt.full) })
    console.log(`${W} ${name}: overflow ${over}px${errors.length ? ` · ERRORS ${errors.join(' | ')}` : ''}`)
    await ctx.close()
  }
}
await browser.close()
server.close()
