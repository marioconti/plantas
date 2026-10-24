import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { byUrgency, longDate, shortDate, type Due, type PlantStatus } from '../lib/care.ts'
import { useGarden } from '../lib/store.tsx'
import { photoUrl } from '../lib/api.ts'
import { speciesById, speciesPhoto } from '../lib/species.ts'
import type { CareEvent } from '../lib/types.ts'
import { Empty, Header, Icon, RoundLink } from '../components/ui.tsx'
import { SyncNote } from './parts.tsx'
import './screens.css'
import './home.css'

const WEEKDAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const VIEW_KEY = 'regue.home.view'
const UNDO_MS = 6000

type View = 'rooms' | 'grid'
interface Room { name: string; list: PlantStatus[] }

/** A plant asks for water when its watering is late, past due, due today or never logged. */
const thirsty = (d: Due | null) => Boolean(d && ['late', 'check', 'today', 'never'].includes(d.kind))

/** "Living, ventana" and "Living, rincón" are the same room: the part before the comma. */
function roomOf(location: string): string {
  const r = location.split(',')[0].trim()
  return r ? r[0].toUpperCase() + r.slice(1) : 'Sin lugar'
}

/** Rooms in the order of their most urgent plant; plants inside keep the urgency order. */
function rooms(all: PlantStatus[]): Room[] {
  const map = new Map<string, PlantStatus[]>()
  for (const s of all) {
    const k = roomOf(s.plant.location)
    map.set(k, [...(map.get(k) ?? []), s])
  }
  return [...map].map(([name, list]) => ({ name, list }))
}

function readView(): View {
  try { return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'rooms' } catch { return 'rooms' }
}

export function GardenHome() {
  const { data, today, can, me } = useGarden()
  const { garden, plants, events } = data!
  const all = byUrgency(plants, events, today, garden)
  const byRoom = rooms(all)
  const [view, setView] = useState<View>(readView)
  const pick = (v: View) => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* the choice just won't be remembered */ }
  }
  const toWater = all.filter((s) => thirsty(s.water)).length
  const nextWater = all.map((s) => s.water).filter((d) => d && d.daysLeft > 0).sort((a, b) => a!.daysLeft - b!.daysLeft)[0]

  return (
    <div className="page has-tabs">
      <Header action={can.edit && plants.length > 0 ? <RoundLink to="nueva" icon="plus-bold" label="Agregar una planta" /> : undefined} />
      <main className="home">
        <section className="wrap home-top">
          <p className="home-date">{garden.name} · {WEEKDAY_LONG[today.getDay()]} {longDate(today)}</p>
          {plants.length > 0 && (
            <>
              <div className="home-count">
                <span className={`home-num${toWater ? ' is-due' : ''}`}>{toWater}</span>
                <span className="home-words">
                  {toWater === 1 ? 'pide agua' : toWater ? 'piden agua' : 'todas regadas'}
                  <span>{toWater === 0 && nextWater ? `la próxima, el ${shortDate(nextWater.due)}` : `de ${all.length} ${all.length === 1 ? 'planta' : 'plantas'}`}</span>
                </span>
              </div>
              <HouseStrip rooms={byRoom} />
              <div className="home-seg" role="tablist" aria-label="Cómo ver las plantas">
                <button type="button" role="tab" aria-selected={view === 'rooms'} className={view === 'rooms' ? 'on' : ''} onClick={() => pick('rooms')}>Por ambiente</button>
                <button type="button" role="tab" aria-selected={view === 'grid'} className={view === 'grid' ? 'on' : ''} onClick={() => pick('grid')}>Grilla</button>
              </div>
            </>
          )}
        </section>

        {!plants.length && <div className="wrap"><FirstPlant /></div>}

        <div className="home-rooms">
          {byRoom.map((r, i) => <RoomBlock key={r.name} room={r} n={i + 1} view={view} />)}
        </div>

        <div className="wrap">
          <SyncNote />
          <p className="muted garden-key">{me ? `Entraste como ${me.name}` : ''}{data!.garden.access === 'open' ? ' · jardín abierto' : ''}</p>
        </div>
      </main>
    </div>
  )
}

