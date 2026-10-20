import catalog from '../data/species.json'
import photos from '../data/species-photos.json'

/**
 * The care catalog: curated by hand from cited sources (ASPCA, NC State Extension, Missouri
 * Botanical Garden, RHS), one entry per species. Watering intervals are starting points, not
 * rules: `water.estimate` says so, and `water.check` is the test to trust. See
 * docs/plantas/catalogo.md for how it was built and what is still unverified.
 */

export type Light = 'sol-directo' | 'indirecta-brillante' | 'media' | 'baja-tolerada'
export type PetTox = 'toxica' | 'no-toxica' | 'sin-datos'

export interface Species {
  id: string
  latin: string
  common: string[]
  family: string | null
  wiki: string | null
  difficulty: 'facil' | 'media' | 'exigente' | null
  light: { level: Light | null; text: string | null }
  water: { warmDays: number | null; coldDays: number | null; estimate: boolean; check: string | null; text: string | null }
  mist: { recommended: boolean | null; everyDays: number | null; text: string | null }
  humidity: { level: 'baja' | 'media' | 'alta' | null; text: string | null }
  temperature: { minC: number | null; maxC: number | null; text: string | null }
  fertilize: { everyDays: number | null; months: number[] | null; text: string | null }
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

/** Accent- and case-insensitive search over common and Latin names. */
export function searchSpecies(q: string): Species[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
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

/** The fertiliser rests outside the growing months. True when this month is one of them. */
export function feedingSeason(s: Species | null, today: Date): boolean {
  return !s?.fertilize.months?.length || s.fertilize.months.includes(today.getMonth() + 1)
}
