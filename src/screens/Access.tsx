import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { SITE_URL } from '../config.ts'
import { api, savePass, type PassRow } from '../lib/api.ts'
import { addDays, shortDate, ago } from '../lib/care.ts'
import { useGarden } from '../lib/store.tsx'
import { Empty, Header, Icon } from '../components/ui.tsx'
import { CopyButton } from './Settings.tsx'
import './screens.css'

/**
 * Who gets in. A private garden opens only with a pass, one per person and phone. The switch
 * opens it to anyone holding a tag link for a while: the week someone else waters the plants.
 * See supabase/schema.sql for what each role may do.
 */

export const ROLE_WORDS = { owner: 'Dueño', member: 'Miembro', guest: 'Visita', visitor: 'Visita' } as const

export function passUrl(key: string, token: string): string {
  return `${SITE_URL}#/g/${key}/pase/${token}`
}

/** #/g/<key>/pase/<token>: keeps the pass on this phone and opens the garden. */
export function PassAccept() {
  const { key, token } = useParams()
  savePass(key!, token!)
  return <Navigate to={`/g/${key}`} replace />
}

/** What a phone without a pass sees in a private garden. */
export function PrivateGarden() {
  const { setPass } = useGarden()
  const [link, setLink] = useState('')
  const token = link.match(/pase\/([A-Za-z0-9_-]{20,})/)?.[1]
  return (
    <div className="page no-actions">
      <Header />
      <main className="wrap">
        <Empty title="Este jardín es privado">
          <p className="muted">Solo entran las personas que tienen un pase. Si te toca cuidar estas plantas, pedile el link de acceso a quien te lo encargó.</p>
          <label className="field" style={{ marginTop: 'var(--s5)' }}>
            <span className="label">Pegá tu link de acceso</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…/pase/…" autoCapitalize="none" autoCorrect="off" />
          </label>
          <p style={{ marginTop: 'var(--s3)' }}><button type="button" className="btn btn-primary" disabled={!token} onClick={() => token && setPass(token)}>Entrar</button></p>
        </Empty>
      </main>
    </div>
  )
}

const DURATIONS: { label: string; days: number | null }[] = [
  { label: '1 día', days: 1 },
  { label: '1 semana', days: 7 },
  { label: '2 semanas', days: 14 },
  { label: '1 mes', days: 30 },
  { label: 'Sin fecha', days: null },
]

const untilIso = (days: number | null) => (days == null ? null : addDays(new Date(), days + 1).toISOString())

