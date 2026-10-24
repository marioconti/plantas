import { useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useGarden } from '../lib/store.tsx'
import { uploadPhoto } from '../lib/api.ts'
import { LIGHT_WORDS, type DryTo, type Species } from '../lib/species.ts'
import { monthShort } from '../lib/care.ts'
import { Cell, Cells, Icon, Scale } from '../components/ui.tsx'
import type { IconName } from '../components/icon-data.ts'

/** Path, label and icon stem: the icon is bold, and filled on the tab you are in. */
const TABS: [string, string, string][] = [['', 'Plantas', 'potted-plant'], ['diario', 'Diario', 'calendar-blank'], ['guia', 'Guía', 'leaf'], ['ajustes', 'Ajustes', 'gear-six']]

/**
 * The tab bar at the thumb, like any installed app. It shows on the four top screens and on the
 * guide; a plant, and the forms, have their own buttons down there instead.
 */
export function TabBar() {
  const { key } = useGarden()
  const { pathname } = useLocation()
  if (/\/(p|nueva)(\/|$)/.test(pathname)) return null
  return (
    <nav className="tabbar" aria-label="Secciones">
      {TABS.map(([to, label, icon]) => (
        <NavLink key={label} to={`/g/${key}${to ? `/${to}` : ''}`} end={!to} className="tb-item">
          {({ isActive }) => <>
            <Icon name={`${icon}-${isActive ? 'fill' : 'bold'}` as IconName} size={24} />
            <span>{label}</span>
          </>}
        </NavLink>
      ))}
    </nav>
  )
}

/** Says when something has not reached the database yet, or could not. */
export function SyncNote() {
  const { pending, error } = useGarden()
  if (!pending && !error) return null
  return (
    <p className="sync mono" role="status">
      <Icon name={error ? 'warning-bold' : 'clock-counter-clockwise-bold'} size={15} />
      {error ?? `${pending} ${pending === 1 ? 'cambio espera' : 'cambios esperan'} conexión para guardarse`}
    </p>
  )
}

/** A hidden file input that opens the camera or the gallery, shrinks the photo and uploads it. */
export function usePhotoPicker(plant: string, onDone: (path: string) => void) {
  const { key } = useGarden()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const el = (
    <input
      ref={input} type="file" accept="image/*" hidden
      onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        setBusy(true)
        setError(null)
        try {
          onDone(await uploadPhoto(key, plant, f))
        } catch {
          setError('No se pudo subir la foto. Hace falta conexión.')
        } finally {
          setBusy(false)
        }
      }}
    />
  )
  return { el, pick: () => input.current?.click(), busy, error }
}

// ---------------------------------------------------------------- care, from the catalog

const HUMIDITY_LEVEL = { baja: 2, media: 3, alta: 5 } as const
const DRY_SHORT: Record<DryTo, string> = { humeda: 'Siempre húmeda', superficie: 'Seca arriba', mitad: 'Seca a la mitad', seca: 'Seca del todo', 'muy-seca': 'Muy seca' }

export function CareCells({ s }: { s: Species }) {
  const light = s.light.level ? LIGHT_WORDS[s.light.level] : null
  const t = s.temperature
  return (
    <Cells>
      <Cell label="Luz" icon="sun-bold">
        {light?.label ?? 'Sin dato'}
        {light && <Scale level={light.level} label="Luz" />}
      </Cell>
      <Cell label="Agua" icon="drop-bold">
        {s.water.dryTo ? DRY_SHORT[s.water.dryTo] : s.water.warmDays ? `Cada ${s.water.warmDays} días` : 'Según la tierra'}
        {s.water.warmDays && <small>{s.water.estimate ? `unos ${s.water.warmDays} días · estimado` : `cada ${s.water.warmDays} días`}</small>}
      </Cell>
      <Cell label="Humedad" icon="cloud-bold">
        {s.humidity.level ? s.humidity.level[0].toUpperCase() + s.humidity.level.slice(1) : 'Sin dato'}
        {s.humidity.level && <Scale level={HUMIDITY_LEVEL[s.humidity.level]} label="Humedad" />}
      </Cell>
      <Cell label="Temperatura" icon="thermometer-simple-bold">
        {t.minC != null && t.maxC != null ? `${t.minC}–${t.maxC} °C` : t.minC != null ? `Mínima ${t.minC} °C` : 'Sin dato'}
        {t.minC != null && <small>No menos de {t.minC} °C</small>}
      </Cell>
    </Cells>
  )
}

