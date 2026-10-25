import { Link } from 'react-router-dom'
import type { Due } from '../lib/care.ts'
import { EVENTS, EVENT_ORDER } from '../lib/events.ts'
import { Cell, Cells, Header, Icon, Logo, Pill, Scale } from '../components/ui.tsx'
import { Vase } from '../components/Vase.tsx'
import { TabLegend } from '../components/Tablature.tsx'
import './brand.css'

/**
 * The brand manual, published with the app so it can be opened on a phone. Everything on this
 * page is drawn by the real components and the real tokens: if it looks right here, it looks
 * right in the app. Decisions in docs/plantas/direccion-de-arte.md.
 */

const COLORS: { token: string; hex: string; role: string; on: string; ratio: string }[] = [
  { token: '--green', hex: '#1F4D35', role: 'Estructura. Encabezado, botón principal, ícono', on: '#fff', ratio: 'blanco 9,7:1' },
  { token: '--water', hex: '#1F5C99', role: 'El agua. Un solo azul en toda la app', on: '#fff', ratio: 'blanco 6,9:1' },
  { token: '--mist', hex: '#A9C8DA', role: 'Rocío, y la barra del logo', on: 'var(--ink)', ratio: 'tinta 9,5:1' },
  { token: '--late', hex: '#B23A1E', role: 'Atrasada. Siempre con su palabra', on: '#fff', ratio: 'blanco 6,0:1' },
  { token: '--today', hex: '#F2C230', role: 'Hoy. Nunca texto sobre papel', on: 'var(--ink)', ratio: 'tinta 10,0:1' },
  { token: '--ok', hex: '#CFE3C8', role: 'Al día', on: 'var(--ink)', ratio: 'tinta 12,3:1' },
  { token: '--ink', hex: '#15201A', role: 'Texto, reglas, contorno del vaso', on: 'var(--paper)', ratio: 'papel 14,6:1' },
  { token: '--ink-2', hex: '#56605A', role: 'Texto secundario y rótulos', on: '#fff', ratio: 'sobre papel 5,7:1' },
  { token: '--paper', hex: '#EEF0EB', role: 'Fondo, gris verdoso', on: 'var(--ink)', ratio: 'tinta 14,6:1' },
  { token: '--surface', hex: '#FFFFFF', role: 'Celdas, tarjetas, campos', on: 'var(--ink)', ratio: 'tinta 16,8:1' },
  { token: '--cell', hex: '#DDE1DA', role: 'Vacío, sin registro', on: 'var(--ink)', ratio: 'tinta 12,7:1' },
  { token: '--line', hex: '#C9CEC6', role: 'Divisores de 1 px. Nunca texto', on: 'var(--ink)', ratio: '—' },
]

const EXAMPLE = (kind: Due['kind'], daysLeft: number, interval = 7): Due => ({
  type: 'water', kind, daysLeft, interval, last: null, due: new Date(), level: Math.max(0, Math.min(1, daysLeft / interval)),
})

