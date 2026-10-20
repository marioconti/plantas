import { useLayoutEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { addDays, daysBetween, dayStart, type PlantStatus } from '../lib/care.ts'
import { EVENTS, EVENT_ORDER } from '../lib/events.ts'
import type { CareEvent } from '../lib/types.ts'
import { Icon } from './ui.tsx'
import './Tablature.css'

/**
 * The diary, written like guitar tablature: every plant is a string, every column a day, and
 * every entry a square of its colour sitting on the string. The next watering is an empty
 * square waiting on its day; a late watering is a red run on the string from the day it was
 * due until today. Today is the yellow column.
 */

const LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export interface TabRow {
  status: PlantStatus
  events: CareEvent[]
  href?: string
}

export function Tablature({ rows, today, past = 34, future = 7, onPick }: {
  rows: TabRow[]
  today: Date
  past?: number
  future?: number
  onPick?: (plant: string, day: number, events: CareEvent[]) => void
}) {
  const start = addDays(today, -past)
  const days = past + 1 + future
  const scroller = useRef<HTMLDivElement>(null)

  // Open with today three columns from the right edge, the way you read a calendar.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const col = parseFloat(getComputedStyle(el).getPropertyValue('--col')) || 24
    el.scrollLeft = (past + 4) * col - el.clientWidth + 132
  }, [past, rows.length])

  const startMs = start.getTime()
  const head = useMemo(() => Array.from({ length: days }, (_, i) => addDays(startMs, i)), [days, startMs])

  return (
    <div className="tab" ref={scroller} style={{ ['--days' as string]: days }}>
      <div className="tab-inner">
        <div className="tab-head" aria-hidden>
          {head.map((d, i) => (
            <span key={i} className={`tab-day${i === past ? ' is-today' : ''}${d.getDate() === 1 ? ' is-first' : ''}`}>
              <b>{i === past ? 'HOY' : LETTERS[d.getDay()]}</b>
              <em>{d.getDate()}</em>
            </span>
          ))}
        </div>
        <div className="tab-today" style={{ left: `calc(var(--col) * ${past})` }} aria-hidden />
        {rows.map(({ status, events, href }) => (
          <TabString key={status.plant.id} status={status} events={events} start={start} days={days} past={past} href={href} onPick={onPick} />
        ))}
      </div>
    </div>
  )
}

function TabString({ status, events, start, days, past, href, onPick }: {
  status: PlantStatus; events: CareEvent[]; start: Date; days: number; past: number; href?: string
  onPick?: (plant: string, day: number, events: CareEvent[]) => void
}) {
  const { plant, water } = status
  // Entries grouped by column, most important kind first.
  const byDay = useMemo(() => {
    const m = new Map<number, CareEvent[]>()
    for (const e of events) {
      if (e.plant !== plant.id) continue
      const i = daysBetween(start, e.at)
      if (i < 0 || i >= days) continue
      m.set(i, [...(m.get(i) ?? []), e])
    }
    for (const list of m.values()) list.sort((a, b) => EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type))
    return m
  }, [events, plant.id, start, days])

  const dueCol = water ? daysBetween(start, water.due) : null
  const lateFrom = water && water.daysLeft < 0 && dueCol != null ? Math.max(0, dueCol) : null

  return (
    <div className="tab-row">
      {href ? <Link to={href} className="tab-name">{plant.name}</Link> : <span className="tab-name">{plant.name}</span>}
      <div className="tab-string" aria-hidden />
      {lateFrom != null && (
        <div className="tab-late" style={{ left: `calc(var(--col) * ${lateFrom + 0.5})`, width: `calc(var(--col) * ${past - lateFrom})` }} />
      )}
      {water && water.daysLeft > 0 && dueCol != null && dueCol < days && (
        <span className="tab-due" style={{ left: `calc(var(--col) * ${dueCol})` }} title={`Próximo riego`} />
      )}
      {[...byDay.entries()].map(([i, list]) => {
        const m = EVENTS[list[0].type]
        return (
          <button
            key={i} type="button" className={`tab-sq tab-${list[0].type}${list.some((e) => e.pending) ? ' is-pending' : ''}`}
            style={{ left: `calc(var(--col) * ${i})`, background: m.color, color: m.on }}
            onClick={() => onPick?.(plant.id, dayStart(addDays(start, i)), list)}
            aria-label={`${plant.name}: ${list.map((e) => EVENTS[e.type].noun).join(', ')}`}
          >
            <Icon name={m.icon} size={13} />
            {list.length > 1 && <sup>{list.length}</sup>}
          </button>
        )
      })}
    </div>
  )
}

/** The legend: one chip per kind of entry, in the diary's colours. */
export function TabLegend({ types = EVENT_ORDER }: { types?: typeof EVENT_ORDER }) {
  return (
    <div className="tab-legend">
      {types.map((t) => (
        <span key={t}><i style={{ background: EVENTS[t].color, color: EVENTS[t].on }}><Icon name={EVENTS[t].icon} size={11} /></i>{EVENTS[t].noun}</span>
      ))}
      <span><i className="legend-due" />próximo riego</span>
      <span><i className="legend-late" />atraso</span>
    </div>
  )
}
