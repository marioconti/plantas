import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EVENTS } from '../lib/events.ts'
import type { CareEvent, EventType } from '../lib/types.ts'
import { Icon } from './ui.tsx'
import './actions.css'

const UNDO_MS = 6000

/**
 * The two big buttons at the thumb, fixed to the bottom. A tap logs at once; for six seconds
 * that same button becomes "Deshacer", with a bar that drains the time left to change your
 * mind. A second tap within 400 ms is ignored, so a double tap cannot undo by accident.
 */
export function ActionBar({ types, onLog, onUndo }: {
  types: EventType[]
  onLog: (t: EventType) => CareEvent
  onUndo: (e: CareEvent) => void
}) {
  const [last, setLast] = useState<CareEvent | null>(null)
  const lock = useRef(0)
  const timer = useRef<number>(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  if (!types.length) return null

  function tap(t: EventType) {
    if (Date.now() < lock.current) return
    lock.current = Date.now() + 400
    clearTimeout(timer.current)
    if (last && last.type === t) {
      onUndo(last)
      setLast(null)
      return
    }
    const e = onLog(t)
    setLast(e)
    timer.current = window.setTimeout(() => setLast(null), UNDO_MS)
  }

  return (
    <nav className="actions" aria-label="Registrar">
      {types.map((t, i) => {
        const undo = last?.type === t
        return (
          <button key={t} type="button" className={`act ${i === 0 ? 'act-primary' : 'act-second'}${undo ? ' is-undo' : ''}`} onClick={() => tap(t)}>
            {undo ? <span className="act-bar" key={last!.id} /> : null}
            <Icon name={undo ? 'clock-counter-clockwise-bold' : EVENTS[t].icon} size={22} />
            <span>{undo ? 'Deshacer' : EVENTS[t].done}</span>
          </button>
        )
      })}
    </nav>
  )
}

/** "REGADA 19·OCT": lands on the plant after a tap, and stays as the latest line of the journal. */
export function Stamp({ event }: { event: CareEvent | null }) {
  if (!event) return null
  const d = new Date(event.at)
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
  return (
    <div className="stamp" key={event.id} aria-live="polite">
      <small>{EVENTS[event.type].past.toUpperCase()}</small>
      {String(d.getDate()).padStart(2, '0')}·{months[d.getMonth()]}
    </div>
  )
}

/** A sheet that rises from the bottom on a phone and sits centred on a computer. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', k)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <p className="h2">{title}</p>
          <button type="button" className="sheet-x" onClick={onClose} aria-label="Cerrar"><Icon name="x-bold" size={22} /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

/** A short message at the bottom that leaves by itself. */
export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null)
  const t = useRef(0)
  const show = (m: string) => {
    setMsg(m)
    clearTimeout(t.current)
    t.current = window.setTimeout(() => setMsg(null), 3500)
  }
  return [msg ? <div className="toast" role="status" key={msg}>{msg}</div> : null, show]
}
