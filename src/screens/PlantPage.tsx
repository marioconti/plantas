import { useCallback, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ago, daysBetween, dueShort, intervalFor, regularity, shortDate, shortDay, statusOf, suggestInterval, type Due, type Suggestion } from '../lib/care.ts'
import { EVENTS } from '../lib/events.ts'
import { DRY_WORDS, LEARNED_NOTE, feedingSeason, originWords, sourceName, speciesById, speciesPhoto, waterOrigin, type Origin } from '../lib/species.ts'
import { useGarden } from '../lib/store.tsx'
import { api, photoUrl } from '../lib/api.ts'
import type { CareEvent, EventType, Plant } from '../lib/types.ts'
import { Empty, Header, Icon, RoundLink } from '../components/ui.tsx'
import { CountUp } from '../components/Vase.tsx'
import { Tablature } from '../components/Tablature.tsx'
import { ActionBar, Sheet, Stamp, useToast } from '../components/actions.tsx'
import { SpeciesLink, SyncNote, ToxLine, usePhotoPicker } from './parts.tsx'
import './screens.css'

const OTHER: EventType[] = ['feed', 'repot', 'prune', 'turn', 'treat', 'clean']

export function PlantPage() {
  const { plantId } = useParams()
  const { data, today, log, unlog, savePlant, key, can } = useGarden()
  const { garden, plants, events } = data!
  const plant = plants.find((p) => p.id === plantId)
  const [stamp, setStamp] = useState<CareEvent | null>(null)
  const [sheet, setSheet] = useState<'more' | 'note' | 'origin' | null>(null)
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
  const origin = waterOrigin(plant, events, today, garden)
  const number = plants.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).findIndex((p) => p.id === plant.id) + 1
  const mine = events.filter((e) => e.plant === plant.id)
  const primary: EventType[] = ['water', ...(plant.mist_days || sp?.mist.recommended ? (['mist'] as EventType[]) : [])]
  const cover = photoUrl(plant.photo) ?? speciesPhoto(plant.species)?.url ?? null
  const coverIsOwn = Boolean(plant.photo)

  return (
    <div className="page">
      <Header
        back={{ to: `/g/${key}`, label: 'Plantas' }}
        title={`Nº ${String(number).padStart(2, '0')} · ${plant.id}`}
        action={can.edit ? <RoundLink to="editar" icon="pencil-simple-bold" label="Editar planta" /> : undefined}
      />
      <main>
        <div className="wrap ph-top">
          <PlantHero due={st.water} cover={cover} own={coverIsOwn} name={plant.name} stamp={stamp} />
          <div className="ph-info">
            <h1 className="h1">{plant.name}</h1>
            {(sp || plant.species_text) && <p className="latin">{sp?.latin ?? plant.species_text}</p>}
            {plant.location && <p className="muted plant-where"><Icon name="potted-plant-bold" size={16} /> {plant.location}</p>}
            <WhenCard due={st.water} origin={origin} onOrigin={() => setSheet('origin')}>
              <SecondaryLines st={st} plant={plant} />
            </WhenCard>
            {stamp?.type === 'water' && can.edit && <Suggest plant={plant} />}
          </div>
        </div>

        <div className="wrap">
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
          <section className="section wrap stack">
            <SpeciesLink s={sp} />
            <ToxLine s={sp} />
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
      <Sheet open={sheet === 'origin'} onClose={() => setSheet(null)} title="De dónde sale el número">
        <OriginText plant={plant} origin={origin} />
        {can.edit && <Link to="editar" className="btn btn-line btn-block" style={{ marginTop: 'var(--s5)' }}>Cambiar cada cuánto se riega</Link>}
      </Sheet>
    </div>
  )
}

/**
 * The photo is the vase, as on the home screen: blue up to the water left, the surface a white
 * line. The plate in the corner answers "¿la riego hoy?" in two seconds. A thirsty plant's photo
 * dries out, and under it a row of seven slots fills red, one per day late.
 */
