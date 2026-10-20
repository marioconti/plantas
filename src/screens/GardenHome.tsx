import { Link } from 'react-router-dom'
import { byUrgency, longDate, shortDate, type PlantStatus } from '../lib/care.ts'
import { useGarden } from '../lib/store.tsx'
import { speciesById } from '../lib/species.ts'
import { Empty, Header, Icon, Pill } from '../components/ui.tsx'
import { Vase } from '../components/Vase.tsx'
import { Tablature } from '../components/Tablature.tsx'
import { SyncNote } from './parts.tsx'
import './screens.css'

const WEEKDAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function GardenHome() {
  const { data, today, can, me } = useGarden()
  const { garden, plants, events } = data!
  const all = byUrgency(plants, events, today, garden)
  const groups = [
    { id: 'late', title: 'Atrasadas', list: all.filter((s) => s.group === 'late') },
    { id: 'today', title: 'Hoy', list: all.filter((s) => s.group === 'today') },
    { id: 'next', title: 'Próximas', list: all.filter((s) => s.group === 'next') },
  ].filter((g) => g.list.length)
  const due = (t: 'water' | 'mist' | 'feed') => all.filter((s) => s[t] && ['late', 'today'].includes(s[t]!.kind)).length
  const unlogged = all.filter((s) => s.water?.kind === 'never').length
  const toWater = due('water')
  const extra = [
    due('mist') && `${due('mist')} para rociar`,
    due('feed') && `${due('feed')} para fertilizar`,
    unlogged && `${unlogged} sin registro de riego`,
  ].filter(Boolean)
  const nextWater = all.map((s) => s.water).filter((d) => d && d.daysLeft > 0).sort((a, b) => a!.daysLeft - b!.daysLeft)[0]

  return (
    <div className="page no-actions">
      <Header right={<Link to="ajustes" className="header-link">{garden.name}</Link>} />
      <main className="wrap garden">
        <section className="garden-hero">
          <p className="label">Hoy · {WEEKDAY_LONG[today.getDay()]} {longDate(today)}</p>
          {plants.length ? (
            <>
              <div className="garden-count">
                <span className="display garden-num">{toWater}</span>
                <span className="garden-words">
                  {toWater === 0 ? 'nada para regar hoy' : toWater === 1 ? 'planta para regar hoy' : 'plantas para regar hoy'}
                </span>
              </div>
              <p className="mono garden-extra">
                {extra.length ? extra.join(' · ') : toWater === 0 && nextWater ? `Próximo riego el ${shortDate(nextWater.due)}` : `${all.length} plantas en el jardín`}
              </p>
            </>
          ) : null}
        </section>

        {!plants.length && <FirstPlant />}

        <div className="garden-grid">
          <div className="garden-list">
            {groups.map((g) => (
              <section key={g.id} className="section">
                <div className="section-head"><h2 className="label">{g.title}</h2><span className="label">{g.list.length}</span></div>
                <ul className="rows">{g.list.map((s) => <PlantRow key={s.plant.id} s={s} />)}</ul>
              </section>
            ))}
          </div>

          {plants.length > 0 && (
            <aside className="garden-side">
              <section className="section">
                <div className="section-head"><h2 className="label">Diario · 14 días</h2><Link to="diario" className="label">Ver todo →</Link></div>
                <div className="bleed-mobile">
                  <Tablature rows={all.slice(0, 6).map((s) => ({ status: s, events, href: `p/${s.plant.id}` }))} today={today} past={13} future={4} />
                </div>
              </section>
              <nav className="section garden-links">
                <Link to="diario" className="link-arrow"><span><Icon name="calendar-blank-bold" /> Diario</span><Icon name="arrow-right-bold" /></Link>
                <Link to="guia" className="link-arrow"><span><Icon name="leaf-bold" /> Guía de cuidados</span><Icon name="arrow-right-bold" /></Link>
                {can.edit && <Link to="nueva" className="link-arrow"><span><Icon name="plus-bold" /> Agregar una planta</span><Icon name="arrow-right-bold" /></Link>}
                <Link to="ajustes" className="link-arrow"><span><Icon name="share-network-bold" /> {can.owner ? 'Ajustes, acceso y tags' : 'Ajustes'}</span><Icon name="arrow-right-bold" /></Link>
              </nav>
            </aside>
          )}
        </div>
        <SyncNote />
        <p className="mono muted garden-key">{me ? `Entraste como ${me.name}` : ''}{data!.garden.access === 'open' ? ' · jardín abierto' : ''}</p>
      </main>
    </div>
  )
}

function PlantRow({ s }: { s: PlantStatus }) {
  const { plant, worst } = s
  const sp = speciesById(plant.species)
  return (
    <li>
      <Link to={`p/${plant.id}`} className="row">
        <Vase due={s.water} size="xs" />
        <span className="row-text">
          <span className="row-name">{plant.name}</span>
          <span className="row-meta">{[plant.location, speciesLabel(plant.name, sp?.common[0] ?? plant.species_text)].filter(Boolean).join(' · ') || plant.id}</span>
        </span>
        {worst ? (
          <Pill due={worst}>
            {worst.type !== 'water' && <Icon name={worst.type === 'mist' ? 'spray-bottle-bold' : 'flask-bold'} size={13} style={{ marginRight: 5 }} />}
            {pillText(s)}
          </Pill>
        ) : <Pill kind="never">sin plan</Pill>}
      </Link>
    </li>
  )
}

/** The species next to the name, unless the name already says it ('Potus · Potus'). */
function speciesLabel(name: string, species: string): string {
  const n = name.toLowerCase(), s = species.toLowerCase()
  return !s || n.includes(s) || s.includes(n) ? '' : species
}

function pillText(s: PlantStatus): string {
  const d = s.worst!
  if (d.kind === 'never') return 'sin registro'
  if (d.daysLeft < 0) return `${-d.daysLeft} ${d.daysLeft === -1 ? 'día' : 'días'} tarde`
  if (d.daysLeft === 0) return 'hoy'
  if (d.daysLeft === 1) return 'mañana'
  return `en ${d.daysLeft} días`
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
