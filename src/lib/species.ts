import catalog from '../data/species.json'
import photos from '../data/species-photos.json'
import { intervalFor, monthShort } from './care.ts'
import type { CareEvent, Garden, Plant } from './types.ts'

/**
 * The care catalog: curated from cited sources (NC State Extension, RHS, ASPCA, the GCABA
 * toxic-plant annex, university extensions, INTA), one entry per species, every block with
 * the source it came from. No source gives watering in days: they say how dry the soil should
 * get (`water.dryTo`). The days are derived from that by `tools/build-catalog.mjs` and marked
 * `estimate`. See docs/plantas/catalogo.md for how it was built and what is still unverified.
 */

export type Light = 'sol-directo' | 'indirecta-brillante' | 'media' | 'baja-tolerada'
export type PetTox = 'toxica' | 'no-toxica' | 'sin-datos'
export type DryTo = 'humeda' | 'superficie' | 'mitad' | 'seca' | 'muy-seca'
export type Category = 'follaje' | 'flor' | 'suculenta' | 'cactus' | 'aromatica' | 'huerta' | 'frutal' | 'trepadora' | 'helecho' | 'palmera' | 'orquidea'

type Src = { source?: string | null }

export interface Species {
  id: string
  latin: string
  common: string[]
  family: string | null
  wiki: string | null
  native?: boolean
  place?: 'interior' | 'exterior' | 'ambos'
  category?: Category
  difficulty: 'facil' | 'media' | 'exigente' | null
  light: { level: Light | null; text: string | null } & Src
  water: {
    warmDays: number | null; coldDays: number | null; estimate: boolean; check: string | null; text: string | null
    dryTo?: DryTo | null
    /** Days an earlier version of the guide suggested, so plants set up with them still read as "estimado". */
    legacy?: [number, number | null][]
  } & Src
  mist: { recommended: boolean | null; everyDays: number | null; text: string | null } & Src
  humidity: { level: 'baja' | 'media' | 'alta' | null; text: string | null } & Src
  temperature: { minC: number | null; maxC: number | null; text: string | null } & Src
  fertilize: { everyDays: number | null; months: number[] | null; text: string | null } & Src
  soil?: { mix: string | null; text: string | null } & Src
  pot?: { drainage: 'imprescindible' | 'importante' | 'normal' | null; text: string | null } & Src
  repot?: { everyYears: number | null; months: number[] | null; text: string | null } & Src
  toxicity: { cats: PetTox | null; dogs: PetTox | null; people: string | null; text: string | null; source: string | null }
  precautions: string[]
  dont: string[]
  problems: { symptom: string; cause: string; fix: string }[]
  sources: { title: string; url: string }[]
  unverified: string[]
}

export interface SpeciesPhoto {
  url: string
  width: number
  height: number
  page: string
  artist: string
  license: string
  licenseUrl: string | null
}

export const SPECIES = (catalog as unknown as Species[]).slice().sort((a, b) => a.common[0].localeCompare(b.common[0], 'es'))
const BY_ID = new Map(SPECIES.map((s) => [s.id, s]))
const PHOTOS = photos as Record<string, SpeciesPhoto>

export function speciesById(id: string | null | undefined): Species | null {
  return id ? BY_ID.get(id) ?? null : null
}

