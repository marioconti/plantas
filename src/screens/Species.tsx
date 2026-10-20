import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { searchSpecies, speciesById, speciesPhoto, type Species } from '../lib/species.ts'
import { useGarden } from '../lib/store.tsx'
import { Empty, Header, Icon } from '../components/ui.tsx'
import { CareCells, DontList, FeedSeason, Problems, Toxicity } from './parts.tsx'
import './screens.css'

const DIFFICULTY = { facil: 'Fácil', media: 'Media', exigente: 'Exigente' } as const

const FIELD_WORDS: Record<string, string> = {
  light: 'la luz', water: 'el riego', mist: 'el rocío', humidity: 'la humedad', temperature: 'la temperatura',
  fertilize: 'el fertilizante', toxicity: 'la toxicidad', problems: 'algunos problemas', precautions: 'las precauciones',
}
const DETAIL_WORDS: Record<string, string> = {
  everyDays: 'cada cuántos días', recommended: 'si conviene', minC: 'la mínima', maxC: 'la máxima', people: 'para personas',
  cats: 'para gatos', dogs: 'para perros', level: 'el nivel', text: 'la explicación', months: 'los meses',
}

/** "mist.everyDays" -> "el rocío (cada cuántos días)". Grouped by field, in plain words. */
function unverifiedWords(keys: string[]): string {
  const by = new Map<string, string[]>()
  for (const k of keys) {
    const [field, detail] = k.replace(/\[\d+\]/, '').split('.')
    const list = by.get(field) ?? []
    if (detail && DETAIL_WORDS[detail] && !list.includes(DETAIL_WORDS[detail])) list.push(DETAIL_WORDS[detail])
    by.set(field, list)
  }
  return [...by].map(([f, d]) => `${FIELD_WORDS[f] ?? f}${d.length ? ` (${d.join(', ')})` : ''}`).join(', ')
}

export function SpeciesList() {
  const { key } = useGarden()
  const [q, setQ] = useState('')
  const list = searchSpecies(q)
  return (
    <div className="page no-actions">
      <Header back={{ to: `/g/${key}`, label: 'Plantas' }} right={`${list.length} especies`} />
      <main className="wrap">
        <h1 className="h1">Guía de cuidados</h1>
        <p className="muted guide-lede">Luz, agua, toxicidad y lo que no hay que hacer, con fuentes. Las frecuencias son un punto de partida.</p>
        <input className="guide-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre común o en latín" />
        <ul className="guide">
          {list.map((s) => <SpeciesRow key={s.id} s={s} />)}
        </ul>
        {!list.length && <Empty title="No está en la guía"><p className="muted">Podés cargarla igual, escribiendo la especie a mano.</p></Empty>}
      </main>
    </div>
  )
}

function SpeciesRow({ s }: { s: Species }) {
  const ph = speciesPhoto(s.id)
  const toxic = s.toxicity.cats === 'toxica' || s.toxicity.dogs === 'toxica'
  return (
    <li>
      <Link to={s.id} className="guide-row">
        {ph ? <img src={ph.url} alt="" loading="lazy" /> : <span className="guide-noimg" />}
        <span className="guide-text">
          <b>{s.common[0]}</b>
          <em className="latin">{s.latin}</em>
          <span className="mono muted">{s.difficulty ? DIFFICULTY[s.difficulty] : ''}{s.water.warmDays ? ` · agua cada ${s.water.warmDays} d` : ''}</span>
        </span>
        {toxic && <span className="pill pill-late" title="Tóxica para mascotas"><Icon name="paw-print-bold" size={13} style={{ marginRight: 4 }} />tóxica</span>}
      </Link>
    </li>
  )
}

