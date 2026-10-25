import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGarden } from '../lib/store.tsx'
import { Header, Icon } from '../components/ui.tsx'
import type { IconName } from '../components/icon-data.ts'
import { tagUrl } from './Settings.tsx'
import './screens.css'

// Store links checked on 2026-10-25: the App Store page is "NFC Tools" by wakdev, the Play page
// is the same app (package com.wakdev.wdnfc).
const APP_STORE = 'https://apps.apple.com/app/nfc-tools/id1252962749'
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.wakdev.wdnfc'

// Which plants already have their tag, as this phone remembers it. Only a guide for the setup:
// nothing breaks if it is lost.
const taggedKey = (k: string) => `plants:tagged:${k}`
export function taggedPlants(k: string): string[] {
  try { return JSON.parse(localStorage.getItem(taggedKey(k)) ?? '[]') as string[] } catch { return [] }
}
function markTagged(k: string, ids: string[]) {
  try { localStorage.setItem(taggedKey(k), JSON.stringify([...new Set([...taggedPlants(k), ...ids])])) } catch { /* private mode */ }
}

/** Web NFC writes tags from the page itself, but only in Chrome on Android. */
const canWriteHere = typeof window !== 'undefined' && 'NDEFReader' in window

/** The first-time checklist: plants, then one tag per plant, then the people who water. */
export function Setup() {
  const { data, key, can } = useGarden()
  const { plants } = data!
  const tagged = taggedPlants(key)
  const missing = plants.filter((p) => !tagged.includes(p.id))
  const next = missing[0]
  const tagsDone = plants.length > 0 && missing.length === 0

  return (
    <div className="page has-tabs">
      <Header back={{ to: `/g/${key}`, label: 'Plantas' }} title="Primeros pasos" />
      <main className="wrap setup">
        <p className="setup-lead">Tres pasos. Hacelos en orden y en cada uno hay un botón que te lleva.</p>
        <ol className="setup-steps">
          <SetupStep n={1} icon="potted-plant-bold" done={plants.length > 0} title="Cargá tus plantas"
            text={plants.length ? `Ya cargaste ${plants.length}. Si falta alguna, agregala.` : 'Una por maceta. Elegís la especie y la app te dice cada cuánto regarla.'}>
            {can.edit && <Link to={`/g/${key}/nueva`} className={`btn btn-block ${plants.length ? 'btn-line' : 'btn-primary'}`}><Icon name="plus-bold" /> Agregar una planta</Link>}
          </SetupStep>
          <SetupStep n={2} icon="sticker-bold" done={tagsDone} title="Grabá un tag por planta"
            text={!plants.length ? 'Primero cargá una planta.' : tagsDone ? 'Todas tienen su tag.' : `Te faltan ${missing.length} de ${plants.length}. Te guío uno por uno.`}>
            {next && <Link to={`/g/${key}/p/${next.id}/tag`} className={`btn btn-block ${plants.length && !tagsDone ? 'btn-primary' : 'btn-line'}`}><Icon name="sticker-bold" /> Grabar el de {next.name}</Link>}
            {missing.length > 1 && <ul className="setup-list">
              {missing.slice(1).map((p) => <li key={p.id}><Link to={`/g/${key}/p/${p.id}/tag`}>{p.name}<Icon name="caret-right-bold" size={16} /></Link></li>)}
            </ul>}
          </SetupStep>
          <SetupStep n={3} icon="users-three-bold" done={false} title="Sumá a quien riega con vos"
            text="Le mandás un link y desde su teléfono también anota. Es opcional.">
            {can.owner && <Link to={`/g/${key}/ajustes`} className="btn btn-line btn-block"><Icon name="users-three-bold" /> Dar un pase</Link>}
          </SetupStep>
        </ol>
        {tagsDone && <Link to={`/g/${key}`} className="btn btn-primary btn-block"><Icon name="check-bold" /> Listo, ir a mis plantas</Link>}
      </main>
    </div>
  )
}

function SetupStep({ n, icon, done, title, text, children }: { n: number; icon: IconName; done: boolean; title: string; text: string; children?: ReactNode }) {
  return (
    <li className={`setup-step${done ? ' is-done' : ''}`}>
      <span className="setup-ico" aria-hidden><Icon name={done ? 'check-bold' : icon} size={28} /></span>
      <div className="setup-body">
        <p className="setup-n">Paso {n}{done ? ' · hecho' : ''}</p>
        <h2 className="setup-title">{title}</h2>
        <p className="muted">{text}</p>
        {children}
      </div>
    </li>
  )
}

