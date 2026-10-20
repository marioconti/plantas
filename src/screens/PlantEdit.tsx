import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useGarden } from '../lib/store.tsx'
import { photoUrl, slugify } from '../lib/api.ts'
import { searchSpecies, speciesById, speciesPhoto, type Species } from '../lib/species.ts'
import type { Plant } from '../lib/types.ts'
import { Header, Icon } from '../components/ui.tsx'
import { tagUrl, CopyButton } from './Settings.tsx'
import { usePhotoPicker } from './parts.tsx'
import './screens.css'

/** Create or edit a plant. Picking a species fills in the intervals the guide suggests. */
export function PlantEdit() {
  const { plantId } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { data, key, savePlant, deletePlant, can } = useGarden()
  const { plants } = data!
  const existing = plants.find((p) => p.id === plantId) ?? null
  const isNew = !existing

  const [p, setP] = useState<Plant>(() => existing ?? blank(key, params.get('id') ?? '', params.get('species')))
  const [idTouched, setIdTouched] = useState(Boolean(params.get('id')))
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState(false)
  const [manual, setManual] = useState(Boolean(existing?.species_text))
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const sp = speciesById(p.species)
  const photo = usePhotoPicker(p.id || 'new', (path) => setP((x) => ({ ...x, photo: path })))
  const locations = useMemo(() => [...new Set(plants.map((x) => x.location).filter(Boolean))], [plants])

  const set = <K extends keyof Plant>(k: K, v: Plant[K]) => setP((x) => ({ ...x, [k]: v }))
  const idTaken = isNew && plants.some((x) => x.id === p.id)
  const idValid = /^[a-z0-9][a-z0-9-]{0,39}$/.test(p.id)
  const canSave = p.name.trim() && idValid && !idTaken

  function pick(s: Species | null) {
    setPicking(false)
    setQuery('')
    if (!s) { setManual(true); return setP((x) => ({ ...x, species: null })) }
    setManual(false)
    setP((x) => ({
      ...x,
      species: s.id,
      name: x.name || s.common[0],
      id: idTouched ? x.id : uniqueId(slugify(x.name || s.common[0]), plants),
      water_warm: s.water.warmDays ?? x.water_warm,
      water_cold: s.water.coldDays ?? x.water_cold,
      mist_days: s.mist.recommended && s.mist.everyDays ? s.mist.everyDays : null,
      feed_days: s.fertilize.everyDays ?? x.feed_days,
    }))
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    savePlant({ ...p, name: p.name.trim(), location: p.location.trim() })
    nav(`/g/${key}/p/${p.id}`, { replace: true })
  }

  return (
    <div className="page no-actions">
      <Header back={{ to: existing ? `/g/${key}/p/${existing.id}` : `/g/${key}`, label: existing ? existing.name : 'Plantas' }} />
      <main className="wrap edit">
        <h1 className="h1">{isNew ? 'Planta nueva' : 'Editar'}</h1>
        <form onSubmit={save} className="form">
          <div className="field-group">
            <label className="field">
              <span className="label">Especie</span>
              {sp && !picking ? (
                <button type="button" className="species-chosen" onClick={() => setPicking(true)}>
                  {speciesPhoto(sp.id) && <img src={speciesPhoto(sp.id)!.url} alt="" />}
                  <span><b>{sp.common[0]}</b><em className="latin">{sp.latin}</em></span>
                  <span className="label">Cambiar</span>
                </button>
              ) : (
                <>
                  <input type="search" value={query} placeholder="Buscar: potus, helecho, monstera…" onFocus={() => setPicking(true)} onChange={(e) => { setQuery(e.target.value); setPicking(true) }} />
                  {picking && (
                    <ul className="species-pick">
                      {searchSpecies(query).slice(0, 8).map((s) => (
                        <li key={s.id}>
                          <button type="button" onClick={() => pick(s)}>
                            {speciesPhoto(s.id) && <img src={speciesPhoto(s.id)!.url} alt="" loading="lazy" />}
                            <span><b>{s.common[0]}</b><em className="latin">{s.latin}</em></span>
                          </button>
                        </li>
                      ))}
                      <li><button type="button" onClick={() => pick(null)} className="species-none">No está en la guía</button></li>
                    </ul>
                  )}
                </>
              )}
            </label>
            {!sp && manual && (
              <label className="field">
                <span className="label">Especie, como la conozcas</span>
                <input value={p.species_text} maxLength={60} onChange={(e) => set('species_text', e.target.value)} placeholder="Ej. Helecho de la abuela" />
              </label>
            )}
            {sp && <p className="hint mono">Las frecuencias vienen de la guía. Son un punto de partida: ajustalas a tu casa.</p>}
          </div>

          <div className="field-group">
            <label className="field">
              <span className="label">Nombre</span>
              <input required value={p.name} maxLength={40} placeholder="Helecho del living"
                onChange={(e) => { const v = e.target.value; setP((x) => ({ ...x, name: v, id: isNew && !idTouched ? uniqueId(slugify(v), plants) : x.id })) }} />
            </label>
            <label className="field">
              <span className="label">Ubicación</span>
              <input value={p.location} maxLength={40} placeholder="Living, ventana" list="locations" onChange={(e) => set('location', e.target.value)} />
              <datalist id="locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
            </label>
            {isNew ? (
              <label className="field">
                <span className="label">Id del tag</span>
                <input value={p.id} maxLength={40} className="mono" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  onChange={(e) => { setIdTouched(true); set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')) }} />
                <span className={`hint mono${p.id && (idTaken || !idValid) ? ' is-bad' : ''}`}>
                  {idTaken ? 'Ya hay una planta con ese id.' : p.id && !idValid ? 'Solo minúsculas, números y guiones.' : 'Va en el link del tag y no cambia nunca.'}
                </span>
              </label>
            ) : (
              <div className="field">
                <span className="label">Link del tag</span>
                <div className="tag-link"><code className="mono">{tagUrl(key, p.id)}</code><CopyButton text={tagUrl(key, p.id)} /></div>
              </div>
            )}
          </div>

          <div className="field-group">
            <p className="label group-title"><Icon name="drop-bold" size={14} /> Riego</p>
            <Stepper label="Cada (días), meses cálidos" value={p.water_warm} onChange={(v) => set('water_warm', v)} min={1} max={120} />
            <Stepper label="Cada (días), meses fríos" value={p.water_cold} onChange={(v) => set('water_cold', v)} min={1} max={120} optional="Igual que en verano" />
            <Stepper label="Rocío, cada (días)" value={p.mist_days} onChange={(v) => set('mist_days', v)} min={1} max={30} optional="No se rocía" />
            {sp && sp.mist.recommended === false && <p className="hint mono">La guía no recomienda rociarla. {sp.mist.text}</p>}
            {sp && sp.mist.recommended && !sp.mist.everyDays && <p className="hint mono">La guía recomienda rociarla, pero ninguna fuente dice cada cuánto. Si la rociás, elegí vos la frecuencia.</p>}
            {sp && !sp.fertilize.everyDays && sp.fertilize.text && <p className="hint mono">Ninguna fuente da cada cuánto fertilizar. {sp.fertilize.text}</p>}
            <Stepper label="Fertilizante, cada (días)" value={p.feed_days} onChange={(v) => set('feed_days', v)} min={7} max={365} step={7} optional="Sin plan" />
          </div>

          <div className="field-group">
            <div className="field">
              <span className="label">Foto de portada</span>
              <div className="cover-pick">
                {p.photo ? <img src={photoUrl(p.photo)!} alt="" /> : <span className="cover-empty"><Icon name="camera-bold" size={28} /></span>}
                <button type="button" className="btn btn-line" onClick={photo.pick} disabled={photo.busy || !p.id}>{photo.busy ? 'Subiendo…' : p.photo ? 'Cambiar' : 'Sacar o elegir'}</button>
                {p.photo && <button type="button" className="btn btn-line" onClick={() => set('photo', null)}>Quitar</button>}
              </div>
              {photo.el}
              {photo.error && <span className="hint mono is-bad">{photo.error}</span>}
            </div>
            <label className="field">
              <span className="label">Llegó a casa</span>
              <input type="date" value={p.acquired_on ?? ''} onChange={(e) => set('acquired_on', e.target.value || null)} />
            </label>
            <label className="field">
              <span className="label">Notas</span>
              <textarea rows={4} maxLength={800} value={p.notes} onChange={(e) => set('notes', e.target.value)} placeholder="De dónde vino, qué le gusta, qué le pasó." />
            </label>
            {!isNew && (
              <label className="check-row">
                <input type="checkbox" checked={p.archived} onChange={(e) => set('archived', e.target.checked)} />
                <span>Ya no la tengo. Sacarla de la lista sin borrar su historia.</span>
              </label>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-block save" disabled={!canSave}>{isNew ? 'Guardar planta' : 'Guardar cambios'}</button>
          {!isNew && can.owner && (
            <button type="button" className="btn btn-danger btn-block" disabled={busy}
              onClick={async () => {
                if (!armed) { setArmed(true); return }
                setBusy(true)
                try { await deletePlant(p.id); nav(`/g/${key}`, { replace: true }) } catch { setBusy(false) }
              }}>
              <Icon name="trash-bold" /> {armed ? 'Sí, borrar la planta y toda su libreta' : 'Borrar planta'}
            </button>
          )}
          {isNew && <Link to={`/g/${key}/guia`} className="hint mono">¿No sabés qué planta es? Mirá la guía →</Link>}
        </form>
      </main>
    </div>
  )
}

function Stepper({ label, value, onChange, min, max, step = 1, optional }: {
  label: string; value: number | null; onChange: (v: number | null) => void; min: number; max: number; step?: number; optional?: string
}) {
  const on = value != null
  return (
    <div className="stepper">
      <span className="label">{label}</span>
      <div className="stepper-row">
        {optional && (
          <button type="button" className={`stepper-off${on ? '' : ' is-on'}`} onClick={() => onChange(on ? null : min === 7 ? 30 : Math.max(min, 3))}>
            {on ? 'Quitar' : optional}
          </button>
        )}
        {on && (
          <>
            <button type="button" className="stepper-btn" aria-label="Menos" onClick={() => onChange(Math.max(min, value! - step))}>−</button>
            <span className="stepper-val mono">{value}</span>
            <button type="button" className="stepper-btn" aria-label="Más" onClick={() => onChange(Math.min(max, value! + step))}>+</button>
          </>
        )}
      </div>
    </div>
  )
}

function blank(garden: string, id: string, species: string | null): Plant {
  const now = new Date().toISOString()
  const base: Plant = {
    garden, id: slugify(id || '') === 'planta' && !id ? '' : id, name: '', species: null, species_text: '', location: '',
    water_warm: 7, water_cold: null, mist_days: null, feed_days: null, notes: '', photo: null,
    acquired_on: null, archived: false, created_at: now, updated_at: now,
  }
  const s = speciesById(species)
  if (!s) return base
  return {
    ...base, species: s.id, name: s.common[0], id: id || slugify(s.common[0]),
    water_warm: s.water.warmDays ?? 7, water_cold: s.water.coldDays, mist_days: s.mist.recommended && s.mist.everyDays ? s.mist.everyDays : null,
    feed_days: s.fertilize.everyDays,
  }
}

/** "helecho" -> "helecho-02" when there is already a "helecho". */
function uniqueId(base: string, plants: Plant[]): string {
  if (!plants.some((p) => p.id === base)) return base
  for (let i = 2; i < 100; i++) {
    const id = `${base.slice(0, 36)}-${String(i).padStart(2, '0')}`
    if (!plants.some((p) => p.id === id)) return id
  }
  return `${base.slice(0, 30)}-${Date.now().toString(36)}`
}