export function SpeciesPage() {
  const { speciesId } = useParams()
  const { key, data } = useGarden()
  const s = speciesById(speciesId)
  if (!s) return <div className="page no-actions"><Header back={{ to: `/g/${key}/guia`, label: 'Guía' }} /><main className="wrap"><Empty title="No está en la guía" /></main></div>
  const ph = speciesPhoto(s.id)
  const mine = data!.plants.filter((p) => p.species === s.id && !p.archived)

  return (
    <div className="page no-actions">
      <Header back={{ to: `/g/${key}/guia`, label: 'Guía' }} right={s.family ?? ''} />
      <main>
        {ph && (
          <figure className="sp-photo">
            <img src={ph.url} alt={s.common[0]} width={ph.width} height={ph.height} />
            <figcaption className="mono">
              Foto: {ph.artist} · <a href={ph.licenseUrl ?? ph.page} target="_blank" rel="noreferrer">{ph.license}</a> · <a href={ph.page} target="_blank" rel="noreferrer">Wikimedia Commons</a>
            </figcaption>
          </figure>
        )}
        <div className="wrap">
          <div className="sp-title">
            <h1 className="h1">{s.common[0]}</h1>
            <p className="latin">{s.latin}</p>
            {s.common.length > 1 && <p className="mono muted">También: {s.common.slice(1).join(', ')}</p>}
            {s.difficulty && <span className="pill pill-soon">Dificultad {DIFFICULTY[s.difficulty].toLowerCase()}</span>}
          </div>

          <section className="section">
            <div className="section-head"><h2 className="label">Cuidados</h2></div>
            <CareCells s={s} />
            <dl className="care-text">
              {s.light.text && <div><dt className="label"><Icon name="sun-bold" size={13} /> Luz</dt><dd>{s.light.text}</dd></div>}
              {(s.water.text || s.water.check) && <div><dt className="label"><Icon name="drop-bold" size={13} /> Agua</dt><dd>{s.water.check && <b>{s.water.check} </b>}{s.water.text}</dd></div>}
              {s.mist.text && <div><dt className="label"><Icon name="spray-bottle-bold" size={13} /> Rocío</dt><dd>{s.mist.recommended === false ? 'No conviene. ' : ''}{s.mist.text}</dd></div>}
              {s.humidity.text && <div><dt className="label"><Icon name="cloud-bold" size={13} /> Humedad</dt><dd>{s.humidity.text}</dd></div>}
              {s.temperature.text && <div><dt className="label"><Icon name="thermometer-simple-bold" size={13} /> Temperatura</dt><dd>{s.temperature.text}</dd></div>}
              {s.fertilize.text && <div><dt className="label"><Icon name="flask-bold" size={13} /> Fertilizante</dt><dd>{s.fertilize.text}<FeedSeason s={s} /></dd></div>}
            </dl>
          </section>

          <section className="section">
            <div className="section-head"><h2 className="label">Toxicidad</h2></div>
            <Toxicity s={s} />
          </section>

          {s.precautions.length > 0 && (
            <section className="section">
              <div className="section-head"><h2 className="label">Precauciones</h2></div>
              <ul className="precautions">{s.precautions.map((t, i) => <li key={i}><Icon name="warning-bold" size={18} /><span>{t}</span></li>)}</ul>
            </section>
          )}

          <section className="section">
            <div className="section-head"><h2 className="label">Qué no hacer</h2></div>
            <DontList items={s.dont} />
          </section>

          {s.problems.length > 0 && (
            <section className="section">
              <div className="section-head"><h2 className="label">Si ves esto</h2></div>
              <Problems items={s.problems} />
            </section>
          )}

          <section className="section">
            {mine.length > 0 && (
              <p className="mono muted" style={{ marginBottom: 'var(--s3)' }}>
                En tu jardín: {mine.map((p, i) => <span key={p.id}>{i ? ', ' : ''}<Link to={`/g/${key}/p/${p.id}`}>{p.name}</Link></span>)}
              </p>
            )}
            <Link to={`/g/${key}/nueva?species=${s.id}`} className="btn btn-primary btn-block"><Icon name="plus-bold" /> Agregar un {s.common[0]}</Link>
          </section>

          <section className="section sources">
            <div className="section-head"><h2 className="label">Fuentes</h2></div>
            <ul>{s.sources.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="mono">{x.title} ↗</a></li>)}</ul>
            {s.water.estimate && <p className="hint mono">Los días de riego son una estimación hecha a partir de las fuentes. La prueba del dedo manda.</p>}
            {s.unverified.length > 0 && <p className="hint mono">Ninguna fuente confirmó {unverifiedWords(s.unverified)}. Ahí la guía no da un dato.</p>}
          </section>
        </div>
      </main>
    </div>
  )
}
