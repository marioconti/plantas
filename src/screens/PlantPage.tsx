import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ago, dueShort, regularity, shortDate, shortDay, statusOf, type Due } from '../lib/care.ts'
import { EVENTS } from '../lib/events.ts'
import { feedingSeason, speciesById, speciesPhoto } from '../lib/species.ts'
import { useGarden } from '../lib/store.tsx'
import { api, photoUrl } from '../lib/api.ts'
import type { CareEvent, EventType, Plant } from '../lib/types.ts'
import { Cell, Cells, Empty, Header, Icon } from '../components/ui.tsx'
import { CountUp, Vase } from '../components/Vase.tsx'
import { Tablature } from '../components/Tablature.tsx'
import { ActionBar, Sheet, Stamp, useToast } from '../components/actions.tsx'
import { CareCells, DontList, SpeciesLink, SyncNote, ToxLine, usePhotoPicker } from './parts.tsx'
import './screens.css'

const OTHER: EventType[] = ['feed', 'repot', 'prune', 'turn', 'treat', 'clean']

export function PlantPage() {
  const { plantId } = useParams()
  const { data, today, log, unlog, savePlant, key, can } = useGarden()
  const { garden, plants, events } = data!
  const plant = plants.find((p) => p.id === plantId)
  const [stamp, setStamp] = useState<CareEvent | null>(null)
  const [sheet, setSheet] = useState<'more' | 'note' | null>(null)
  const [note, setNote] = useState('')
  const [toast, showToast] = useToast()
  const photo = usePhotoPicker(plantId!, (path) => {
    log(plantId!, 'photo', { photo: path })
    if (plant && !plant.photo && can.edit) savePlant({ ...plant, photo: path })
    showToast('Foto guardada en el progreso')
  })

  const onLog = useCallback((t: EventType) => {
    const e = log(plantId!, t)
    setStamp(e)
    return e
  }, [log, plantId])
  const onUndo = useCallback((e: CareEvent) => {
    unlog(e.id)
    setStamp(null)
  }, [unlog])

  if (!plant) return <UnknownTag id={plantId!} />

  const st = statusOf(plant, events, today, garden)
  const sp = speciesById(plant.species)
  const main: Due | null = st.water ?? st.worst
  const number = plants.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).findIndex((p) => p.id === plant.id) + 1
  const mine = events.filter((e) => e.plant === plant.id)
  const primary: EventType[] = ['water', ...(plant.mist_days || sp?.mist.recommended ? (['mist'] as EventType[]) : [])]
  const cover = photoUrl(plant.photo) ?? speciesPhoto(plant.species)?.url ?? null
  const coverIsOwn = Boolean(plant.photo)

  return (
    <div className="page">
      <Header back={{ to: `/g/${key}`, label: 'Plantas' }} right={`Nº ${String(number).padStart(2, '0')} · ${plant.id}`} />
      <main>
        <div className="wrap plant-title">
          <div>
            <h1 className="h1">{plant.name}</h1>
            {(sp || plant.species_text) && <p className="latin">{sp?.latin ?? plant.species_text}</p>}
            {plant.location && <p className="mono muted plant-where"><Icon name="potted-plant-bold" size={15} /> {plant.location}</p>}
          </div>
          {cover && (
            <figure className={`plant-cover${coverIsOwn ? '' : ' is-species'}`}>
              <img src={cover} alt={plant.name} loading="lazy" />
              {!coverIsOwn && <figcaption className="mono">foto de la especie</figcaption>}
            </figure>
          )}
        </div>

        {main && <StateBlock due={main} st={st} stamp={stamp} />}

        <div className="wrap">
          <SecondaryLines st={st} plant={plant} />
          <Cells>
            <Cell label="Último riego" icon="drop-bold">
              {st.water?.last ? ago(st.water.last.at, today) : 'Nunca'}
              {st.water?.last && <small>{shortDate(st.water.last.at)}</small>}
            </Cell>
            <Cell label="Último rocío" icon="spray-bottle-bold">
              {st.mist?.last ? ago(st.mist.last.at, today) : lastAny(mine, 'mist', today)}
              {st.mist?.last && <small>{shortDate(st.mist.last.at)}</small>}
            </Cell>
            <Cell label="Frecuencia" icon="calendar-blank-bold">
              {plant.water_warm ? `Cada ${plant.water_warm} días` : 'Sin plan'}
              <small>{plant.water_cold && plant.water_cold !== plant.water_warm ? `En frío cada ${plant.water_cold}` : 'Todo el año igual'}</small>
            </Cell>
            <Cell label="En casa desde" icon="leaf-bold">
              {plant.acquired_on ? shortDate(plant.acquired_on + 'T12:00') : ago(plant.created_at, today)}
              <small>{plant.acquired_on ? ago(plant.acquired_on + 'T12:00', today) : 'desde que se dio de alta'}</small>
            </Cell>
          </Cells>

          <div className="quick">
            <button type="button" className="quick-btn" onClick={() => onLog('feed')}><Icon name="flask-fill" size={22} style={{ color: 'var(--feed)' }} />Fertilicé</button>
            <button type="button" className="quick-btn" onClick={photo.pick} disabled={photo.busy}><Icon name="camera-fill" size={22} />{photo.busy ? 'Subiendo…' : 'Foto'}</button>
            <button type="button" className="quick-btn" onClick={() => setSheet('note')}><Icon name="note-pencil-fill" size={22} />Nota</button>
            <button type="button" className="quick-btn" onClick={() => setSheet('more')}><Icon name="plus-bold" size={22} />Otra cosa</button>
          </div>
          {photo.el}
          {photo.error && <p className="sync mono">{photo.error}</p>}
          <SyncNote />
        </div>

        <section className="section">
          <div className="wrap section-head"><h2 className="label">Las últimas tres semanas</h2><Link to={`/g/${key}/diario`} className="label">Diario →</Link></div>
          <Tablature rows={[{ status: st, events: mine }]} today={today} past={20} future={7} />
        </section>

        <Progress plant={plant} events={mine} />

        {sp && (
          <section className="section wrap">
            <div className="section-head"><h2 className="label">Cuidados de {sp.common[0]}</h2></div>
            <CareCells s={sp} />
            {sp.water.check && <p className="check-text">{sp.water.check}</p>}
            <div className="stack" style={{ marginTop: 'var(--s5)' }}>
              <ToxLine s={sp} />
              <div>
                <div className="section-head"><h3 className="label">Qué no hacer</h3></div>
                <DontList items={sp.dont} max={3} />
              </div>
              <SpeciesLink s={sp} />
            </div>
          </section>
        )}

        {plant.notes && (
          <section className="section wrap">
            <div className="section-head"><h2 className="label">Notas</h2></div>
            <p className="notes">{plant.notes}</p>
          </section>
        )}

        <Journal plant={plant} events={mine} />

        {can.edit && (
          <div className="wrap section">
            <Link to="editar" className="btn btn-line btn-block"><Icon name="pencil-simple-bold" /> Editar planta</Link>
          </div>
        )}
      </main>

      <ActionBar types={primary} onLog={onLog} onUndo={onUndo} />
      {toast}

      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="¿Qué le hiciste?">
        <div className="more-grid">
          {OTHER.map((t) => (
            <button key={t} type="button" className="more-btn" onClick={() => { onLog(t); setSheet(null); showToast(`${EVENTS[t].done} · anotado`) }}>
              <i style={{ background: EVENTS[t].color, color: EVENTS[t].on }}><Icon name={EVENTS[t].icon} size={20} /></i>
              {EVENTS[t].done}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'note'} onClose={() => setSheet(null)} title="Nota">
        <form onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; log(plant.id, 'note', { note: note.trim() }); setNote(''); setSheet(null); showToast('Nota guardada') }}>
          <label className="field">
            <span className="label">Qué viste o qué hiciste</span>
            <textarea rows={4} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hoja nueva arriba. Puntas secas en dos hojas." autoFocus />
          </label>
          <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 'var(--s4)' }}>Guardar nota</button>
        </form>
      </Sheet>
    </div>
  )
}

