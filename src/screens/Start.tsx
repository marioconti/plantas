import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, newGardenKey, savePass } from '../lib/api.ts'
import { knownGardens } from '../lib/store.tsx'
import { Icon, Logo } from '../components/ui.tsx'
import type { IconName } from '../components/icon-data.ts'
import './screens.css'

const HOW: [IconName, string][] = [
  ['potted-plant-bold', 'Cargás cada planta'],
  ['sticker-bold', 'Le pegás un tag a la maceta'],
  ['drop-bold', 'Lo tocás con el teléfono y sabés si le toca agua'],
]

/**
 * The welcome, shaped like an app's first screen (feedback #17): the logo, one line, one button
 * at the bottom. A phone that already opened a garden goes straight into it, as an app opens on
 * your things; #/inicio still shows this screen.
 */
export function Start() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const known = knownGardens()
  const [step, setStep] = useState<'hello' | 'create'>('hello')
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (pathname === '/' && known.length) return <Navigate to={`/g/${known[0].key}`} replace />

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const key = newGardenKey()
      const r = await api.createGarden(key, name.trim() || 'Mis plantas', owner.trim())
      savePass(key, r.pass)
      nav(`/g/${key}/empezar`)
    } catch (e) {
      setError(e instanceof Error && e.message === 'too many gardens today' ? 'Hoy ya se crearon muchos jardines. Probá mañana.' : 'No se pudo crear. Hace falta conexión.')
      setBusy(false)
    }
  }

  if (step === 'create') {
    return (
      <div className="welcome">
        <header className="welcome-bar">
          <button type="button" className="round-btn" aria-label="Volver" onClick={() => setStep('hello')}><Icon name="caret-left-bold" size={20} /></button>
        </header>
        <form onSubmit={create} className="welcome-body welcome-form">
          <h1 className="welcome-title">Tu jardín</h1>
          <label className="field">
            <span className="label">¿Cómo se llama?</span>
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Las plantas de casa" enterKeyHint="next" />
          </label>
          <label className="field">
            <span className="label">¿Y vos cómo te llamás?</span>
            <input value={owner} maxLength={40} required onChange={(e) => setOwner(e.target.value)} placeholder="Mario" autoComplete="given-name" enterKeyHint="done" />
          </label>
          <p className="muted">Sin cuenta ni mail. Este teléfono queda como dueño y después le das acceso a quien quieras.</p>
          {error && <p className="hint is-bad">{error}</p>}
          <div className="welcome-cta">
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creando…' : 'Crear y seguir'}</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="welcome">
      <main className="welcome-body welcome-hello">
        <Logo size={64} />
        <p className="welcome-claim">Saber cuándo regar cada planta, con un toque.</p>
        <ul className="welcome-how">
          {HOW.map(([icon, text]) => <li key={icon}><span aria-hidden><Icon name={icon} size={24} /></span>{text}</li>)}
        </ul>
      </main>
      <div className="welcome-cta">
        <button type="button" className="btn btn-primary btn-block" onClick={() => setStep('create')}>Crear mi jardín</button>
        {known.map((g) => (
          <Link key={g.key} to={`/g/${g.key}`} className="btn btn-line btn-block">Abrir {g.name}</Link>
        ))}
        <p className="welcome-foot">¿Te pasaron un link de acceso? Abrilo y entrás directo. · <Link to="/marca">Marca</Link></p>
      </div>
    </div>
  )
}
