import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CATEGORY_WORDS, DRY_WORDS, SPECIES, monthsWords, searchSpecies, sourceName, speciesById, speciesPhoto, type Category, type Species } from '../lib/species.ts'
import { useGarden } from '../lib/store.tsx'
import { Empty, Header, Icon } from '../components/ui.tsx'
import { CareCells, DontList, FeedSeason, Problems, Toxicity } from './parts.tsx'
import './screens.css'

const DIFFICULTY = { facil: 'Fácil', media: 'Media', exigente: 'Exigente' } as const
const PLACE = { interior: 'Interior', exterior: 'Exterior', ambos: 'Interior o exterior' } as const
const DRAINAGE = { imprescindible: 'Drenaje imprescindible', importante: 'Drenaje importante', normal: 'Drenaje normal' } as const

const FIELD_WORDS: Record<string, string> = {
  light: 'la luz', water: 'el riego', mist: 'el rocío', humidity: 'la humedad', temperature: 'la temperatura',
  fertilize: 'el fertilizante', soil: 'el sustrato', pot: 'la maceta', repot: 'el trasplante', toxicity: 'la toxicidad', problems: 'algunos problemas', precautions: 'las precauciones',
}
const DETAIL_WORDS: Record<string, string> = {
  everyDays: 'cada cuántos días', recommended: 'si conviene', minC: 'la mínima', maxC: 'la máxima', people: 'para personas',
  cats: 'para gatos', dogs: 'para perros', level: 'el nivel', text: 'la explicación', months: 'los meses',
  mix: 'qué mezcla', drainage: 'el drenaje', everyYears: 'cada cuántos años', dryTo: 'cuánto dejar secar',
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
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const found = searchSpecies(q)
  const cats = (Object.keys(CATEGORY_WORDS) as Category[]).filter((c) => SPECIES.some((s) => s.category === c))
  const list = found.filter((s) => !cat || (cat === 'nativa' ? s.native : s.category === cat))
  return (
    <div className="page has-tabs">
      <Header />
      <main className="wrap">
        <h1 className="h1">Guía de cuidados</h1>
        <p className="muted guide-lede">Las plantas más comunes en Argentina. Cada dato dice de dónde sale.</p>
        <input className="guide-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre común o en latín" />
        {cats.length > 0 && (
          <div className="chips" role="group" aria-label="Filtrar">
            {[[null, 'Todas'], ['nativa', 'Nativas'], ...cats.map((c) => [c, CATEGORY_WORDS[c]])].map(([id, label]) => (
              <button key={label} type="button" className={cat === id ? 'on' : ''} aria-pressed={cat === id} onClick={() => setCat(id)}>{label}</button>
            ))}
          </div>
        )}
        <ul className="guide">
          {list.map((s) => <SpeciesRow key={s.id} s={s} />)}
        </ul>
        {!list.length && <Empty title="No está en la guía"><p className="muted">Podés cargarla igual, sin especie. La app aprende su ritmo de tus riegos.</p></Empty>}
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
          <span className="mono muted">{[s.difficulty && DIFFICULTY[s.difficulty], s.native && 'Nativa', s.place && PLACE[s.place]].filter(Boolean).join(' · ')}</span>
        </span>
        {toxic && <span className="pill pill-late" title="Tóxica para mascotas"><Icon name="paw-print-bold" size={13} style={{ marginRight: 4 }} />tóxica</span>}
      </Link>
    </li>
  )
}

/** "NC State ↗" next to a block: where that block comes from. */
function Src({ url }: { url?: string | null }) {
  if (!url) return null
  return <a href={url} target="_blank" rel="noreferrer" className="src mono">{sourceName(url)} ↗</a>
}