function lastAny(events: CareEvent[], type: EventType, today: Date) {
  const e = events.filter((x) => x.type === type).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
  return e ? ago(e.at, today) : 'Nunca'
}

/** The block that answers "¿la riego hoy?" in two seconds: the number, its words, the vase. */
function StateBlock({ due, st, stamp }: { due: Due; st: ReturnType<typeof statusOf>; stamp: CareEvent | null }) {
  const cls = due.kind === 'late' ? 'st-late' : due.kind === 'today' || due.kind === 'never' ? 'st-today' : 'st-ok'
  const verb = due.type === 'water' ? 'riego' : due.type === 'mist' ? 'rocío' : 'fertilizante'
  const words = due.kind === 'never'
    ? 'sin registro todavía'
    : due.daysLeft < 0 ? (due.daysLeft === -1 ? 'día tarde' : 'días tarde')
      : due.daysLeft === 0 ? 'toca hoy' : due.daysLeft === 1 ? 'día para el próximo' : 'días para el próximo'
  return (
    <section className={`state ${cls}`} aria-live="polite">
      <div className="wrap state-in">
        <div className="state-read">
          <p className="label state-label">{verb}</p>
          <p className="display state-num">{due.kind === 'never' ? '—' : <CountUp value={due.daysLeft} />}</p>
          <p className="state-words">{words}</p>
          <p className="mono state-date">
            {due.kind === 'never' ? 'Registrá el primero y empieza la cuenta'
              : due.daysLeft < 0 ? `Tocaba el ${shortDay(due.due)}`
                : due.daysLeft === 0 ? `Cada ${due.interval} días` : `El ${shortDay(due.due)} · cada ${due.interval} días`}
          </p>
        </div>
        <div className="state-vases">
          <div><Vase due={st.water ?? due} /><span className="label">{(st.water ?? due).daysLeft < 0 ? `−${Math.min(7, -(st.water ?? due).daysLeft)} d` : 'Riego'}</span></div>
          {st.mist && <div><Vase due={st.mist} kind="mist" /><span className="label">Rocío</span></div>}
        </div>
        <Stamp event={stamp} />
      </div>
    </section>
  )
}