/** The finger test, which is worth more than any interval. */
export function WaterCheck({ s }: { s: Species }) {
  if (!s.water.check) return null
  return (
    <div className="check">
      <p className="label">La prueba que vale</p>
      <p className="check-text">{s.water.check}</p>
    </div>
  )
}

const PET_WORD = { toxica: 'Tóxica', 'no-toxica': 'No tóxica', 'sin-datos': 'Sin datos' } as const

export function Toxicity({ s }: { s: Species }) {
  const tx = s.toxicity
  const toxic = tx.cats === 'toxica' || tx.dogs === 'toxica'
  const unknown = !toxic && (tx.cats !== 'no-toxica' || tx.dogs !== 'no-toxica')
  return (
    <div className={`tox ${toxic ? 'tox-bad' : unknown ? 'tox-unknown' : 'tox-ok'}`}>
      <div className="tox-head">
        <span className="tox-word">{toxic ? 'Tóxica' : unknown ? 'Sin datos firmes' : 'No tóxica'}</span>
        <span className="tox-icons"><Icon name="paw-print-bold" size={20} label="Mascotas" /><Icon name="baby-bold" size={20} label="Chicos" /></span>
      </div>
      <dl className="tox-grid mono">
        <div><dt>Gatos</dt><dd>{tx.cats ? PET_WORD[tx.cats] : 'Sin datos'}</dd></div>
        <div><dt>Perros</dt><dd>{tx.dogs ? PET_WORD[tx.dogs] : 'Sin datos'}</dd></div>
        <div><dt>Personas</dt><dd>{tx.people ? tx.people.replace('-', ' ') : 'Sin datos'}</dd></div>
      </dl>
      {tx.text && <p className="tox-text">{tx.text}</p>}
      {tx.source && <a className="tox-src mono" href={tx.source} target="_blank" rel="noreferrer">Fuente: {new URL(tx.source).hostname.replace('www.', '')} ↗</a>}
    </div>
  )
}

/** One line for the plant page: toxic or not, for whom, and where it says so. */
export function ToxLine({ s }: { s: Species }) {
  const tx = s.toxicity
  const toxic = tx.cats === 'toxica' || tx.dogs === 'toxica'
  const known = tx.cats === 'no-toxica' && tx.dogs === 'no-toxica'
  const who = [tx.cats === 'toxica' && 'gatos', tx.dogs === 'toxica' && 'perros'].filter(Boolean).join(' y ')
  return (
    <p className={`toxline ${toxic ? 'is-bad' : known ? 'is-ok' : ''}`}>
      <Icon name="paw-print-bold" size={18} />
      <span>{toxic ? `Tóxica para ${who}` : known ? 'No tóxica para gatos ni perros' : 'Sin datos firmes de toxicidad'}</span>
      {tx.source && <a href={tx.source} target="_blank" rel="noreferrer" className="mono">ASPCA ↗</a>}
    </p>
  )
}

export function DontList({ items, max = 5 }: { items: string[]; max?: number }) {
  if (!items.length) return null
  return (
    <ol className="dont">
      {items.slice(0, max).map((t, i) => (
        <li key={i}><span className="dont-n display">NO {String(i + 1).padStart(2, '0')}</span><p>{t}</p></li>
      ))}
    </ol>
  )
}

export function Problems({ items }: { items: Species['problems'] }) {
  if (!items.length) return null
  return (
    <div className="problems">
      {items.map((p, i) => (
        <details key={i} className="problem">
          <summary><span>{p.symptom}</span><Icon name="plus-bold" size={18} /></summary>
          <dl>
            <div><dt className="label">Por qué</dt><dd>{p.cause}</dd></div>
            <div><dt className="label">Qué hacer</dt><dd>{p.fix}</dd></div>
          </dl>
        </details>
      ))}
    </div>
  )
}

export function FeedSeason({ s }: { s: Species }) {
  const m = s.fertilize.months
  if (!m?.length) return null
  return (
    <div className="months" role="img" aria-label={`Fertilizar en ${m.map(monthShort).join(', ')}`}>
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className={m.includes(i + 1) ? 'on' : ''}>{monthShort(i + 1)[0].toUpperCase()}</span>
      ))}
    </div>
  )
}

export function SpeciesLink({ s }: { s: Species }) {
  const { key } = useGarden()
  return <Link to={`/g/${key}/guia/${s.id}`} className="link-arrow"><span>Cómo cuidar {s.common[0].toLowerCase().startsWith('la ') || s.common[0].toLowerCase().startsWith('el ') ? s.common[0].toLowerCase() : `un ${s.common[0].toLowerCase()}`}</span><Icon name="caret-right-bold" /></Link>
}