function PlantHero({ due, cover, own, name, stamp }: { due: Due | null; cover: string | null; own: boolean; name: string; stamp: CareEvent | null }) {
  const dry = due?.kind === 'late' || due?.kind === 'check'
  const level = due && due.kind !== 'never' ? due.level : 0
  const late = due?.kind === 'late' ? Math.min(7, -due.daysLeft) : 0
  const plate = !due ? { cls: 'none', num: null, words: 'sin plan de riego' }
    : due.kind === 'never' ? { cls: 'none', num: null, words: 'sin riegos anotados' }
      : due.kind === 'late' ? { cls: 'late', num: -due.daysLeft, words: due.daysLeft === -1 ? 'día tarde' : 'días tarde' }
        : due.kind === 'check' ? { cls: 'today', num: -due.daysLeft, words: `${due.daysLeft === -1 ? 'día' : 'días'} de más. Tocá la tierra` }
          : due.daysLeft === 0 ? { cls: 'today', num: 'hoy' as const, words: 'tocá la tierra' }
            : { cls: '', num: due.daysLeft, words: due.daysLeft === 1 ? 'día para el próximo' : 'días para el próximo' }
  return (
    <figure className="ph" aria-live="polite">
      <div className={`ph-photo${dry ? ' is-dry' : ''}`}>
        {cover ? <img src={cover} alt={name} /> : <span className="ph-ini" aria-hidden>{name.trim()[0]?.toUpperCase()}</span>}
        {level > 0 && <span className="ph-water" style={{ height: `${Math.round(level * 100)}%` }} />}
        <p className={`ph-plate ${plate.cls}`}>
          <b>{plate.num == null ? '—' : typeof plate.num === 'number' ? <CountUp value={plate.num} /> : plate.num}</b>
          <span>{plate.words}</span>
        </p>
        {cover && !own && <figcaption className="ph-cap">foto de la especie</figcaption>}
        <Stamp event={stamp} />
      </div>
      {late > 0 && (
        <div className="ph-debt" role="img" aria-label={`${late} de 7 días de atraso`}>
          {Array.from({ length: 7 }, (_, i) => <i key={i} className={i < late ? 'on' : ''} />)}
        </div>
      )}
    </figure>
  )
}

/** When it was watered and when it is due, with where the interval comes from one tap away. */
function WhenCard({ due, origin, onOrigin, children }: { due: Due | null; origin: Origin; onOrigin: () => void; children: ReactNode }) {
  const { today } = useGarden()
  const regada = due?.last ? `Regada ${ago(due.last.at, today)}` : ''
  const when = !due ? 'Anotá cada riego. Con cuatro, te proponemos un ritmo.'
    : due.kind === 'never' ? 'Registrá el primero y empieza la cuenta'
      : due.daysLeft < 0 ? `${regada} · tocaba el ${shortDay(due.due)}`
        : due.daysLeft === 0 ? regada : `El ${shortDay(due.due)} · ${regada.toLowerCase()}`
  return (
    <div className={`ph-when${due?.kind === 'late' ? ' is-late' : ''}`}>
      <p>{when}</p>
      <OriginButton days={due?.interval ?? null} origin={due ? origin : { kind: 'none' }} onClick={onOrigin} />
      {children}
    </div>
  )
}

/** "cada 7 días · estimado": every interval says where it comes from, and opens the reason. */
function OriginButton({ days, origin, onClick }: { days: number | null; origin: Origin; onClick: () => void }) {
  return (
    <button type="button" className="origin mono" onClick={onClick}>
      {days != null && <span>cada {days} {days === 1 ? 'día' : 'días'}</span>}
      <span className={`origin-tag is-${origin.kind}`}>{originWords(origin)}</span>
      <Icon name="info-bold" size={15} />
    </button>
  )
}

const lower = (t: string) => (t.charAt(0).toLowerCase() + t.slice(1)).replace(/\.+$/, '')

/** Why the interval is what it is, in plain words, with the source one tap away. */
function OriginText({ plant, origin }: { plant: Plant; origin: Origin }) {
  const { data, today } = useGarden()
  const sp = speciesById(plant.species)
  const days = intervalFor(plant, 'water', today, data!.garden)
  const rule = sp ? (sp.water.dryTo ? DRY_WORDS[sp.water.dryTo] : sp.water.check) : null
  const src = sp?.water.source ?? null
  const guideDays = sp?.water.warmDays ? `cada ${sp.water.warmDays} días en los meses cálidos${sp.water.coldDays ? ` y cada ${sp.water.coldDays} en los fríos` : ''}` : null
  const p: ReactNode[] = []
  if (origin.kind === 'guide') {
    p.push(<p key="a">Ninguna fuente seria da días de riego. Lo que dicen es cuánto dejar secar la tierra.</p>)
    if (rule) p.push(<p key="b">Para {sp!.common[0].toLowerCase()} la regla es <b>{lower(rule)}.</b></p>)
    p.push(<p key="c">Con esa regla estimamos {guideDays}. Es un punto de partida. Después de cuatro riegos, la app te propone ajustarlo a tu ritmo.</p>)
  } else if (origin.kind === 'source') {
    p.push(<p key="a">Este número lo da {sourceName(src) ?? 'la fuente'} tal cual: {guideDays}.</p>)
    if (rule) p.push(<p key="b">Igual vale la prueba: <b>{lower(rule)}.</b></p>)
  } else if (origin.kind === 'user') {
    p.push(<p key="a">Cada {days} días lo pusiste vos al cargar o editar la planta.</p>)
    if (guideDays) p.push(<p key="b">La guía estima {guideDays}.</p>)
  } else if (origin.kind === 'learned') {
    p.push(<p key="a">Cada {days} días sale de cómo la venís regando. Es la mediana de tus últimos riegos de esta temporada.</p>)
  } else {
    p.push(<p key="a">Esta planta no tiene plan de riego, así que la app no inventa uno.</p>)
    p.push(<p key="b">Anotá cada vez que la riegues. Con cuatro riegos te proponemos cada cuántos días.</p>)
  }
  return (
    <div className="origin-text stack">
      {p}
      {src && (origin.kind === 'guide' || origin.kind === 'source') && (
        <a href={src} target="_blank" rel="noreferrer" className="mono">Fuente: {sourceName(src)} ↗</a>
      )}
    </div>
  )
}