export function speciesPhoto(id: string | null | undefined): SpeciesPhoto | null {
  return id ? PHOTOS[id] ?? null : null
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Accent- and case-insensitive search over common and Latin names. */
export function searchSpecies(q: string): Species[] {
  const n = norm(q.trim())
  if (!n) return SPECIES
  return SPECIES.filter((s) => [...s.common, s.latin].some((x) => norm(x).includes(n)))
}

export const LIGHT_WORDS: Record<Light, { label: string; level: number }> = {
  'sol-directo': { label: 'Sol directo', level: 5 },
  'indirecta-brillante': { label: 'Indirecta brillante', level: 4 },
  media: { label: 'Media', level: 3 },
  'baja-tolerada': { label: 'Tolera poca luz', level: 2 },
}

/** How dry the soil gets before the next watering: the rule the sources actually give. */
export const DRY_WORDS: Record<DryTo, string> = {
  humeda: 'Mantené la tierra apenas húmeda, sin dejarla secar',
  superficie: 'Regá cuando los primeros 2 o 3 cm de tierra estén secos',
  mitad: 'Regá cuando la mitad de la maceta esté seca',
  seca: 'Regá cuando la tierra esté seca del todo',
  'muy-seca': 'Regá cuando la tierra esté seca del todo y hayan pasado unos días más',
}

export const CATEGORY_WORDS: Record<Category, string> = {
  follaje: 'Follaje', flor: 'Con flor', suculenta: 'Suculentas', cactus: 'Cactus', aromatica: 'Aromáticas',
  huerta: 'Huerta', frutal: 'Frutales', trepadora: 'Trepadoras', helecho: 'Helechos', palmera: 'Palmeras', orquidea: 'Orquídeas',
}

/** [9, 10, 11] -> "sep, oct y nov" */
export function monthsWords(m: number[]): string {
  const w = m.map(monthShort)
  return w.length > 1 ? `${w.slice(0, -1).join(', ')} y ${w[w.length - 1]}` : w.join('')
}

/** The fertiliser rests outside the growing months. True when this month is one of them. */
export function feedingSeason(s: Species | null, today: Date): boolean {
  return !s?.fertilize.months?.length || s.fertilize.months.includes(today.getMonth() + 1)
}

/** "plants.ces.ncsu.edu" -> "NC State". The short name shown next to a number. */
export function sourceName(url: string | null | undefined): string | null {
  if (!url) return null
  const host = new URL(url).hostname.replace(/^www\./, '')
  const known: [RegExp, string][] = [
    [/ncsu\.edu$/, 'NC State'], [/rhs\.org\.uk$/, 'RHS'], [/aspca\.org$/, 'ASPCA'], [/buenosaires\.gob\.ar$/, 'GCABA'],
    [/ufl\.edu$|flvc\.org$/, 'UF/IFAS'], [/clemson\.edu$/, 'Clemson'], [/uconn\.edu$/, 'UConn'], [/iastate\.edu$/, 'Iowa State'],
    [/inta\.gob\.ar$/, 'INTA'], [/psu\.edu$/, 'Penn State'], [/umn\.edu$/, 'U. de Minnesota'], [/sinavimo\.gob\.ar$/, 'SINAVIMO'],
  ]
  return known.find(([re]) => re.test(host))?.[1] ?? host
}

// ---------------------------------------------------------------- where a number comes from

/** The journal line written when someone accepts the suggested interval. */
export const LEARNED_NOTE = 'Plan de riego ajustado a tus riegos: cada '

export type Origin =
  | { kind: 'none' }
  | { kind: 'guide'; sp: Species }
  | { kind: 'source'; sp: Species; source: string | null }
  | { kind: 'user' }
  | { kind: 'learned' }

/**
 * Where today's watering interval comes from, so no number on screen is anonymous:
 * our estimate from the guide, a source that gives days literally, the person, or the
 * person's own waterings (an accepted suggestion, recorded as a journal line).
 */
export function waterOrigin(plant: Plant, events: CareEvent[], today: Date, garden: Pick<Garden, 'cold_months'>): Origin {
  const days = intervalFor(plant, 'water', today, garden)
  if (days == null) return { kind: 'none' }
  const learned = events
    .filter((e) => e.plant === plant.id && e.type === 'note' && e.note.startsWith(LEARNED_NOTE))
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0]
  if (learned && parseInt(learned.note.slice(LEARNED_NOTE.length), 10) === days) return { kind: 'learned' }
  const sp = speciesById(plant.species)
  if (sp) {
    const pairs: [number | null, number | null][] = [[sp.water.warmDays, sp.water.coldDays], ...(sp.water.legacy ?? [])]
    const same = pairs.some(([w, c]) => w === plant.water_warm && (c ?? null) === (plant.water_cold ?? null))
    if (same) return sp.water.estimate ? { kind: 'guide', sp } : { kind: 'source', sp, source: sp.water.source ?? null }
  }
  return { kind: 'user' }
}

export function originWords(o: Origin): string {
  switch (o.kind) {
    case 'none': return 'sin dato'
    case 'guide': return 'estimado'
    case 'source': return `según ${sourceName(o.source) ?? 'la fuente'}`
    case 'user': return 'lo elegiste vos'
    case 'learned': return 'aprendido de tus riegos'
  }
}
