import type { CareEvent, Garden, Plant, ScheduledType } from './types.ts'

/**
 * When is the next watering, misting or feeding due — computed on read, never stored.
 *
 *     next = day of the latest entry of that type + the interval for today's season
 *
 * Everything works on calendar days in the phone's own time zone: watering at 23:50 and
 * looking again at 00:10 is "yesterday", not "20 minutes ago". The phone that taps the tag is
 * at home, so its zone is the garden's.
 */

const DAY = 86_400_000

/** Midnight of the local calendar day of `d`, as a timestamp. */
export function dayStart(d: Date | string | number): number {
  const x = new Date(d)
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
}

/** Whole calendar days from `a` to `b` (positive when `b` is later). Safe across DST changes. */
export function daysBetween(a: Date | string | number, b: Date | string | number): number {
  return Math.round((dayStart(b) - dayStart(a)) / DAY)
}

export function addDays(d: Date | string | number, n: number): Date {
  const x = new Date(dayStart(d))
  x.setDate(x.getDate() + n)
  return x
}

export function isColdMonth(today: Date, garden: Pick<Garden, 'cold_months'>): boolean {
  return garden.cold_months.includes(today.getMonth() + 1)
}

/** Days between two entries of this type for this plant today, or null when it is not tracked. */
export function intervalFor(plant: Plant, type: ScheduledType, today: Date, garden: Pick<Garden, 'cold_months'>): number | null {
  if (type === 'water') {
    if (plant.water_warm == null) return null
    return isColdMonth(today, garden) ? plant.water_cold ?? plant.water_warm : plant.water_warm
  }
  if (type === 'mist') return plant.mist_days
  return plant.feed_days
}

export type DueKind = 'late' | 'today' | 'soon' | 'ok' | 'never'

export interface Due {
  type: ScheduledType
  kind: DueKind
  /** Days until it is due: negative when late, 0 today. `never` counts as 0. */
  daysLeft: number
  interval: number
  last: CareEvent | null
  /** The day it is (or was) due. Today for `never`. */
  due: Date
  /** How full the gauge is: 1 right after, 0 on the due day and after it. */
  level: number
}

/** "Soon" is tomorrow, or the day after for plants on a long interval. */
const SOON_DAYS = (interval: number) => (interval >= 7 ? 2 : 1)

export function lastOf(events: CareEvent[], plant: string, type: ScheduledType): CareEvent | null {
  let best: CareEvent | null = null
  for (const e of events) {
    if (e.plant === plant && e.type === type && (!best || e.at > best.at)) best = e
  }
  return best
}

export function dueFor(
  plant: Plant, type: ScheduledType, events: CareEvent[], today: Date, garden: Pick<Garden, 'cold_months'>,
): Due | null {
  const interval = intervalFor(plant, type, today, garden)
  if (interval == null) return null
  const last = lastOf(events, plant.id, type)
  if (!last) return { type, kind: 'never', daysLeft: 0, interval, last: null, due: new Date(dayStart(today)), level: 0 }
  const daysLeft = interval - daysBetween(last.at, today)
  const kind: DueKind = daysLeft < 0 ? 'late' : daysLeft === 0 ? 'today' : daysLeft <= SOON_DAYS(interval) ? 'soon' : 'ok'
  return {
    type, kind, daysLeft, interval, last,
    due: addDays(last.at, interval),
    level: Math.max(0, Math.min(1, daysLeft / interval)),
  }
}

export interface PlantStatus {
  plant: Plant
  water: Due | null
  mist: Due | null
  feed: Due | null
  /** The most pressing of the three, which decides the plant's place in the list. */
  worst: Due | null
  group: 'late' | 'today' | 'next'
}

const SCHEDULED: ScheduledType[] = ['water', 'mist', 'feed']

/** Lower is more urgent. Watering outranks misting outranks feeding when the days tie. */
function weight(d: Due): number {
  const typeRank = d.type === 'water' ? 0 : d.type === 'mist' ? 0.1 : 0.2
  return d.daysLeft + typeRank
}

export function statusOf(plant: Plant, events: CareEvent[], today: Date, garden: Pick<Garden, 'cold_months'>): PlantStatus {
  const [water, mist, feed] = SCHEDULED.map((t) => dueFor(plant, t, events, today, garden))
  // A watering never logged is urgent: the plant may be thirsty. Mist or feed never logged is
  // just a schedule not started yet, and must not push the plant up the list.
  let worst: Due | null = null
  for (const d of [water, mist, feed]) {
    if (!d || (d.kind === 'never' && d.type !== 'water')) continue
    if (!worst || weight(d) < weight(worst)) worst = d
  }
  const group = !worst ? 'next' : worst.kind === 'late' ? 'late' : worst.kind === 'today' || worst.kind === 'never' ? 'today' : 'next'
  return { plant, water, mist, feed, worst, group }
}

