import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, byUrgency, shortDate } from '../lib/care.ts'
import { EVENTS, EVENT_ORDER } from '../lib/events.ts'
import { useGarden } from '../lib/store.tsx'
import type { CareEvent } from '../lib/types.ts'
import { Cell, Cells, Empty, Header, Icon } from '../components/ui.tsx'
import { TabLegend, Tablature } from '../components/Tablature.tsx'
import { Sheet } from '../components/actions.tsx'
import './screens.css'

/** The whole garden as tablature, plus what the last 30 days add up to. */
export function Diary() {
  const { data, today, key, unlog } = useGarden()
  const { garden, plants, events } = data!
  const all = byUrgency(plants, events, today, garden)
  const [pick, setPick] = useState<{ plant: string; day: number; list: CareEvent[] } | null>(null)
  const since = addDays(today, -29).getTime()
  const month = events.filter((e) => new Date(e.at).getTime() >= since)
  const count = (t: CareEvent['type']) => month.filter((e) => e.type === t).length
  const usedTypes = EVENT_ORDER.filter((t) => events.some((e) => e.type === t) || t === 'water' || t === 'mist')
  const recent = events.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 15)
  const nameOf = (id: string) => plants.find((p) => p.id === id)?.name ?? id

  return (
    <div className="page no-actions">
      <Header back={{ to: `/g/${key}`, label: 'Plantas' }} right="Diario" />
      <main>
        <div className="wrap">
          <h1 className="h1">Diario</h1>
          <p className="muted diary-lede">Cada planta es una cuerda y cada día una columna. Deslizá hacia la izquierda para ver el mes pasado.</p>
          <TabLegend types={usedTypes} />
        </div>
        {all.length ? (
          <div className="section">
            <Tablature
              rows={all.map((s) => ({ status: s, events, href: `/g/${key}/p/${s.plant.id}` }))}
              today={today} past={41} future={7}
              onPick={(plant, day, list) => setPick({ plant, day, list })}
            />
          </div>
        ) : (
          <div className="wrap"><Empty title="Todavía no hay plantas"><p><Link to={`/g/${key}/nueva`} className="btn btn-primary">Agregar una planta</Link></p></Empty></div>
        )}

        <section className="section wrap">
          <div className="section-head"><h2 className="label">Últimos 30 días</h2></div>
          <Cells>
            <Cell label="Riegos" icon="drop-bold">{count('water')}</Cell>
            <Cell label="Rocíos" icon="spray-bottle-bold">{count('mist')}</Cell>
            <Cell label="Fertilizante" icon="flask-bold">{count('feed')}</Cell>
            <Cell label="Fotos y notas" icon="camera-bold">{count('photo') + count('note')}</Cell>
          </Cells>
        </section>

        <section className="section wrap">
          <div className="section-head"><h2 className="label">Lo último que se anotó</h2></div>
          <ul className="journal">
            {recent.map((e) => (
              <li key={e.id}>
                <span className="mono j-date">{shortDate(e.at).toUpperCase()}</span>
                <i className="j-sq" style={{ background: EVENTS[e.type].color, color: EVENTS[e.type].on }}><Icon name={EVENTS[e.type].icon} size={12} /></i>
                <Link to={`/g/${key}/p/${e.plant}`} className="j-text"><b>{nameOf(e.plant)}</b> · {EVENTS[e.type].past}{e.by_name ? ` · ${e.by_name}` : ''}{e.note && <em>{e.note}</em>}</Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick ? `${nameOf(pick.plant)} · ${shortDate(new Date(pick.day))}` : ''}>
        <ul className="journal">
          {pick?.list.map((e) => (
            <li key={e.id}>
              <span className="mono j-date">{new Date(e.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
              <i className="j-sq" style={{ background: EVENTS[e.type].color, color: EVENTS[e.type].on }}><Icon name={EVENTS[e.type].icon} size={12} /></i>
              <span className="j-text">{EVENTS[e.type].past}{e.by_name ? ` · ${e.by_name}` : ''}{e.note && <em>{e.note}</em>}</span>
              <button type="button" className="j-x" aria-label="Borrar" onClick={() => {
                unlog(e.id)
                setPick((p) => (p ? { ...p, list: p.list.filter((x) => x.id !== e.id) } : p))
              }}><Icon name="trash-bold" size={14} /></button>
            </li>
          ))}
        </ul>
        {pick && <Link to={`/g/${key}/p/${pick.plant}`} className="btn btn-line btn-block" style={{ marginTop: 'var(--s4)' }}>Abrir la ficha</Link>}
      </Sheet>
    </div>
  )
}
