import { test } from 'node:test'
import assert from 'node:assert/strict'
import { byUrgency, daysBetween, dueFor, dueShort, intervalFor, regularity, statusOf } from './care.ts'
import type { CareEvent, Plant } from './types.ts'

const garden = { cold_months: [5, 6, 7, 8, 9] }
const today = new Date(2026, 9, 19, 10, 0) // lun 19 oct 2026, a warm month

function plant(over: Partial<Plant> = {}): Plant {
  return {
    garden: 'g', id: 'helecho-01', name: 'Helecho', species: null, species_text: '', location: '',
    water_warm: 7, water_cold: 12, mist_days: 2, feed_days: null, notes: '', photo: null,
    acquired_on: null, archived: false, created_at: '', updated_at: '', ...over,
  }
}
let n = 0
function ev(type: CareEvent['type'], at: Date, p = 'helecho-01'): CareEvent {
  return { id: String(++n), garden: 'g', plant: p, type, at: at.toISOString(), note: '', photo: null }
}
const daysAgo = (k: number, h = 10) => new Date(2026, 9, 19 - k, h, 0)

test('calendar days, not 24-hour blocks', () => {
  assert.equal(daysBetween(new Date(2026, 9, 18, 23, 50), new Date(2026, 9, 19, 0, 10)), 1)
  assert.equal(daysBetween(new Date(2026, 9, 19, 0, 10), new Date(2026, 9, 19, 23, 50)), 0)
})

test('the season picks the interval', () => {
  assert.equal(intervalFor(plant(), 'water', today, garden), 7)
  assert.equal(intervalFor(plant(), 'water', new Date(2026, 6, 1), garden), 12)
  assert.equal(intervalFor(plant({ water_cold: null }), 'water', new Date(2026, 6, 1), garden), 7)
  assert.equal(intervalFor(plant({ water_warm: null }), 'water', today, garden), null)
})

test('late, today, soon, ok and never', () => {
  assert.deepEqual(
    [10, 7, 6, 2].map((k) => dueFor(plant(), 'water', [ev('water', daysAgo(k))], today, garden)!.kind),
    ['late', 'today', 'soon', 'ok'],
  )
  const late = dueFor(plant(), 'water', [ev('water', daysAgo(10))], today, garden)!
  assert.equal(late.daysLeft, -3)
  assert.equal(late.level, 0)
  assert.equal(dueShort(late), '3 días tarde')
  assert.equal(dueFor(plant(), 'water', [], today, garden)!.kind, 'never')
  assert.equal(dueFor(plant({ mist_days: null }), 'mist', [], today, garden), null)
})

test('the latest entry wins, whatever the order', () => {
  const d = dueFor(plant(), 'water', [ev('water', daysAgo(1)), ev('water', daysAgo(9))], today, garden)!
  assert.equal(d.daysLeft, 6)
  assert.equal(Math.round(d.level * 100), 86)
})

test('the list is sorted by the most pressing care', () => {
  const plants = [plant({ id: 'a', name: 'A' }), plant({ id: 'b', name: 'B' }), plant({ id: 'c', name: 'C', mist_days: null })]
  const events = [
    ev('water', daysAgo(2), 'a'), ev('mist', daysAgo(1), 'a'),
    ev('water', daysAgo(9), 'b'), ev('mist', daysAgo(0), 'b'),
    ev('water', daysAgo(7), 'c'),
  ]
  const s = byUrgency(plants, events, today, garden)
  assert.deepEqual(s.map((x) => x.plant.id), ['b', 'c', 'a'])
  assert.deepEqual(s.map((x) => x.group), ['late', 'today', 'next'])
  assert.equal(statusOf(plants[0], events, today, garden).worst!.type, 'mist')
})

test('regularity counts waterings that came at most a day late', () => {
  const events = [daysAgo(29), daysAgo(22), daysAgo(14), daysAgo(7), daysAgo(0)].map((d) => ev('water', d))
  const r = regularity(plant(), events, today, garden)
  assert.equal(r.count, 5)
  assert.equal(r.meanGap, 7.3)
  assert.equal(r.onTime, 1)
  assert.equal(r.streak, 4)
  // 29 sep is a cold month (12 days), so the plant has no cold interval here to keep the test on 7.
  const r2 = regularity(plant({ water_cold: null }), [daysAgo(20), daysAgo(10), daysAgo(3)].map((d) => ev('water', d)), today, garden)
  assert.equal(r2.onTime, 0.5)
  assert.equal(r2.streak, 1)
})

test('a mist or feed schedule never logged does not make a plant urgent', () => {
  const p = plant({ feed_days: 30 })
  const s = statusOf(p, [ev('water', daysAgo(2)), ev('mist', daysAgo(0))], today, garden)
  assert.equal(s.feed!.kind, 'never')
  assert.equal(s.group, 'next')
  assert.equal(s.worst!.type, 'mist')
})
