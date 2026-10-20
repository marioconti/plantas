import { SUPABASE_KEY, SUPABASE_URL } from '../config.ts'
import type { CareEvent, Garden, GardenData, Plant } from './types.ts'

/**
 * The only door to the database: Postgres functions called through PostgREST. No SDK — every
 * call is one `fetch`, so the page carries no extra library. See supabase/schema.sql.
 */

const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(args) })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.message || `${fn} failed`, res.status)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Which garden, and who is asking: the pass this phone holds for it, if any. */
export interface Auth { key: string; pass: string | null }

export interface Me { role: Role; name: string }
export type Role = 'owner' | 'member' | 'guest' | 'visitor'

export interface PassRow {
  id: string
  name: string
  role: Exclude<Role, 'visitor'>
  expires_at: string | null
  revoked: boolean
  created_at: string
  last_used_at: string | null
  mine: boolean
}

const A = (a: Auth) => ({ p_key: a.key, p_pass: a.pass })

export const api = {
  createGarden: (key: string, name: string, owner: string) =>
    rpc<{ garden: Garden; pass: string }>('plants_create_garden', { p_key: key, p_name: name, p_owner: owner }),
  updateGarden: (a: Auth, name: string, coldMonths: number[]) =>
    rpc<Garden>('plants_update_garden', { ...A(a), p_name: name, p_cold_months: coldMonths }),
  setAccess: (a: Auth, access: 'private' | 'open', until: string | null) =>
    rpc<Garden>('plants_set_access', { ...A(a), p_access: access, p_until: until }),
  passes: (a: Auth) => rpc<PassRow[]>('plants_passes_list', A(a)),
  createPass: (a: Auth, name: string, role: PassRow['role'], expires: string | null) =>
    rpc<{ id: string; token: string }>('plants_create_pass', { ...A(a), p_name: name, p_role: role, p_expires: expires }),
  revokePass: (a: Auth, id: string) => rpc<void>('plants_revoke_pass', { ...A(a), p_id: id }),
  load: (a: Auth, since: Date) => rpc<GardenData & { me: Me }>('plants_load', { ...A(a), p_since: since.toISOString() }),
  history: (a: Auth, plant: string, before: string | null, limit = 50) =>
    rpc<CareEvent[]>('plants_history', { ...A(a), p_plant: plant, p_before: before, p_limit: limit }),
  savePlant: (a: Auth, p: Partial<Plant>) => rpc<Plant>('plants_save_plant', { ...A(a), p }),
  deletePlant: (a: Auth, plant: string) => rpc<void>('plants_delete_plant', { ...A(a), p_plant: plant }),
  log: (a: Auth, e: CareEvent) =>
    rpc<CareEvent>('plants_log', { ...A(a), p_id: e.id, p_plant: e.plant, p_type: e.type, p_at: e.at, p_note: e.note, p_photo: e.photo }),
  unlog: (a: Auth, id: string) => rpc<void>('plants_unlog', { ...A(a), p_id: id }),
}

// ---------------------------------------------------------------- the pass on this phone

const passKey = (k: string) => `plants:pass:${k}`

export function readPass(key: string): string | null {
  try { return localStorage.getItem(passKey(key)) } catch { return null }
}
export function savePass(key: string, token: string | null) {
  try { if (token) localStorage.setItem(passKey(key), token); else localStorage.removeItem(passKey(key)) } catch { /* private mode */ }
}

// ---------------------------------------------------------------- photos

/** Public address of a stored photo. */
export function photoUrl(path: string | null | undefined): string | null {
  return path ? `${SUPABASE_URL}/storage/v1/object/public/plants/${path}` : null
}

/**
 * Shrinks a photo on the phone (longest side 1600 px, WebP, JPEG where WebP encoding is missing)
 * and uploads it under the garden's folder. Returns the storage path to keep in the database.
 * A phone photo is 3–5 MB; this lands at 150–400 KB.
 */
export async function uploadPhoto(key: string, plant: string, file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82))
  if (!blob || blob.type !== 'image/webp') blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
  if (!blob) throw new Error('No se pudo leer la foto')
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${key}/${plant}/${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}.${ext}`
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/plants/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': blob.type, 'Cache-Control': '31536000' },
    body: blob,
  })
  if (!res.ok) throw new ApiError('No se pudo subir la foto', res.status)
  return path
}

// ---------------------------------------------------------------- ids

/** RFC 4122 v4 from getRandomValues: crypto.randomUUID needs a secure context. */
export function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** A garden key: 128 random bits in URL-safe base64, 22 characters. */
export function newGardenKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** "Helecho de Boston" -> "helecho-de-boston". The id written on the tag. */
export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'planta'
}
