import { useState } from 'react'
import { Link } from 'react-router-dom'
import { byUrgency, shortDate } from '../lib/care.ts'
import { EVENTS } from '../lib/events.ts'
import { useGarden } from '../lib/store.tsx'
import type { CareEvent } from '../lib/types.ts'
import { Empty, Header, Icon } from '../components/ui.tsx'
import { Tablature } from '../components/Tablature.tsx'
import { Sheet } from '../components/actions.tsx'
import './screens.css'

/** The whole garden as tablature, and the latest entries. */
export function Diary() {
  const { data, today, key, unlog, canUndo } = useGarden()
  const { garden, plants, events } = data!
  const all = byUrgency(plants, events, today, garden)
  const [pick, setPick] = useState<{ plant: string; day: number; list: CareEvent[] } | null>(null)
  const recent = events.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 15)
  const nameOf = (id: string) => plants.find((p) => p.id === id)?.name ?? id

  return (
    <div className="page has-tabs">
      <Header />
      <main>
        <div className="wrap">
          <h1 className="h1">Diario</h1>
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
              {canUndo(e) && <button type="button" className="j-x" aria-label="Borrar" onClick={() => {
                unlog(e.id)
                setPick((p) => (p ? { ...p, list: p.list.filter((x) => x.id !== e.id) } : p))
              }}><Icon name="trash-bold" size={14} /></button>}
            </li>
          ))}
        </ul>
        {pick && <Link to={`/g/${key}/p/${pick.plant}`} className="btn btn-line btn-block" style={{ marginTop: 'var(--s4)' }}>Abrir la ficha</Link>}
      </Sheet>
    </div>
  )
}
