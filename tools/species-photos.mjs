// Asks Wikipedia for the lead photo of every species in the catalog and writes its URL,
// author and licence to src/data/species-photos.json, so the page shows a real, credited
// photo without calling Wikipedia at run time.
//   node tools/species-photos.mjs
// Two batched requests in all: Wikipedia rate-limits anonymous clients hard.
import { readFile, writeFile } from 'node:fs/promises'

const species = JSON.parse(await readFile(new URL('../src/data/species.json', import.meta.url), 'utf8'))
const API = 'https://en.wikipedia.org/w/api.php'
const UA = { 'User-Agent': 'regue-plant-care/0.1 (personal project; https://github.com/marioconti)' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const strip = (html) => (html ?? '')
  .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/\s+/g, ' ').trim()

async function query(params) {
  const url = new URL(API)
  Object.entries({ action: 'query', format: 'json', formatversion: '2', ...params }).forEach(([k, v]) => url.searchParams.set(k, v))
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: UA })
    if (res.ok) return res.json()
    console.log(`  ${res.status}, waiting ${20 * (attempt + 1)} s`)
    await sleep(20_000 * (attempt + 1))
  }
  throw new Error('Wikipedia keeps refusing; try again later')
}

const withWiki = species.filter((s) => s.wiki)
const pages = await query({ redirects: '1', titles: withWiki.map((s) => s.wiki).join('|'), prop: 'pageimages', piprop: 'name' })
const { redirects = [], normalized = [] } = pages.query
const resolve = (t) => {
  for (const n of normalized) if (n.from === t) t = n.to
  for (const r of redirects) if (r.from === t) t = r.to
  return t
}
const fileOf = new Map(pages.query.pages.filter((p) => p.pageimage).map((p) => [p.title, p.pageimage]))

await sleep(3000)
const files = [...new Set(fileOf.values())]
const infos = await query({ titles: files.map((f) => `File:${f}`).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '900' })
const infoOf = new Map(infos.query.pages.map((p) => [p.title.replace(/^File:/, '').replace(/ /g, '_'), p.imageinfo?.[0]]))

const out = {}
for (const s of withWiki) {
  const file = fileOf.get(resolve(s.wiki))
  const info = file && infoOf.get(file.replace(/ /g, '_'))
  if (!info) { console.log(`no photo: ${s.id}`); continue }
  const m = info.extmetadata ?? {}
  out[s.id] = {
    url: info.thumburl ?? info.url,
    width: info.thumbwidth ?? info.width,
    height: info.thumbheight ?? info.height,
    page: info.descriptionurl,
    artist: strip(m.Artist?.value) || 'Autor sin dato',
    license: strip(m.LicenseShortName?.value) || 'Licencia sin dato',
    licenseUrl: m.LicenseUrl?.value ?? null,
  }
}
await writeFile(new URL('../src/data/species-photos.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
console.log(`${Object.keys(out).length}/${species.length} photos`)
for (const [id, p] of Object.entries(out)) console.log(`${id}: ${p.license} · ${p.artist.slice(0, 40)} · ${p.width}x${p.height}`)