function SecondaryLines({ st, plant }: { st: ReturnType<typeof statusOf>; plant: Plant }) {
  const { today } = useGarden()
  const sp = speciesById(plant.species)
  const lines: { icon: 'spray-bottle-bold' | 'flask-bold'; text: string; kind: string }[] = []
  if (st.mist) lines.push({ icon: 'spray-bottle-bold', kind: st.mist.kind, text: `Rocío ${dueShort(st.mist)}${st.mist.kind !== 'never' ? ` · ${shortDay(st.mist.due)}` : ''} · cada ${st.mist.interval} días` })
  if (st.feed) {
    const rest = !feedingSeason(sp, today)
    lines.push({ icon: 'flask-bold', kind: rest ? 'ok' : st.feed.kind, text: rest ? 'Fertilizante en pausa: no es temporada de crecimiento' : `Fertilizante ${dueShort(st.feed)} · cada ${st.feed.interval} días` })
  }
  if (!lines.length) return null
  return (
    <ul className="lines">
      {lines.map((l) => <li key={l.icon} className={`line-${l.kind}`}><Icon name={l.icon} size={18} /><span>{l.text}</span></li>)}
    </ul>
  )
}

/** How the plan held up: real rhythm against the planned one, and the photo timeline. */
function Progress({ plant, events }: { plant: Plant; events: CareEvent[] }) {
  const { data, today } = useGarden()
  const r = regularity(plant, events, today, data!.garden)
  const photos = events.filter((e) => e.photo).sort((a, b) => (a.at < b.at ? -1 : 1))
  const born = new Date(plant.acquired_on ? plant.acquired_on + 'T12:00' : plant.created_at)
  const [open, setOpen] = useState<CareEvent | null>(null)
  if (!r.count && !photos.length) return null
  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head"><h2 className="label">Progreso · 90 días</h2></div>
        <Cells>
          <Cell label="Riegos">{r.count}<small>en 90 días</small></Cell>
          <Cell label="Ritmo real">{r.meanGap != null ? `Cada ${String(r.meanGap).replace('.', ',')} d` : '—'}<small>plan: cada {plant.water_warm ?? '—'} d</small></Cell>
          <Cell label="A tiempo">{r.onTime != null ? `${Math.round(r.onTime * 100)} %` : '—'}<small>hasta un día de tolerancia</small></Cell>
          <Cell label="Racha">{r.streak}<small>{r.streak === 1 ? 'riego seguido a tiempo' : 'riegos seguidos a tiempo'}</small></Cell>
        </Cells>
      </div>
      {photos.length > 0 && (
        <div className="photos" aria-label="Fotos de la planta en el tiempo">
          {photos.map((p) => (
            <button key={p.id} type="button" className="photo" onClick={() => setOpen(p)}>
              <img src={photoUrl(p.photo)!} alt="" loading="lazy" />
              <span className="mono">{shortDate(p.at)} · día {Math.max(1, Math.round((new Date(p.at).getTime() - born.getTime()) / 86_400_000) + 1)}</span>
            </button>
          ))}
        </div>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? shortDate(open.at) : ''}>
        {open && <img src={photoUrl(open.photo)!} alt="" className="photo-big" />}
        {open?.note && <p style={{ marginTop: 12 }}>{open.note}</p>}
      </Sheet>
    </section>
  )
}

