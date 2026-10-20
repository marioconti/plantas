import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ICONS, type IconName } from './icon-data.ts'
import type { Due } from '../lib/care.ts'
import { dueShort } from '../lib/care.ts'
import './ui.css'

/** A Phosphor icon, drawn inline in the current text colour. */
export function Icon({ name, size = 20, label, style }: { name: IconName; size?: number; label?: string; style?: CSSProperties }) {
  return (
    <svg
      className="icon" width={size} height={size} viewBox="0 0 256 256" fill="currentColor" style={style}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  )
}

/**
 * The wordmark: "regué" with the accent of the é replaced by a level bar — the line of water
 * in the vase, "filled up to the mark". It is the letter edited, not a drawing next to it.
 */
export function Logo({ size = 24, mark = false }: { size?: number; mark?: boolean }) {
  return (
    <span className={mark ? 'logo logo-mark' : 'logo'} style={{ fontSize: size }} aria-label="Regué" role="img">
      {!mark && <span aria-hidden>regu</span>}
      <span className="logo-e" aria-hidden>e<i /></span>
    </span>
  )
}

/** Green header: the wordmark (or a way back) on the left, a real fact on the right. */
export function Header({ back, right, title }: { back?: { to: string; label: string }; right?: ReactNode; title?: ReactNode }) {
  return (
    <header className="header">
      <div className="wrap header-in">
        {back ? (
          <Link to={back.to} className="header-back"><Icon name="arrow-left-bold" size={18} /> {back.label}</Link>
        ) : (
          <Link to="/" className="header-logo" aria-label="Inicio">{title ?? <Logo size={26} />}</Link>
        )}
        {right && <div className="header-right">{right}</div>}
      </div>
    </header>
  )
}

const PILL_CLASS: Record<Due['kind'], string> = { late: 'pill-late', today: 'pill-today', soon: 'pill-soon', ok: 'pill-ok', never: 'pill-never' }

export function Pill({ due, children, kind }: { due?: Due | null; children?: ReactNode; kind?: Due['kind'] }) {
  const k = kind ?? due?.kind ?? 'never'
  return <span className={`pill ${PILL_CLASS[k]}`}>{children ?? (due ? dueShort(due) : '')}</span>
}

/** A labelled herbarium cell: mono label on top, the value below. */
export function Cell({ label, children, icon, wide }: { label: string; children: ReactNode; icon?: IconName; wide?: boolean }) {
  return (
    <div className={wide ? 'cell cell-wide' : 'cell'}>
      <span className="label">{icon && <Icon name={icon} size={13} />}{label}</span>
      <div className="cell-value">{children}</div>
    </div>
  )
}

export function Cells({ children }: { children: ReactNode }) {
  return <div className="cells">{children}</div>
}

/** Five segments filled up to `level` (1–5). Segments, never dots. */
export function Scale({ level, of = 5, label }: { level: number; of?: number; label: string }) {
  return (
    <span className="scale" role="img" aria-label={`${label}: ${level} de ${of}`}>
      {Array.from({ length: of }, (_, i) => <i key={i} className={i < level ? 'on' : ''} />)}
    </span>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="h2">{title}</p>
      {children}
    </div>
  )
}
