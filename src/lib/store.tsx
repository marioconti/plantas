import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, readPass, savePass, uuid, type Auth, type Me } from './api.ts'
import type { CareEvent, EventType, Garden, GardenData, Plant } from './types.ts'

/**
 * One garden, as the phone sees it.
 *
 * LOCAL FIRST. The last copy the server sent is kept on the phone, so tapping a tag draws the
 * plant at once, before the network answers. Every change is an operation: applied to the
 * screen at once, queued on the phone, and sent in order when there is a connection. What the
 * screen shows is always
 *
 *     last copy confirmed by the server  +  operations not yet sent
 *
 * A journal entry carries its own id, made here, so an entry sent twice (the connection dropped
 * after the server answered) is stored once. Same design as Súper (projects/super/store.js).
 */

type Op =
  | { kind: 'log'; event: CareEvent }
  | { kind: 'unlog'; id: string }
  | { kind: 'save'; plant: Plant }

type Status = 'loading' | 'ready' | 'missing' | 'private' | 'error'

const LOAD_DAYS = 400 // a year of journal and a bit: the diary, the progress and the regularity all fit
const cacheKey = (k: string) => `plants:data:${k}`
const outboxKey = (k: string) => `plants:outbox:${k}`
const asideKey = (k: string) => `plants:refused:${k}`
const UNDO_DAY = 86_400_000 // guests and visitors may take out their own entries for a day; the database checks it too

/** What the server refused, kept on the phone instead of thrown away. The last 50. */
function setAside(k: string, op: Op) {
  write(asideKey(k), [{ op, at: new Date().toISOString() }, ...read<unknown[]>(asideKey(k), [])].slice(0, 50))
}

function read<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* private mode or full storage: the page still works, it just forgets on reload */
  }
}

// ---------------------------------------------------------------- the gardens this phone knows

export interface KnownGarden { key: string; name: string; seen: string }

export function knownGardens(): KnownGarden[] {
  return read<KnownGarden[]>('plants:gardens', [])
}
function remember(g: Garden) {
  const list = knownGardens().filter((x) => x.key !== g.key)
  write('plants:gardens', [{ key: g.key, name: g.name, seen: new Date().toISOString() }, ...list].slice(0, 5))
}

// ---------------------------------------------------------------- applying operations

function apply(data: GardenData, ops: Op[]): GardenData {
  if (!ops.length) return data
  let { plants, events } = data
  for (const op of ops) {
    if (op.kind === 'log') {
      if (!events.some((e) => e.id === op.event.id)) events = [{ ...op.event, pending: true }, ...events]
    } else if (op.kind === 'unlog') {
      events = events.filter((e) => e.id !== op.id)
    } else {
      const i = plants.findIndex((p) => p.id === op.plant.id)
      plants = i < 0 ? [...plants, op.plant] : plants.map((p, j) => (j === i ? op.plant : p))
    }
  }
  return { ...data, plants, events }
}

// ---------------------------------------------------------------- the context

interface GardenApi {
  key: string
  auth: Auth
  /** Who this phone is in this garden, and what it may do. */
  me: Me | null
  can: { edit: boolean; owner: boolean }
  /** Whether this phone may take this entry out of the journal. */
  canUndo: (e: CareEvent) => boolean
  setPass: (token: string | null) => void
  status: Status
  error: string | null
  data: GardenData | null
  today: Date
  pending: number
  log: (plant: string, type: EventType, extra?: { note?: string; photo?: string | null; at?: string }) => CareEvent
  unlog: (id: string) => void
  savePlant: (p: Plant) => void
  deletePlant: (id: string) => Promise<void>
  updateGarden: (name: string, coldMonths: number[]) => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<GardenApi | null>(null)

export function useGarden(): GardenApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGarden outside GardenProvider')
  return v
}