export function SpeciesPage() {
  const { speciesId } = useParams()
  const { key, data } = useGarden()
  const s = speciesById(speciesId)
  if (!s) return <div className="page no-actions"><Header back={{ to: `/g/${key}/guia`, label: 'Guía' }} /><main className="wrap"><Empty title="No está en la guía" /></main></div>
  const ph = speciesPhoto(s.id)
  const mine = data!.plants.filter((p) => p.species === s.id && !p.archived)

  return (
    <div className="page has-tabs">
      <Header back={{ to: `/g/${key}/guia`, label: 'Guía' }} title={s.family ?? ''} />
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
            <p className="sp-pills">
              {s.difficulty && <span className="pill pill-soon">Dificultad {DIFFICULTY[s.difficulty].toLowerCase()}</span>}
              {s.native && <span className="pill pill-ok">Nativa de Argentina</span>}
              {s.place && <span className="pill pill-never">{PLACE[s.place]}</span>}
            </p>
          </div>

          <section className="section">
            <div className="section-head"><h2 className="label">Cuidados</h2></div>
            <CareCells s={s} />
            <dl className="care-text">
              {s.light.text && <div><dt className="label"><Icon name="sun-bold" size={13} /> Luz <Src url={s.light.source} /></dt><dd>{s.light.text}</dd></div>}
              {(s.water.text || s.water.check) && <div><dt className="label"><Icon name="drop-bold" size={13} /> Agua <Src url={s.water.source} /></dt><dd>{s.water.dryTo ? <b>{DRY_WORDS[s.water.dryTo]}. </b> : null}{s.water.check && <>{s.water.check} </>}{s.water.text}</dd></div>}
              {s.mist.text && <div><dt className="label"><Icon name="spray-bottle-bold" size={13} /> Rocío <Src url={s.mist.source} /></dt><dd>{s.mist.recommended === false ? 'No conviene. ' : ''}{s.mist.text}</dd></div>}
              {s.humidity.text && <div><dt className="label"><Icon name="cloud-bold" size={13} /> Humedad <Src url={s.humidity.source} /></dt><dd>{s.humidity.text}</dd></div>}
              {s.temperature.text && <div><dt className="label"><Icon name="thermometer-simple-bold" size={13} /> Temperatura <Src url={s.temperature.source} /></dt><dd>{s.temperature.text}</dd></div>}
              {s.fertilize.text && <div><dt className="label"><Icon name="flask-bold" size={13} /> Fertilizante <Src url={s.fertilize.source} /></dt><dd>{s.fertilize.text}<FeedSeason s={s} /></dd></div>}
            </dl>
          </section>

          {(s.soil?.mix || s.soil?.text || s.pot?.text || s.repot?.text) && (
            <section className="section">
              <div className="section-head"><h2 className="label">Tierra y maceta</h2></div>
              <dl className="care-text">
                {(s.soil?.mix || s.soil?.text) && <div><dt className="label"><Icon name="shovel-bold" size={13} /> Sustrato <Src url={s.soil.source} /></dt><dd>{s.soil.mix && <b>{s.soil.mix}. </b>}{s.soil.text}</dd></div>}
                {s.pot?.text && <div><dt className="label"><Icon name="potted-plant-bold" size={13} /> Maceta <Src url={s.pot.source} /></dt><dd>{s.pot.drainage && <b>{DRAINAGE[s.pot.drainage]}. </b>}{s.pot.text}</dd></div>}
                {s.repot?.text && <div><dt className="label"><Icon name="arrows-clockwise-bold" size={13} /> Trasplante <Src url={s.repot.source} /></dt><dd>{s.repot.everyYears && <b>Cada {s.repot.everyYears} {s.repot.everyYears === 1 ? 'año' : 'años'}{s.repot.months?.length ? `, en ${monthsWords(s.repot.months)}` : ''}. </b>}{s.repot.text}</dd></div>}
              </dl>
            </section>
          )}

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
            {s.water.estimate && <p className="hint mono">Ninguna fuente da días de riego. Los días que propone la app salen de cuánto dejar secar la tierra, y se ajustan con tus riegos.</p>}
            {s.unverified.length > 0 && <p className="hint mono">Ninguna fuente confirmó {unverifiedWords(s.unverified)}. Ahí la guía no da un dato.</p>}
          </section>
        </div>
      </main>
    </div>
  )
}
