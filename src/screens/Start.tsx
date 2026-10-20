import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, newGardenKey, savePass } from '../lib/api.ts'
import { knownGardens } from '../lib/store.tsx'
import { Icon, Logo } from '../components/ui.tsx'
import './screens.css'

/** What this is, the gardens this phone already opened, and how to start one. */
export function Start() {
  const nav = useNavigate()
  const known = knownGardens()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const key = newGardenKey()
      const r = await api.createGarden(key, name.trim() || 'Mis plantas', owner.trim())
      savePass(key, r.pass)
      nav(`/g/${key}/ajustes`)
    } catch {
      setError('No se pudo crear. Hace falta conexión.')
      setBusy(false)
    }
  }

  return (
    <div className="start">
      <header className="start-hero">
        <div className="wrap">
          <Logo size={96} />
          <p className="start-claim">Acercá el teléfono a la maceta. Te dice si le toca agua, y con un toque queda anotado.</p>
        </div>
      </header>
      <main className="wrap start-body">
        {known.length > 0 && (
          <section className="section">
            <div className="section-head"><h2 className="label">Tus jardines</h2></div>
            {known.map((g) => (
              <Link key={g.key} to={`/g/${g.key}`} className="link-arrow"><span>{g.name}</span><Icon name="arrow-right-bold" /></Link>
            ))}
          </section>
        )}

        <section className="section">
          <div className="section-head"><h2 className="label">Cómo funciona</h2></div>
          <ol className="how">
            <li><span className="display">1</span><p><b>Cargás cada planta.</b> Elegís la especie y la guía propone cada cuánto regarla.</p></li>
            <li><span className="display">2</span><p><b>Grabás un tag NFC por maceta.</b> Es una calcomanía. El teléfono la lee sin instalar nada.</p></li>
            <li><span className="display">3</span><p><b>Regás y tocás «Regué».</b> El vaso se llena y cuenta los días hasta la próxima.</p></li>
          </ol>
        </section>

        <section className="section">
          <div className="section-head"><h2 className="label">Empezar un jardín</h2></div>
          <form onSubmit={create} className="form">
            <label className="field">
              <span className="label">Nombre</span>
              <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Las plantas de casa" />
            </label>
            <label className="field">
              <span className="label">Tu nombre</span>
              <input value={owner} maxLength={40} required onChange={(e) => setOwner(e.target.value)} placeholder="Mario" />
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creando…' : 'Crear jardín'}</button>
            {error && <p className="hint mono is-bad">{error}</p>}
            <p className="hint mono">No pide cuenta ni mail. Este teléfono queda con un pase de dueño, y desde Ajustes le das pase a quien quieras.</p>
          </form>
        </section>

        <footer className="start-foot mono">
          <Link to="/marca">Manual de marca</Link>
          <span>Datos de cuidado: ASPCA, NC State Extension, RHS. Fotos: Wikimedia Commons.</span>
        </footer>
      </main>
    </div>
  )
}
