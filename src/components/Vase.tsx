import { useEffect, useRef, useState } from 'react'
import type { Due } from '../lib/care.ts'
import './Vase.css'

/**
 * The signature: a measuring vase. The water left is the time left until the next watering.
 * It drains one graduation a day, sits empty on the due day, and hangs one block under its
 * base for every day it is late. Watering fills it to the top. Frozen on any frame it still
 * says how many days are left, which is the test for movement that is allowed to exist.
 */
export function Vase({ due, kind = 'water', size = 'lg' }: { due: Due | null; kind?: 'water' | 'mist'; size?: 'lg' | 'sm' | 'xs' }) {
  const level = due ? (due.kind === 'never' ? 0 : due.level) : 0
  const late = due && due.daysLeft < 0 ? Math.min(7, -due.daysLeft) : 0
  const ticks = due ? Math.min(due.interval, 14) : 0
  // Fill from empty on first paint, then follow the level: opening a plant shows where it stands.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(level))
    return () => cancelAnimationFrame(r)
  }, [level])

  return (
    <div className={`vase vase-${size} vase-${kind}${late ? ' is-late' : ''}${due?.kind === 'never' ? ' is-never' : ''}`}>
      <div className="vase-glass">
        <div className="vase-fill" style={{ transform: `scaleY(${shown})` }} />
        {size === 'lg' && ticks > 1 && (
          <div className="vase-ticks" aria-hidden>
            {Array.from({ length: ticks - 1 }, (_, i) => <i key={i} style={{ bottom: `${((i + 1) / ticks) * 100}%` }} />)}
          </div>
        )}
      </div>
      {size === 'lg' && late > 0 && (
        <div className="vase-debt" aria-hidden>
          {Array.from({ length: late }, (_, i) => <i key={i} />)}
        </div>
      )}
    </div>
  )
}

/** The big number next to the vase. It counts to its new value in step with the water. */
export function CountUp({ value, ms = 1200 }: { value: number; ms?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    from.current = value
    if (start === value || matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(value)
    const t0 = performance.now()
    let raf = 0
    // Same curve as the vase (0.23, 1, 0.32, 1), approximated: fast at first, settling late.
    const ease = (x: number) => 1 - Math.pow(1 - x, 5)
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setShown(Math.round(start + (value - start) * ease(p)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return <>{Math.abs(shown)}</>
}