/** The owner's panel: the switch, the passes, and making a new one. */
export function AccessPanel() {
  const { auth, key, data, me, reload } = useGarden()
  const garden = data!.garden
  const [passes, setPasses] = useState<PassRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [made, setMade] = useState<{ name: string; url: string } | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState<PassRow['role']>('guest')
  const [days, setDays] = useState<number | null>(7)
  const [armed, setArmed] = useState<string | null>(null)
  const [openDays, setOpenDays] = useState<number | null>(7)
  const nav = useNavigate()

  const refresh = useCallback(async () => {
    try { setPasses(await api.passes(auth)) } catch { setError('Sin conexión: no se pudieron leer los pases.') }
  }, [auth])
  useEffect(() => { void refresh() }, [refresh])

  const isOpen = garden.access === 'open' && (!garden.open_until || new Date(garden.open_until) > new Date())

  async function setAccess(open: boolean) {
    setError(null)
    try {
      await api.setAccess(auth, open ? 'open' : 'private', open ? untilIso(openDays) : null)
      await reload()
    } catch { setError('No se pudo cambiar. Hace falta conexión.') }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const r = await api.createPass(auth, name.trim(), role, role === 'owner' ? null : untilIso(days))
      setMade({ name: name.trim() || 'Sin nombre', url: passUrl(key, r.token) })
      setName('')
      await refresh()
    } catch { setError('No se pudo crear el pase. Hace falta conexión.') }
  }

  async function revoke(p: PassRow) {
    if (armed !== p.id) { setArmed(p.id); return }
    setArmed(null)
    try {
      await api.revokePass(auth, p.id)
      if (p.mine) { savePass(key, null); nav('/', { replace: true }); return }
      await refresh()
    } catch (err) {
      setError(err instanceof Error && err.message === 'last owner' ? 'Es el último pase de dueño. Creá otro antes de revocarlo.' : 'No se pudo revocar.')
    }
  }

  return (
    <>
      <section className="section">
        <div className="section-head"><h2 className="label">Acceso</h2><span className={`pill ${isOpen ? 'pill-today' : 'pill-ok'}`}>{isOpen ? 'Abierto' : 'Privado'}</span></div>
        <div className={`access ${isOpen ? 'is-open' : ''}`}>
          <p className="access-state">
            {isOpen
              ? garden.open_until ? `Cualquiera con un tag puede ver y anotar hasta el ${shortDate(garden.open_until)}.` : 'Cualquiera con un tag puede ver y anotar, hasta que lo cierres.'
              : 'Solo entran las personas con pase. Quien lea un tag sin pase ve «jardín privado».'}
          </p>
          {isOpen ? (
            <button type="button" className="btn btn-primary btn-block" onClick={() => setAccess(false)}><Icon name="check-bold" /> Volver a privado</button>
          ) : (
            <>
              <span className="label">Abrirlo por</span>
              <div className="seg">
                {DURATIONS.map((d) => (
                  <button key={d.label} type="button" className={openDays === d.days ? 'on' : ''} aria-pressed={openDays === d.days} onClick={() => setOpenDays(d.days)}>{d.label}</button>
                ))}
              </div>
              <button type="button" className="btn btn-line btn-block" onClick={() => setAccess(true)}>Abrir el jardín</button>
              <p className="hint mono">Sirve si viene alguien a regar y no querés darle un pase. Se cierra solo en la fecha.</p>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2 className="label">Pases</h2><span className="label">{passes?.filter((p) => !p.revoked).length ?? '…'}</span></div>
        <ul className="passes">
          {passes?.map((p) => {
            const expired = p.expires_at && new Date(p.expires_at) < new Date()
            return (
              <li key={p.id} className={p.revoked || expired ? 'is-off' : ''}>
                <span className="pass-text">
                  <b>{p.name}{p.mine ? ' · este teléfono' : ''}</b>
                  <span className="mono muted">
                    {ROLE_WORDS[p.role]}
                    {p.revoked ? ' · revocado' : expired ? ' · vencido' : p.expires_at ? ` · hasta ${shortDate(p.expires_at)}` : ''}
                    {p.last_used_at ? ` · usado ${ago(p.last_used_at, new Date())}` : ' · sin usar'}
                  </span>
                </span>
                {!p.revoked && !expired && (
                  <button type="button" className={`j-x${armed === p.id ? ' is-armed' : ''}`} onClick={() => revoke(p)} aria-label={`Revocar el pase de ${p.name}`}>
                    {armed === p.id ? 'Revocar' : <Icon name="x-bold" size={14} />}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {auth.pass && (
          <div className="field" style={{ marginTop: 'var(--s4)' }}>
            <span className="label">Tu link de acceso ({me?.name})</span>
            <div className="tag-link"><code className="mono">{passUrl(key, auth.pass)}</code><CopyButton text={passUrl(key, auth.pass)} /></div>
            <span className="hint mono">Guardalo en un lugar tuyo. Si el teléfono borra los datos del sitio, con este link volvés a entrar.</span>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2 className="label">Nuevo pase</h2></div>
        {made ? (
          <div className="made">
            <p><b>Pase para {made.name}.</b> Mandale este link. Se muestra una sola vez.</p>
            <div className="tag-link"><code className="mono">{made.url}</code><CopyButton text={made.url} /></div>
            <button type="button" className="btn btn-line" onClick={() => setMade(null)}>Listo</button>
          </div>
        ) : (
          <form className="form" onSubmit={create}>
            <label className="field">
              <span className="label">Para quién</span>
              <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Juan, o Laura (enero)" required />
            </label>
            <div className="field">
              <span className="label">Qué puede hacer</span>
              <div className="seg seg-3">
                {(['owner', 'member', 'guest'] as const).map((r) => (
                  <button key={r} type="button" className={role === r ? 'on' : ''} aria-pressed={role === r} onClick={() => setRole(r)}>{ROLE_WORDS[r]}</button>
                ))}
              </div>
              <span className="hint mono">
                {role === 'owner' ? 'Todo, incluso pases y acceso. Para la gente de la casa.' : role === 'member' ? 'Anota, agrega y edita plantas.' : 'Ve y anota. No edita ni borra.'}
              </span>
            </div>
            {role !== 'owner' && (
              <div className="field">
                <span className="label">Vence</span>
                <div className="seg">
                  {DURATIONS.map((d) => (
                    <button key={d.label} type="button" className={days === d.days ? 'on' : ''} aria-pressed={days === d.days} onClick={() => setDays(d.days)}>{d.label}</button>
                  ))}
                </div>
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-block">Crear pase</button>
          </form>
        )}
        {error && <p className="hint mono is-bad">{error}</p>}
      </section>
    </>
  )
}

/** For a member or guest: who they are here, and how to leave. */
export function MyPass() {
  const { me, key, auth } = useGarden()
  const nav = useNavigate()
  if (!me) return null
  return (
    <section className="section">
      <div className="section-head"><h2 className="label">Tu acceso</h2></div>
      <p>Entraste como <b>{me.name}</b> ({ROLE_WORDS[me.role].toLowerCase()}).</p>
      {auth.pass && (
        <button type="button" className="btn btn-line" style={{ marginTop: 'var(--s3)' }} onClick={() => { savePass(key, null); nav('/', { replace: true }) }}>
          Salir de este jardín en este teléfono
        </button>
      )}
    </section>
  )
}