export function Brand() {
  return (
    <div className="page no-actions brand">
      <Header title="Manual de marca" />
      <main className="wrap">
        <section className="brand-hero">
          <p className="label">Manual de marca · v1 · 19 de octubre de 2026</p>
          <div className="brand-logo"><Logo size={160} /></div>
          <p className="brand-idea">El vaso dice cuánto falta, la celda del herbario dice el dato y la tablatura cuenta la historia.</p>
        </section>

        <Block n="01" title="Nombre">
          <p className="brand-p"><b>Regué.</b> Es lo que decís cuando terminás y es lo que tocás, así que cada registro repite la marca. Va en minúscula en el logo y con mayúscula en el texto.</p>
        </Block>

        <Block n="02" title="Logo">
          <p className="brand-p">Una regadera amarilla que riega un brote, y la palabra en una sans redonda y gruesa. Salió de diez opciones generadas con IA en Figma, el 24 de octubre de 2026. Va sobre fondos claros.</p>
          <div className="brand-logos">
            <div className="bl bl-paper"><Logo size={48} /></div>
            <div className="bl bl-white"><Logo size={48} /></div>
            <div className="bl bl-icon"><Logo size={96} mark /></div>
            <div className="bl bl-small"><Logo size={24} /><span className="label">24 px, encabezado</span></div>
          </div>
        </Block>

        <Block n="03" title="Color">
          <p className="brand-p">El verde manda en la estructura y el gris verdoso en los fondos. El color fuerte queda para el estado, y el estado siempre va con su palabra.</p>
          <div className="swatches">
            {COLORS.map((c) => (
              <div key={c.token} className="swatch">
                <div className="swatch-chip" style={{ background: c.hex, color: c.on }}>Aa</div>
                <div className="swatch-meta"><b className="mono">{c.token}</b><span className="mono">{c.hex}</span><span>{c.role}</span><span className="mono muted">{c.ratio}</span></div>
              </div>
            ))}
          </div>
          <p className="brand-p" style={{ marginTop: 'var(--s5)' }}>Cada tipo de registro tiene su color en el diario:</p>
          <TabLegend types={EVENT_ORDER} />
        </Block>

        <Block n="04" title="Letras">
          <div className="type-spec">
            <div><span className="label">Número · Bricolage 800, ancho 75</span><p className="display" style={{ fontSize: 'clamp(120px, 38vw, 240px)' }}>37</p></div>
            <div><span className="label">Nombre · Bricolage 800, opsz 96</span><p className="h1">Helecho de Boston</p></div>
            <div><span className="label">Latín · Instrument Serif itálica</span><p className="latin">Nephrolepis exaltata</p></div>
            <div><span className="label">Rótulo · IBM Plex Mono 500, mayúsculas</span><p className="label" style={{ fontSize: 14, color: 'var(--ink)' }}>Último riego · hace 3 días</p></div>
            <div><span className="label">Texto · Bricolage 400</span><p className="brand-p">Regá cuando el primer centímetro de tierra esté seco al tacto.</p></div>
            <div><span className="label">Dato · IBM Plex Mono, cifras tabulares</span><p className="mono" style={{ fontSize: 18 }}>LUN 19·OCT · cada 7 d · 92 %</p></div>
          </div>
          <p className="hint mono">Tres familias de Google Fonts. Nada baja de 11 px y los campos quedan en 16 px para que el iPhone no haga zoom.</p>
        </Block>

        <Block n="05" title="Grilla y forma">
          <div className="grid-demo grid-4">{Array.from({ length: 4 }, (_, i) => <i key={i} />)}</div>
          <p className="mono muted">390 px · 4 columnas · margen 20 · gutter 12</p>
          <div className="grid-demo grid-12">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
          <p className="mono muted">1280 px · 12 columnas · margen 48 · gutter 24 · máximo 1184</p>
          <p className="brand-p">Esquinas rectas, porque es un herbario. Solo las píldoras son redondas, y el vaso tiene el fondo curvo. Los bordes miden 1 px en los divisores, 2 px en las reglas y 3 px en el vaso. Sin sombras ni degradados.</p>
        </Block>

        <Block n="06" title="El vaso">
          <p className="brand-p">Es la firma. El agua que queda es el tiempo que falta. Baja una marca por día, queda vacío el día que toca y cuelga un bloque bajo la base por cada día de atraso. Al tocar «Regué» se llena en 1,2 s y el número cuenta en sincronía.</p>
          <div className="vases">
            {[['ok', 5], ['soon', 1], ['today', 0], ['late', -3]].map(([k, d]) => (
              <figure key={String(k)}><Vase due={EXAMPLE(k as Due['kind'], d as number)} /><figcaption><Pill due={EXAMPLE(k as Due['kind'], d as number)} /></figcaption></figure>
            ))}
          </div>
          <p className="hint mono">Ejemplos, no datos reales.</p>
        </Block>

        <Block n="07" title="Componentes">
          <div className="stack">
            <div><span className="label">Píldoras</span><div className="pills"><Pill kind="late">3 días tarde</Pill><Pill kind="today">hoy</Pill><Pill kind="soon">mañana</Pill><Pill kind="ok">en 5 días</Pill><Pill kind="never">sin registro</Pill></div></div>
            <div><span className="label">Celdas del herbario</span>
              <Cells>
                <Cell label="Luz" icon="sun-bold">Indirecta brillante<Scale level={4} label="Luz" /></Cell>
                <Cell label="Último riego" icon="drop-bold">Hace 3 días<small>vie 16 oct</small></Cell>
              </Cells>
            </div>
            <div><span className="label">Botón grande</span>
              <div className="fake-actions"><span className="act act-primary"><Icon name="drop-fill" size={22} />Regué</span><span className="act act-second"><Icon name="spray-bottle-fill" size={22} />Rocié</span></div>
              <div className="fake-actions"><span className="act act-primary is-undo"><span className="act-bar" style={{ animation: 'none', transform: 'scaleX(.6)' }} /><Icon name="clock-counter-clockwise-bold" size={22} />Deshacer</span><span className="act act-second"><Icon name="spray-bottle-fill" size={22} />Rocié</span></div>
              <p className="hint mono">Después del toque, el mismo botón es «Deshacer» durante 6 s. La barra muestra el tiempo que queda.</p>
            </div>
          </div>
        </Block>

        <Block n="08" title="Íconos">
          <p className="brand-p">Phosphor Icons, licencia MIT. Relleno para los registros, trazo grueso para los datos.</p>
          <div className="icons">
            {EVENT_ORDER.map((t) => <span key={t}><Icon name={EVENTS[t].icon} size={28} />{EVENTS[t].noun}</span>)}
            {(['sun-bold', 'drop-bold', 'cloud-bold', 'thermometer-simple-bold', 'paw-print-bold', 'baby-bold', 'warning-bold'] as const).map((n) => <span key={n}><Icon name={n} size={28} />{n.replace('-bold', '').replace('-simple', '')}</span>)}
          </div>
        </Block>

        <Block n="09" title="Movimiento">
          <ul className="motion mono">
            <li><b>Vaso</b> 1200 ms · cubic-bezier(0.23, 1, 0.32, 1). El número cuenta en sincronía.</li>
            <li><b>Sello</b> 700 ms desde los 600 ms · cubic-bezier(0.32, 0.72, 0, 1). Sin rebote.</li>
            <li><b>Tablatura</b> el cuadrado nuevo crece en 400 ms.</li>
            <li><b>Deshacer</b> barra lineal de 6000 ms.</li>
            <li>Solo se mueve lo que informa. Con «reducir movimiento», todo cambia al instante.</li>
          </ul>
        </Block>

        <Block n="10" title="Voz">
          <p className="brand-p">Voseo, frases cortas y verbos en primera persona en los botones («Regué», «Podé»). Una oración por idea, sin «frase: explicación». Los datos de cuidado dicen de dónde salen.</p>
        </Block>

        <p className="brand-back"><Link to="/" className="btn btn-line">Volver al inicio</Link></p>
      </main>
    </div>
  )
}

function Block({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="brand-block">
      <div className="brand-head"><span className="display brand-n">{n}</span><h2 className="h2">{title}</h2></div>
      <div className="brand-body">{children}</div>
    </section>
  )
}