/** One square per plant, grouped by room: the whole house at a glance. */
function HouseStrip({ rooms }: { rooms: Room[] }) {
  return (
    <div className="strip" aria-hidden>
      {rooms.map((r) => (
        <div key={r.name}>
          <p>{r.list.map((s) => <i key={s.plant.id} className={`sq-${squareKind(s)}`} />)}</p>
          <span>{r.name}</span>
        </div>
      ))}
    </div>
  )
}

function squareKind(s: PlantStatus): string {
  const k = s.water?.kind
  return !k ? 'none' : k === 'late' ? 'late' : k === 'never' ? 'none' : thirsty(s.water) ? 'today' : 'ok'
}

function RoomBlock({ room, n, view }: { room: Room; n: number; view: View }) {
  const due = room.list.filter((s) => thirsty(s.water)).length
  return (
    <section className="room">
      <div className="wrap room-head">
        <span className="room-no">Ambiente {String(n).padStart(2, '0')}</span>
        <span className="room-stat">
          {room.list.length} {room.list.length === 1 ? 'planta' : 'plantas'}
          <b>{due ? `${due} ${due === 1 ? 'pide' : 'piden'} agua` : 'al día'}</b>
        </span>
        <h2 className="room-name" style={{ '--len': Math.max(room.name.length, 6) } as CSSProperties}>{room.name}</h2>
      </div>
      <div className={view === 'grid' ? 'room-grid' : 'room-list'}>
        {room.list.map((s) => view === 'grid' ? <PlantCard key={s.plant.id} s={s} /> : <PlantRow key={s.plant.id} s={s} />)}
      </div>
    </section>
  )
}

/**
 * The photo is the vase: blue up to the water left, with the surface as a white line. A
 * thirsty plant's photo dries out, and a red block hangs under it for every day it is late.
 */
function PhotoVase({ s, big = false }: { s: PlantStatus; big?: boolean }) {
  const { plant, water } = s
  const src = photoUrl(plant.photo) ?? speciesPhoto(plant.species)?.url ?? null
  const late = water && water.daysLeft < 0 ? Math.min(7, -water.daysLeft) : 0
  const dry = water?.kind === 'late' || water?.kind === 'check'
  const level = water && water.kind !== 'never' ? water.level : 0
  return (
    <div className={big ? 'pv pv-big' : 'pv'}>
      <div className={`pv-ph${dry ? ' is-dry' : ''}`}>
        {src ? <img src={src} alt="" loading="lazy" /> : <span className="pv-ini">{plant.name.trim()[0]?.toUpperCase()}</span>}
        {level > 0 && <span className="pv-water" style={{ height: `${Math.round(level * 100)}%` }} />}
      </div>
      {!big && late > 0 && water!.kind === 'late' && <div className="pv-debt">{Array.from({ length: late }, (_, i) => <i key={i} />)}</div>}
    </div>
  )
}

/** What the plant needs, in words: the line under its name. */
function needLine(s: PlantStatus): { text: string; late: boolean } {
  const w = s.water
  const extra = [s.mist, s.feed].filter((d) => d && ['late', 'check', 'today'].includes(d.kind))
    .map((d) => (d!.type === 'mist' ? 'rociar' : 'fertilizar'))
  const tail = extra.length ? ` · ${extra.join(' y ')}` : ''
  if (!w) return { text: `sin plan de riego${tail}`, late: false }
  if (w.kind === 'never') return { text: `cada ${w.interval} días · sin riegos anotados${tail}`, late: false }
  const ago = w.interval - w.daysLeft
  if (w.kind === 'late') return { text: `cada ${w.interval} días · hace ${ago}${tail}`, late: true }
  if (w.kind === 'check') return { text: `cada ${w.interval} días · tocá la tierra${tail}`, late: false }
  if (ago === 0) return { text: `regada hoy${w.last?.by_name ? ` por ${w.last.by_name}` : ''}${tail}`, late: false }
  return { text: `cada ${w.interval} días${tail}`, late: false }
}

function latinOf(s: PlantStatus): string {
  return speciesById(s.plant.species)?.latin ?? s.plant.species_text
}