type Step = { icon: IconName; title: string; body: ReactNode; next?: string }

/** Writing one plant's tag, one action per screen. */
export function TagWizard() {
  const { data, key } = useGarden()
  const { plantId } = useParams()
  const nav = useNavigate()
  const [i, setI] = useState(0)
  const [copied, setCopied] = useState(false)
  const [nfc, setNfc] = useState<'idle' | 'writing' | 'done' | 'failed'>('idle')
  const [stuck, setStuck] = useState(false)
  const plant = data!.plants.find((p) => p.id === plantId)
  if (!plant) return <div className="page"><Header back={{ to: `/g/${key}/empezar`, label: 'Primeros pasos' }} /><main className="wrap"><p className="muted">Esa planta no está en el jardín.</p></main></div>

  const url = tagUrl(key, plant.id)
  // NFC Tools already puts "https://" in front, so the copied text goes without it.
  const bare = url.replace(/^https:\/\//, '')
  const others = data!.plants.filter((p) => p.id !== plant.id && !taggedPlants(key).includes(p.id))

  async function copy() {
    try { await navigator.clipboard.writeText(bare) } catch { window.prompt('Copiá este texto', bare) }
    setCopied(true)
  }

  async function writeHere() {
    setNfc('writing')
    try {
      // @ts-expect-error Web NFC is not in the DOM typings yet
      await new window.NDEFReader().write({ records: [{ recordType: 'url', data: url }] })
      setNfc('done')
      setI(steps.length - 1)
    } catch {
      setNfc('failed')
    }
  }

  function finish() {
    markTagged(key, [plant!.id])
    nav(others.length ? `/g/${key}/p/${others[0].id}/tag` : `/g/${key}/empezar`, { replace: true })
    setI(0); setCopied(false); setNfc('idle'); setStuck(false)
  }

  const steps: Step[] = [
    {
      icon: 'sticker-bold', title: 'Agarrá un tag',
      body: <>
        <p>Es la calcomanía redonda. Usá una nueva para <b>{plant.name}</b>.</p>
        <p className="muted">Todavía no la pegues en la maceta. Primero se graba.</p>
      </>,
    },
    canWriteHere ? {
      icon: 'contactless-payment-bold', title: 'Grabalo desde acá',
      body: <>
        <p>Tu teléfono puede grabarlo sin instalar nada.</p>
        <ol className="wz-sub">
          <li><Icon name="hand-tap-bold" /> Tocá «Grabar ahora».</li>
          <li><Icon name="device-mobile-bold" /> Apoyá el tag en el centro de la espalda del teléfono, hasta que diga «Grabado».</li>
        </ol>
        <button type="button" className="btn btn-primary btn-block" onClick={writeHere} disabled={nfc === 'writing'}>
          <Icon name="contactless-payment-bold" /> {nfc === 'writing' ? 'Acercá el tag…' : 'Grabar ahora'}
        </button>
        {nfc === 'failed' && <p className="hint is-bad">No se grabó. Fijate que el NFC esté prendido y probá de nuevo, más quieto.</p>}
      </>,
    } : {
      icon: 'download-simple-bold', title: 'Instalá NFC Tools',
      body: <>
        <p>Es la app gratis que graba el tag. Se instala una sola vez.</p>
        <div className="wz-stores">
          <a className="btn btn-line btn-block" href={APP_STORE} target="_blank" rel="noreferrer"><Icon name="app-store-logo-bold" /> iPhone · App Store</a>
          <a className="btn btn-line btn-block" href={PLAY_STORE} target="_blank" rel="noreferrer"><Icon name="google-play-logo-bold" /> Android · Google Play</a>
        </div>
        <p className="muted">Si ya la tenés, tocá «Siguiente».</p>
      </>,
    },
    ...(canWriteHere ? [] : [
      {
        icon: 'copy-bold', title: `Copiá el link de ${plant.name}`, next: copied ? undefined : 'Copiá primero',
        body: <>
          <button type="button" className={`btn btn-block ${copied ? 'btn-line' : 'btn-primary'}`} onClick={copy}>
            <Icon name={copied ? 'check-bold' : 'copy-bold'} /> {copied ? 'Copiado' : 'Copiar el link'}
          </button>
          <p className="muted">Queda guardado para pegarlo en el paso que sigue.</p>
        </>,
      } as Step,
      {
        icon: 'link-simple-bold', title: 'Pegalo en NFC Tools',
        body: <>
          <p>Abrí NFC Tools y tocá, en este orden:</p>
          <ol className="wz-sub">
            <li><Icon name="list-plus-bold" /> <b>Escribir</b> (en inglés, <i>Write</i>).</li>
            <li><Icon name="plus-bold" /> <b>Agregar un registro</b> (<i>Add a record</i>).</li>
            <li><Icon name="link-simple-bold" /> <b>URL / URI</b>.</li>
            <li><Icon name="copy-bold" /> Fijate que adelante diga <b>https://</b>, mantené apretado el campo y tocá <b>Pegar</b>.</li>
            <li><Icon name="check-bold" /> Tocá <b>OK</b>.</li>
          </ol>
        </>,
      } as Step,
      {
        icon: 'contactless-payment-bold', title: 'Grabalo',
        body: <>
          <ol className="wz-sub">
            <li><Icon name="hand-tap-bold" /> Tocá <b>Escribir</b> (<i>Write</i>), el botón que dice cuántos bytes ocupa.</li>
            <li><Icon name="device-mobile-bold" /> Apoyá el tag arriba de todo del iPhone, cerca de la cámara. En Android, en el centro de la espalda.</li>
            <li><Icon name="check-circle-bold" /> Esperá el aviso de que se grabó.</li>
          </ol>
          <p className="wz-warn"><Icon name="warning-circle-bold" /> Nunca toques <b>Bloquear</b> (<i>Lock tag</i>). No se puede deshacer y el tag queda inservible para cambios.</p>
        </>,
      } as Step,
    ]),
    {
      icon: 'hand-tap-bold', title: 'Probalo',
      body: <>
        {nfc === 'done' && <p className="wz-ok"><Icon name="check-circle-bold" /> Grabado.</p>}
        <ol className="wz-sub">
          <li><Icon name="device-mobile-bold" /> Salí a la pantalla de inicio del teléfono, desbloqueado.</li>
          <li><Icon name="sticker-bold" /> Acercá el tag como antes.</li>
          <li><Icon name="check-circle-bold" /> Tiene que aparecer un aviso. Tocalo y se abre la ficha de <b>{plant.name}</b>.</li>
        </ol>
        <button type="button" className="btn btn-primary btn-block" onClick={finish}>
          <Icon name="check-bold" /> Sí, se abrió{others.length ? `. Sigo con ${others[0].name}` : ''}
        </button>
        <button type="button" className="btn btn-line btn-block" onClick={() => setStuck(true)}>No se abrió</button>
        {stuck && <div className="wz-help">
          <p><b>Probá esto:</b></p>
          <ul>
            <li>El iPhone tiene que estar desbloqueado y con la pantalla prendida.</li>
            <li>En Android, el NFC tiene que estar prendido en Ajustes.</li>
            <li>Si no aparece nada, volvé a grabarlo: <button type="button" className="link" onClick={() => { setStuck(false); setI(1) }}>empezar de nuevo desde el paso 2</button>.</li>
          </ul>
        </div>}
        <p className="muted">Ahora sí, pegá el tag en la maceta.</p>
      </>,
    },
  ]
  const s = steps[Math.min(i, steps.length - 1)]
  const last = i >= steps.length - 1

  return (
    <div className="page no-actions">
      <Header back={{ to: `/g/${key}/empezar`, label: 'Primeros pasos' }} title={`Tag de ${plant.name}`} />
      <main className="wrap wz">
        <div className="wz-dots" aria-label={`Paso ${i + 1} de ${steps.length}`}>
          {steps.map((_, n) => <i key={n} className={n < i ? 'is-done' : n === i ? 'is-on' : ''} />)}
        </div>
        <p className="setup-n">Paso {i + 1} de {steps.length}</p>
        <span className="wz-ico" aria-hidden><Icon name={s.icon} size={44} /></span>
        <h1 className="wz-title">{s.title}</h1>
        <div className="wz-body">{s.body}</div>
        {!last && <div className="wz-nav">
          {i > 0 && <button type="button" className="btn btn-line" onClick={() => setI(i - 1)}><Icon name="caret-left-bold" /> Atrás</button>}
          <button type="button" className="btn btn-primary" disabled={!!s.next} onClick={() => setI(i + 1)}>{s.next ?? 'Siguiente'} <Icon name="caret-right-bold" /></button>
        </div>}
        {last && i > 0 && <button type="button" className="btn btn-line wz-back" onClick={() => setI(i - 1)}><Icon name="caret-left-bold" /> Atrás</button>}
      </main>
    </div>
  )
}