/** Every active plant, most urgent first. Plants with nothing scheduled go last, by name. */
export function byUrgency(plants: Plant[], events: CareEvent[], today: Date, garden: Pick<Garden, 'cold_months'>): PlantStatus[] {
  return plants
    .filter((p) => !p.archived)
    .map((p) => statusOf(p, events, today, garden))
    .sort((a, b) => {
      if (!a.worst || !b.worst) return a.worst ? -1 : b.worst ? 1 : a.plant.name.localeCompare(b.plant.name, 'es')
      return weight(a.worst) - weight(b.worst) || a.plant.name.localeCompare(b.plant.name, 'es')
    })
}

// ---------------------------------------------------------------- progress

export interface Regularity {
  /** Waterings in the window. */
  count: number
  /** Average real days between waterings, or null with fewer than two. */
  meanGap: number | null
  /** Share of waterings that came no later than one day after they were due. */
  onTime: number | null
  /** Longest stretch of consecutive on-time waterings, ending at the latest. */
  streak: number
}

/**
 * How the plan held up in the last `windowDays`. On time is judged against the interval that
 * applied on the day of the previous watering, so a change of season does not count as a miss.
 */
export function regularity(
  plant: Plant, events: CareEvent[], today: Date, garden: Pick<Garden, 'cold_months'>, windowDays = 90,
): Regularity {
  const from = addDays(today, -windowDays).getTime()
  const all = events.filter((e) => e.plant === plant.id && e.type === 'water').sort((a, b) => (a.at < b.at ? -1 : 1))
  const inWindow = all.filter((e) => new Date(e.at).getTime() >= from)
  const gaps: { gap: number; ok: boolean }[] = []
  for (let i = 1; i < all.length; i++) {
    if (new Date(all[i].at).getTime() < from) continue
    const gap = daysBetween(all[i - 1].at, all[i].at)
    const planned = intervalFor(plant, 'water', new Date(all[i - 1].at), garden)
    gaps.push({ gap, ok: planned == null || gap <= planned + 1 })
  }
  let streak = 0
  for (let i = gaps.length - 1; i >= 0 && gaps[i].ok; i--) streak++
  return {
    count: inWindow.length,
    meanGap: gaps.length ? Math.round((gaps.reduce((s, g) => s + g.gap, 0) / gaps.length) * 10) / 10 : null,
    onTime: gaps.length ? gaps.filter((g) => g.ok).length / gaps.length : null,
    streak,
  }
}

// ---------------------------------------------------------------- words

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "lun 26" */
export function shortDay(d: Date | string): string {
  const x = new Date(d)
  return `${WEEKDAYS[x.getDay()]} ${x.getDate()}`
}

/** "lun 26 oct" */
export function shortDate(d: Date | string): string {
  const x = new Date(d)
  return `${WEEKDAYS[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]}`
}

/** "19 de octubre" */
export function longDate(d: Date | string): string {
  const x = new Date(d)
  return `${x.getDate()} de ${MONTHS_LONG[x.getMonth()]}`
}

export function monthShort(m: number): string {
  return MONTHS[m - 1]
}

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas" */
export function ago(d: Date | string, today: Date): string {
  const n = daysBetween(d, today)
  if (n <= 0) return 'hoy'
  if (n === 1) return 'ayer'
  if (n < 14) return `hace ${n} días`
  if (n < 60) return `hace ${Math.round(n / 7)} semanas`
  return `hace ${Math.round(n / 30)} meses`
}

/** The words next to the big number: "días tarde", "toca hoy", "días para regar". */
export function dueWords(d: Due): { number: string; words: string } {
  const verb = d.type === 'water' ? 'regar' : d.type === 'mist' ? 'rociar' : 'fertilizar'
  if (d.kind === 'never') return { number: '—', words: 'sin registro' }
  if (d.daysLeft < 0) return { number: String(-d.daysLeft), words: d.daysLeft === -1 ? 'día tarde' : 'días tarde' }
  if (d.daysLeft === 0) return { number: '0', words: `toca ${verb} hoy` }
  return { number: String(d.daysLeft), words: d.daysLeft === 1 ? `día para ${verb}` : `días para ${verb}` }
}

/** One-line state for pills and rows: "3 días tarde", "hoy", "mañana", "en 4 días", "sin registro". */
export function dueShort(d: Due): string {
  if (d.kind === 'never') return 'sin registro'
  if (d.daysLeft < 0) return d.daysLeft === -1 ? '1 día tarde' : `${-d.daysLeft} días tarde`
  if (d.daysLeft === 0) return 'hoy'
  if (d.daysLeft === 1) return 'mañana'
  return `en ${d.daysLeft} días`
}