function PlantRow({ s }: { s: PlantStatus }) {
  const line = needLine(s)
  return (
    <div className="prow">
      <Link to={`p/${s.plant.id}`} className="prow-link">
        <PhotoVase s={s} />
        <span className="prow-text">
          <span className="prow-name">{s.plant.name}</span>
          {latinOf(s) && <span className="prow-latin">{latinOf(s)}</span>}
          <span className={`prow-need${line.late ? ' is-late' : ''}`}>{line.text}</span>
        </span>
      </Link>
      <div className="prow-side"><WaterButton s={s} /></div>
    </div>
  )
}

function PlantCard({ s }: { s: PlantStatus }) {
  const w = s.water
  const tag = !w ? null
    : w.kind === 'late' ? { cls: 'late', num: String(-w.daysLeft), words: -w.daysLeft === 1 ? 'día tarde' : 'días tarde' }
    : w.kind === 'check' || w.kind === 'today' ? { cls: 'today', num: 'hoy', words: 'tocá la tierra' }
    : w.kind === 'never' ? null
    : { cls: '', num: String(w.daysLeft), words: w.daysLeft === 1 ? 'mañana' : 'días' }
  return (
    <div className="pcard">
      <Link to={`p/${s.plant.id}`} className="pcard-link">
        <PhotoVase s={s} big />
        {tag && <span className={`pcard-tag ${tag.cls}`}>{tag.num}<small>{tag.words}</small></span>}
      </Link>
      <div className="pcard-foot">
        <Link to={`p/${s.plant.id}`} className="pcard-text">
          <span className="prow-name">{s.plant.name}</span>
          <span className="prow-latin">{w ? (w.kind === 'never' ? 'sin riegos anotados' : `cada ${w.interval} días`) : 'sin plan'}</span>
        </Link>
        <WaterButton s={s} small />
      </div>
    </div>
  )
}

/**
 * Water from the list, without opening the plant: the button when it asks for water, the days
 * left when it doesn't. For six seconds after a tap the same button undoes it, like the big
 * button on the plant page, and a second tap within 400 ms is ignored. One component for all
 * three states, so the undo survives the plant leaving the "thirsty" state.
 */
function WaterButton({ s, small = false }: { s: PlantStatus; small?: boolean }) {
  const { log, unlog } = useGarden()
  const [done, setDone] = useState<CareEvent | null>(null)
  const lock = useRef(0)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const w = s.water
  if (!done && !thirsty(w)) {
    if (small) return null
    if (!w) return <span className="days"><b>—</b><small>sin plan</small></span>
    return <span className="days"><b>{w.daysLeft}</b><small>{w.daysLeft === 1 ? 'mañana' : 'días'}</small></span>
  }
  const tone = !w || done ? '' : w.kind === 'late' ? 'late' : w.kind === 'never' ? 'none' : ''
  const words = !w ? '' : w.kind === 'late' ? `${-w.daysLeft} d tarde` : w.kind === 'never' ? 'sin dato' : 'revisar'

  function tap() {
    if (Date.now() < lock.current) return
    lock.current = Date.now() + 400
    clearTimeout(timer.current)
    if (done) { unlog(done.id); setDone(null); return }
    setDone(log(s.plant.id, 'water'))
    timer.current = window.setTimeout(() => setDone(null), UNDO_MS)
  }

  return (
    <span className={small ? 'wb wb-sm' : 'wb'}>
      <button type="button" className={`wb-btn ${done ? 'is-undo' : tone}`} onClick={tap}
        aria-label={done ? `Deshacer el riego de ${s.plant.name}` : `Regué ${s.plant.name}`}>
        <Icon name={done ? 'clock-counter-clockwise-bold' : 'drop-fill'} size={small ? 20 : 26} />
      </button>
      {!small && <small className={`wb-words ${done ? 'undo' : tone}`}>{done ? 'deshacer' : words}</small>}
    </span>
  )
}

function FirstPlant() {
  return (
    <Empty title="Todavía no hay plantas">
      <p className="muted">Agregá la primera y después grabá su link en un tag NFC. Al acercar el teléfono a la maceta se abre su ficha.</p>
      <p><Link to="nueva" className="btn btn-primary"><Icon name="plus-bold" /> Agregar una planta</Link></p>
      <p><Link to="ajustes" className="btn btn-line">Cómo grabar los tags</Link></p>
    </Empty>
  )
}