const DISMISS_DAYS = 14
const dismissKey = (garden: string, plant: string) => `regue.suggest.${garden}.${plant}`

/** "La venís regando cada 9 días. El plan dice cada 7. ¿Ajusto a 9?", right after a watering. */
function Suggest({ plant }: { plant: Plant }) {
  const { data, today, savePlant, log } = useGarden()
  const [gone, setGone] = useState(false)
  const s: Suggestion | null = suggestInterval(plant, data!.events, today, data!.garden)
  let dismissed = false
  try {
    const at = localStorage.getItem(dismissKey(plant.garden, plant.id))
    dismissed = !!at && daysBetween(at, today) < DISMISS_DAYS
  } catch { /* private mode: ask again next time */ }
  if (!s || gone || dismissed) return null
  const { field, current, median } = s
  function accept() {
    savePlant({ ...plant, [field]: median })
    log(plant.id, 'note', { note: `${LEARNED_NOTE}${median} días` })
    setGone(true)
  }
  function keep() {
    try { localStorage.setItem(dismissKey(plant.garden, plant.id), today.toISOString()) } catch { /* nothing to remember */ }
    setGone(true)
  }
  return (
    <div className="suggest" role="status">
      <p>
        La venís regando cada <b>{median} días</b>.{' '}
        {current != null ? <>El plan dice cada {current}. ¿Ajusto a {median}?</> : <>¿Lo uso como plan?</>}
      </p>
      <div className="suggest-btns">
        <button type="button" className="btn btn-primary" onClick={accept}>{current != null ? `Ajustar a ${median}` : `Cada ${median} días`}</button>
        <button type="button" className="btn btn-line" onClick={keep}>{current != null ? `Dejar en ${current}` : 'Todavía no'}</button>
      </div>
    </div>
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
        <div className="section-head"><h2 className="label">Progreso</h2></div>
        {r.meanGap != null && (
          <p className="mono progress-line">{r.count} riegos en 90 días · en promedio cada {String(r.meanGap).replace('.', ',')} días</p>
        )}
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
  const { auth, unlog, canUndo } = useGarden()
  const [more, setMore] = useState<CareEvent[]>([])
  const [done, setDone] = useState(false)
  const [armed, setArmed] = useState<string | null>(null)
  const shown = [...events, ...more.filter((m) => !events.some((e) => e.id === m.id))].sort((a, b) => (a.at < b.at ? 1 : -1))
  const [limit, setLimit] = useState(5)
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
      <div className="section-head"><h2 className="label">Últimas anotaciones</h2><span className="label">{shown.length}{done ? '' : '+'}</span></div>
      {!list.length && <p className="muted">Todavía no hay nada anotado. Lo que registres aparece acá.</p>}
      <ul className="journal">
        {list.map((e) => (
          <li key={e.id} className={e.pending ? 'is-pending' : ''}>
            <span className="mono j-date">{shortDate(e.at)}</span>
            <i className="j-sq" style={{ background: EVENTS[e.type].color, color: EVENTS[e.type].on }}><Icon name={EVENTS[e.type].icon} size={12} /></i>
            <span className="j-text">
              {EVENTS[e.type].past}{e.by_name ? ` · ${e.by_name}` : ''}{e.pending ? ' · sin enviar' : ''}
              {e.note && <em>{e.note}</em>}
            </span>
            {canUndo(e) && <button
              type="button" className={`j-x${armed === e.id ? ' is-armed' : ''}`}
              aria-label={armed === e.id ? 'Tocá de nuevo para borrar' : 'Borrar'}
              onClick={() => { if (armed === e.id) { unlog(e.id); setArmed(null) } else { setArmed(e.id); setTimeout(() => setArmed((a) => (a === e.id ? null : a)), 3000) } }}
            >
              {armed === e.id ? 'Borrar' : <Icon name="x-bold" size={14} />}
            </button>}
          </li>
        ))}
      </ul>
      {(limit < shown.length || (!done && shown.length >= 5)) && <button type="button" className="btn btn-line btn-block" onClick={loadMore} style={{ marginTop: 'var(--s4)' }}>Ver más</button>}
    </section>
  )
}

/** A tag whose plant does not exist yet: the tag can be written first and the plant set up here. */
function UnknownTag({ id }: { id: string }) {
  const { key, can } = useGarden()
  return (
    <div className="page no-actions">
      <Header back={{ to: `/g/${key}`, label: 'Plantas' }} title={id} />
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