/** The journal: every entry, newest first, with a way to take one out. Older pages load on demand. */
function Journal({ plant, events }: { plant: Plant; events: CareEvent[] }) {
  const { auth, unlog } = useGarden()
  const [more, setMore] = useState<CareEvent[]>([])
  const [done, setDone] = useState(false)
  const [armed, setArmed] = useState<string | null>(null)
  const shown = [...events, ...more.filter((m) => !events.some((e) => e.id === m.id))].sort((a, b) => (a.at < b.at ? 1 : -1))
  const [limit, setLimit] = useState(12)
  const list = shown.slice(0, limit)
  async function loadMore() {
    if (limit < shown.length) return setLimit(limit + 24)
    const oldest = shown[shown.length - 1]?.at ?? null
    const older = await api.history(auth, plant.id, oldest, 50).catch(() => [])
    if (older.length < 50) setDone(true)
    setMore((m) => [...m, ...older])
    setLimit(limit + 24)
  }
  return (
    <section className="section wrap">
      <div className="section-head"><h2 className="label">Libreta</h2><span className="label">{shown.length}{done ? '' : '+'}</span></div>
      {!list.length && <p className="muted">Todavía no hay nada anotado. Lo que registres aparece acá.</p>}
      <ul className="journal">
        {list.map((e) => (
          <li key={e.id} className={e.pending ? 'is-pending' : ''}>
            <span className="mono j-date">{shortDate(e.at).toUpperCase()}</span>
            <i className="j-sq" style={{ background: EVENTS[e.type].color, color: EVENTS[e.type].on }}><Icon name={EVENTS[e.type].icon} size={12} /></i>
            <span className="j-text">
              {EVENTS[e.type].past}{e.by_name ? ` · ${e.by_name}` : ''}{e.pending ? ' · sin enviar' : ''}
              {e.note && <em>{e.note}</em>}
            </span>
            <button
              type="button" className={`j-x${armed === e.id ? ' is-armed' : ''}`}
              aria-label={armed === e.id ? 'Tocá de nuevo para borrar' : 'Borrar'}
              onClick={() => { if (armed === e.id) { unlog(e.id); setArmed(null) } else { setArmed(e.id); setTimeout(() => setArmed((a) => (a === e.id ? null : a)), 3000) } }}
            >
              {armed === e.id ? 'Borrar' : <Icon name="x-bold" size={14} />}
            </button>
          </li>
        ))}
      </ul>
      {!done && shown.length >= 12 && <button type="button" className="btn btn-line btn-block" onClick={loadMore} style={{ marginTop: 'var(--s4)' }}>Ver más</button>}
    </section>
  )
}

/** A tag whose plant does not exist yet: the tag can be written first and the plant set up here. */
function UnknownTag({ id }: { id: string }) {
  const { key, can } = useGarden()
  return (
    <div className="page no-actions">
      <Header back={{ to: `/g/${key}`, label: 'Plantas' }} right={id} />
      <main className="wrap">
        <Empty title="Este tag todavía no tiene planta">
          <p className="muted">El link apunta a <b className="mono">{id}</b>, que no está en el jardín. Dala de alta y desde ahora este tag abre su ficha.</p>
          {can.edit
            ? <p><Link to={`/g/${key}/nueva?id=${encodeURIComponent(id)}`} className="btn btn-primary"><Icon name="plus-bold" /> Dar de alta {id}</Link></p>
            : <p className="muted">Pedile a quien cuida el jardín que la dé de alta.</p>}
        </Empty>
      </main>
    </div>
  )
}
