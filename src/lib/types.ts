export type EventType = 'water' | 'mist' | 'feed' | 'repot' | 'prune' | 'turn' | 'treat' | 'clean' | 'note' | 'photo'

/** The three kinds of care that run on a schedule. The rest are logged when they happen. */
export type ScheduledType = 'water' | 'mist' | 'feed'

export interface Garden {
  key: string
  name: string
  cold_months: number[]
  access: 'private' | 'open'
  open_until: string | null
  created_at: string
}

export interface Plant {
  garden: string
  id: string
  name: string
  species: string | null
  species_text: string
  location: string
  water_warm: number | null
  water_cold: number | null
  mist_days: number | null
  feed_days: number | null
  notes: string
  photo: string | null
  acquired_on: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

export interface CareEvent {
  id: string
  garden: string
  plant: string
  type: EventType
  at: string
  note: string
  photo: string | null
  by_name?: string
  created_at?: string
  /** Set on the phone while the entry has not reached the database yet. */
  pending?: boolean
}

export interface GardenData {
  garden: Garden
  plants: Plant[]
  events: CareEvent[]
}
