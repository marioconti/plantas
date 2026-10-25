import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SITE_URL } from '../config.ts'
import { monthShort } from '../lib/care.ts'
import { useGarden } from '../lib/store.tsx'
import { Header, Icon } from '../components/ui.tsx'
import { AccessPanel, MyPass } from './Access.tsx'
import './screens.css'

/** The address written on a plant's tag. */
export function tagUrl(key: string, plant: string): string {
  return `${SITE_URL}#/g/${key}/p/${plant}`
}

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button" className="copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          window.prompt('Copiá el link', text)
        }
        setDone(true)
        setTimeout(() => setDone(false), 1800)
      }}
    >
      <Icon name={done ? 'check-bold' : 'share-network-bold'} size={16} /> {done ? 'Copiado' : label}
    </button>
  )
}

export function Settings() {
  const { data, key, updateGarden, can } = useGarden()
  const { garden, plants } = data!
  const [name, setName] = useState(garden.name)
  const [cold, setCold] = useState<number[]>(garden.cold_months)
  const [saved, setSaved] = useState<string | null>(null)
  const dirty = name !== garden.name || cold.join() !== garden.cold_months.join()
  const gardenUrl = `${SITE_URL}#/g/${key}`
  type Tab = 'people' | 'tags' | 'garden'
  const [tab, setTab] = useState<Tab>('people')
  const tabs: [Tab, string][] = [['people', 'Personas'], ['tags', 'Tags'], ...(can.owner ? [['garden', 'Jardín'] as [Tab, string]] : [])]

  return (
    <div className="page has-tabs">
      <Header />
      <main className="wrap settings">
        <h1 className="h1">Ajustes</h1>
        <div className="seg seg-3 settings-tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === 'people' && <>
          {can.owner ? <AccessPanel /> : <MyPass />}
          <section className="section">
            <div className="section-head"><h2 className="label">Otro teléfono</h2></div>
            <p className="muted">Este link abre el jardín, pero mientras sea privado hace falta además un pase. Para sumar a alguien, creale un pase arriba.</p>
            <div className="tag-link"><code className="mono">{gardenUrl}</code><CopyButton text={gardenUrl} /></div>
          </section>
        </>}

        {tab === 'garden' && can.owner && <section className="section">
          <div className="section-head"><h2 className="label">El jardín</h2></div>
          <label className="field">
            <span className="label">Nombre</span>
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <span className="label">Meses fríos (riego más espaciado)</span>
            <div className="months months-pick">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <button key={m} type="button" className={cold.includes(m) ? 'on' : ''} aria-pressed={cold.includes(m)}
                  onClick={() => setCold((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m].sort((a, b) => a - b)))}>
                  {monthShort(m)}
                </button>
              ))}
            </div>
            <span className="hint mono">En Buenos Aires, de mayo a septiembre.</span>
          </div>
          <button type="button" className="btn btn-primary" disabled={!dirty}
            onClick={async () => {
              try { await updateGarden(name, cold); setSaved('Guardado') } catch { setSaved('Sin conexión. Probá de nuevo.') }
            }}>Guardar</button>
          {saved && <p className="hint mono">{saved}</p>}
        </section>}

        {tab === 'tags' && <>
        <section className="section">
          <div className="section-head"><h2 className="label">Links de los tags</h2><span className="label">{plants.length}</span></div>
          <p className="muted">Cada planta tiene su link. Grabalo en un tag NFC y pegalo en la maceta.</p>
          <ul className="tags">
            {plants.map((p) => (
              <li key={p.id}>
                <span><b>{p.name}</b><code className="mono">{p.id}</code></span>
                <Link to={`/g/${key}/p/${p.id}/tag`} className="copy"><Icon name="sticker-bold" size={16} /> Grabar</Link>
              </li>
            ))}
          </ul>
          <Link to={`/g/${key}/nueva`} className="btn btn-line btn-block"><Icon name="plus-bold" /> Agregar una planta</Link>
        </section>

        <section className="section">
          <Link to={`/g/${key}/empezar`} className="link-arrow"><span><Icon name="list-plus-bold" /> Guía paso a paso</span><Icon name="caret-right-bold" /></Link>
        </section>
        </>}
      </main>
    </div>
  )
}