export function GardenProvider({ gardenKey, children }: { gardenKey: string; children: ReactNode }) {
  const [server, setServer] = useState<(GardenData & { me?: Me }) | null>(() => read<(GardenData & { me?: Me }) | null>(cacheKey(gardenKey), null))
  const [pass, setPassState] = useState<string | null>(() => readPass(gardenKey))
  const auth = useMemo<Auth>(() => ({ key: gardenKey, pass }), [gardenKey, pass])
  const authRef = useRef(auth)
  authRef.current = auth
  const [ops, setOps] = useState<Op[]>(() => read<Op[]>(outboxKey(gardenKey), []))
  const [status, setStatus] = useState<Status>(server ? 'ready' : 'loading')
  const [error, setError] = useState<string | null>(null)
  const [today, setToday] = useState(() => new Date())
  const opsRef = useRef(ops)
  const flushing = useRef(false)

  // The day turns over while the page is open: the due dates move with it.
  useEffect(() => {
    const t = setInterval(() => setToday((d) => (new Date().getDate() !== d.getDate() ? new Date() : d)), 60_000)
    return () => clearInterval(t)
  }, [])

  const setQueue = useCallback((next: Op[]) => {
    opsRef.current = next
    write(outboxKey(gardenKey), next)
    setOps(next)
  }, [gardenKey])

  const reload = useCallback(async () => {
    try {
      const since = new Date(Date.now() - LOAD_DAYS * 86_400_000)
      const d = await api.load(authRef.current, since)
      write(cacheKey(gardenKey), d)
      remember(d.garden)
      setServer(d)
      setStatus('ready')
      setError(null)
    } catch (e) {
      if (e instanceof ApiError && e.message === 'unknown garden') setStatus('missing')
      else if (e instanceof ApiError && e.message === 'private garden') {
        // Forget what this phone had seen: a revoked pass must not keep showing the garden.
        try { localStorage.removeItem(cacheKey(gardenKey)) } catch { /* ignore */ }
        setServer(null)
        setStatus('private')
      } else {
        setError('Sin conexión. Se muestra lo último que se cargó.')
        setStatus((s) => (s === 'loading' ? 'error' : s))
      }
    }
  }, [gardenKey])

  /** Sends the queue in order. Stops at the first network failure and tries again later. */
  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      while (opsRef.current.length) {
        const op = opsRef.current[0]
        try {
          if (op.kind === 'log') await api.log(authRef.current, op.event)
          else if (op.kind === 'unlog') await api.unlog(authRef.current, op.id)
          else await api.savePlant(authRef.current, op.plant)
        } catch (e) {
          if (!(e instanceof ApiError)) break
          // No pass, or a pass that expired while there was no signal: keep everything until a
          // new pass arrives. Same for a busy or missing server.
          if (e.message === 'private garden') { setError('El jardín es privado: hace falta un pase. Lo anotado queda en el teléfono.'); break }
          // PostgREST answers both 'private garden' and 'not allowed' with 401 to the publishable
          // key, so the message decides, not the status.
          const refused = e.message === 'not allowed'
          if (!refused && (e.status < 400 || [401, 404, 408, 429].includes(e.status) || e.status >= 500)) break
          // The server said no to this one (bad data, plant deleted elsewhere, not allowed): set it
          // aside rather than block the queue.
          setError(refused ? 'Tu pase no permite ese cambio.' : `No se pudo guardar: ${e.message}`)
          setAside(gardenKey, op)
        }
        setQueue(opsRef.current.slice(1))
      }
      if (!opsRef.current.length) await reload()
    } finally {
      flushing.current = false
    }
  }, [gardenKey, reload, setQueue])

  useEffect(() => {
    void reload().then(flush)
    const wake = () => document.visibilityState === 'visible' && void flush().then(() => reload())
    window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', wake)
    const t = setInterval(() => void flush(), 30_000)
    return () => {
      window.removeEventListener('online', wake)
      document.removeEventListener('visibilitychange', wake)
      clearInterval(t)
    }
  }, [reload, flush])

  const enqueue = useCallback((op: Op) => {
    setQueue([...opsRef.current, op])
    void flush()
  }, [flush, setQueue])

  const log: GardenApi['log'] = useCallback((plant, type, extra = {}) => {
    const event: CareEvent = {
      id: uuid(), garden: gardenKey, plant, type,
      at: extra.at ?? new Date().toISOString(), note: extra.note ?? '', photo: extra.photo ?? null,
    }
    enqueue({ kind: 'log', event })
    return event
  }, [enqueue, gardenKey])

  const unlog = useCallback((id: string) => {
    // Never sent yet: just take it out of the queue.
    const queued = opsRef.current.findIndex((o) => o.kind === 'log' && o.event.id === id)
    if (queued >= 0 && !flushing.current) setQueue(opsRef.current.filter((_, i) => i !== queued))
    else enqueue({ kind: 'unlog', id })
    setServer((s) => (s ? { ...s, events: s.events.filter((e) => e.id !== id) } : s))
  }, [enqueue, setQueue])

  const savePlant = useCallback((p: Plant) => enqueue({ kind: 'save', plant: { ...p, updated_at: new Date().toISOString() } }), [enqueue])

  const deletePlant = useCallback(async (id: string) => {
    await api.deletePlant(authRef.current, id)
    await reload()
  }, [reload])

  const updateGarden = useCallback(async (name: string, coldMonths: number[]) => {
    await api.updateGarden(authRef.current, name, coldMonths)
    await reload()
  }, [reload])

  const setPass = useCallback((token: string | null) => {
    savePass(gardenKey, token)
    authRef.current = { key: gardenKey, pass: token }
    setPassState(token)
    setStatus('loading')
    void reload()
  }, [gardenKey, reload])

  const data = useMemo(() => (server ? apply(server, ops) : null), [server, ops])

  const me = server?.me ?? null
  const edit = me?.role === 'owner' || me?.role === 'member'
  const value: GardenApi = {
    key: gardenKey, auth, me, setPass,
    can: { edit, owner: me?.role === 'owner' },
    canUndo: (e) => edit || !!e.pending || (!!me && e.by_name === me.name && Date.now() - Date.parse(e.created_at ?? e.at) < UNDO_DAY),
    status, error, data, today, pending: ops.length,
    log, unlog, savePlant, deletePlant, updateGarden, reload,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
