import type { IconName } from '../components/icon-data.ts'
import type { EventType } from './types.ts'

/** Everything the page says and draws about each kind of journal entry. */
export interface EventMeta {
  type: EventType
  /** "Regué": the button, in first person past, like the brand. */
  done: string
  /** "riego": the noun, for labels and the diary legend. */
  noun: string
  /** "regada": what the journal and the stamp say. */
  past: string
  icon: IconName
  /** CSS colour of its square in the diary. */
  color: string
  /** Text colour on top of that square. */
  on: string
}

export const EVENTS: Record<EventType, EventMeta> = {
  water: { type: 'water', done: 'Regué', noun: 'riego', past: 'regada', icon: 'drop-fill', color: 'var(--water)', on: '#fff' },
  mist: { type: 'mist', done: 'Rocié', noun: 'rocío', past: 'rociada', icon: 'spray-bottle-fill', color: 'var(--mist)', on: 'var(--ink)' },
  feed: { type: 'feed', done: 'Fertilicé', noun: 'fertilizante', past: 'fertilizada', icon: 'flask-fill', color: 'var(--feed)', on: 'var(--ink)' },
  repot: { type: 'repot', done: 'Trasplanté', noun: 'trasplante', past: 'trasplantada', icon: 'shovel-fill', color: 'var(--repot)', on: '#fff' },
  prune: { type: 'prune', done: 'Podé', noun: 'poda', past: 'podada', icon: 'scissors-fill', color: 'var(--leaf)', on: '#fff' },
  turn: { type: 'turn', done: 'La giré', noun: 'giro', past: 'girada', icon: 'arrows-clockwise-fill', color: 'var(--cell)', on: 'var(--ink)' },
  treat: { type: 'treat', done: 'La traté', noun: 'tratamiento', past: 'tratada', icon: 'first-aid-fill', color: 'var(--treat)', on: '#fff' },
  clean: { type: 'clean', done: 'Limpié hojas', noun: 'limpieza', past: 'hojas limpias', icon: 'sparkle-fill', color: 'var(--ok)', on: 'var(--ink)' },
  note: { type: 'note', done: 'Nota', noun: 'nota', past: 'nota', icon: 'note-pencil-fill', color: 'var(--surface)', on: 'var(--ink)' },
  photo: { type: 'photo', done: 'Foto', noun: 'foto', past: 'foto', icon: 'camera-fill', color: 'var(--photo)', on: '#fff' },
}

/** The order of the diary legend and of the "otra cosa" sheet. */
export const EVENT_ORDER: EventType[] = ['water', 'mist', 'feed', 'repot', 'prune', 'turn', 'treat', 'clean', 'note', 'photo']
