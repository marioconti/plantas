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
 * The logo: a watering can pouring on a sprout, and the word. Chosen by Mario from ten generated
 * options (docs/plantas/logo/, 2026-10-24); tools/logo-cut.mjs cuts it into public/brand/.
 * `size` is the height of the letters; `mark` is the can and the sprout alone.
 */
export function Logo({ size = 24, mark = false }: { size?: number; mark?: boolean }) {
  return <img className="logo" src={`${import.meta.env.BASE_URL}brand/${mark ? 'mark' : 'logo'}.png`} alt="Regué" style={{ height: Math.round(size * (mark ? 1 : 1.45)) }} />
}

/**
 * An app bar, not a website banner: a round back button (or the wordmark) on the left, the
 * screen's title in the middle, one round action on the right.
 */
export function Header({ back, title, action }: { back?: { to: string; label: string }; title?: ReactNode; action?: ReactNode }) {
  return (
    <header className="header">
      <div className="wrap header-in">
        <div className="header-side">
          {back ? (
            <Link to={back.to} className="round-btn" aria-label={`Volver a ${back.label}`}><Icon name="caret-left-bold" size={20} /></Link>
          ) : (
            <Link to="/" className="header-logo" aria-label="Inicio"><Logo size={28} /></Link>
          )}
        </div>
        {back && title ? <p className="header-title">{title}</p> : <span />}
        <div className="header-side is-end">{action}</div>
      </div>
    </header>
  )
}

/** A round icon button for the app bar. */
export function RoundLink({ to, icon, label }: { to: string; icon: IconName; label: string }) {
  return <Link to={to} className="round-btn" aria-label={label}><Icon name={icon} size={20} /></Link>
}

const PILL_CLASS: Record<Due['kind'], string> = { late: 'pill-late', check: 'pill-today', today: 'pill-today', soon: 'pill-soon', ok: 'pill-ok', never: 'pill-never' }

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
