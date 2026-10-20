// Builds src/data/species.json from the researched parts (one JSON array per research batch).
//   node tools/build-catalog.mjs <folder with part-*.json> [notes.md]
//
// No source gives watering in days: they say how dry the soil gets before watering
// (`water.dryTo`). The days the app starts from are derived here from that rule, with the
// table below, and marked `estimate`. A species whose source does give days keeps them and is
// marked `estimate: false`. Days an earlier catalog suggested are kept in `water.legacy`, so a
// plant set up with them still reads as "estimado" and not as "lo elegiste vos".
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '..', 'src', 'data', 'species.json')
const [dir, notesFile] = process.argv.slice(2)
if (!dir) throw new Error('usage: node tools/build-catalog.mjs <folder> [notes.md]')

/** [warm months, cold months], in days. One table for the whole guide, so the estimate is consistent. */
const DRY_DAYS = {
  humeda: [3, 6],
  superficie: [6, 10],
  mitad: [9, 16],
  seca: [14, 28],
  'muy-seca': [21, 40],
}

const previous = new Map(JSON.parse(await readFile(OUT, 'utf8')).map((s) => [s.id, s]))
const files = (await readdir(dir)).filter((f) => /^part-\d+\.json$/.test(f)).sort()
const species = []
const notes = []
const problems = []

for (const f of files) {
  for (const s of JSON.parse(await readFile(path.join(dir, f), 'utf8'))) {
    const w = s.water
    const fromSource = w.warmDays != null
    // A source may give only one of the two (e.g. "every one or two months" in winter): keep it, derive the other.
    if (!fromSource && w.dryTo && DRY_DAYS[w.dryTo]) [w.warmDays, w.coldDays] = [DRY_DAYS[w.dryTo][0], w.coldDays ?? DRY_DAYS[w.dryTo][1]]
    // Sources that give days give them for the growing season. Winter keeps the table's ratio.
    if (fromSource && w.coldDays == null && w.dryTo && DRY_DAYS[w.dryTo]) {
      const [warm, cold] = DRY_DAYS[w.dryTo]
      w.coldDays = Math.round((w.warmDays * cold) / warm)
    }
    w.estimate = !fromSource
    if (!w.dryTo && !fromSource) problems.push(`${s.id}: no dryTo and no days`)

    const old = previous.get(s.id)?.water
    const legacy = [...(old?.legacy ?? [])]
    if (old?.warmDays != null && (old.warmDays !== w.warmDays || (old.coldDays ?? null) !== (w.coldDays ?? null))) legacy.push([old.warmDays, old.coldDays ?? null])
    if (legacy.length) w.legacy = legacy
    else delete w.legacy

    const urls = new Set(s.sources.map((x) => x.url))
    for (const k of ['light', 'water', 'mist', 'humidity', 'temperature', 'fertilize', 'soil', 'pot', 'repot', 'toxicity']) {
      const src = s[k]?.source
      if (src && !urls.has(src)) problems.push(`${s.id}: ${k}.source not in sources`)
    }
    if (/missouribotanicalgarden/i.test(JSON.stringify(s.sources))) problems.push(`${s.id}: cites Missouri Botanical Garden`)
    if (species.some((x) => x.id === s.id)) problems.push(`${s.id}: duplicated`)

    if (s._notes) notes.push(`- **${s.common[0]}** (*${s.latin}*). ${s._notes}`)
    delete s._notes
    species.push(s)
  }
}

const lost = [...previous.keys()].filter((id) => !species.some((s) => s.id === id))
if (lost.length) problems.push(`species that were in the catalog and are missing now: ${lost.join(', ')}`)
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

await writeFile(OUT, JSON.stringify(species, null, 1) + '\n')
if (notesFile) await writeFile(notesFile, `# Notas de la investigación del catálogo\n\n> Generado por \`tools/build-catalog.mjs\`. Dudas y criterios de cada ficha, que la app no muestra.\n\n${notes.join('\n')}\n`)
console.log(`${species.length} species written to src/data/species.json (${species.filter((s) => s.water.estimate).length} with estimated days)`)
