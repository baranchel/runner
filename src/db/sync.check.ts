// Run: node src/db/sync.check.ts
import type { Run, RunType } from '../types/index.ts'
import { diffEdits, filterPulled, rowToRun, runToRow, seedRows, seedUuid } from './merge.ts'
import { MOCK_RUNS } from '../mockData.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}

const raw: Run = {
  id: 'r1', healthkitUuid: 'r1', typeId: null, name: 'Easy: 10km', date: '2026-11-01',
  distanceKm: 10, timeSec: 3600, avgHr: 140, maxHr: 160, minHr: 120,
  elevGain: 30, cadence: 170, source: 'apple_health', notes: null,
  segments: null, splits: [{ km: 1, timeSec: 360, avgHr: 140 }], weather: null, zones: null,
}

// rowToRun applies edits on top, keeps the rest
const row = { ...runToRow(raw), edits: { distanceKm: 10.2, avgHr: 150 } }
const merged = rowToRun(row)
eq(merged.distanceKm, 10.2, 'edited distance wins')
eq(merged.avgHr, 150, 'edited HR wins')
eq(merged.timeSec, 3600, 'untouched field keeps HealthKit value')
eq(merged.splits, raw.splits, 'json columns pass through')
eq(rowToRun(runToRow(raw)).distanceKm, 10, 'no edits changes nothing')

// diffEdits keeps only values that differ from HealthKit
eq(diffEdits(raw, {}, { name: 'Easy: 10km', distanceKm: 10.2 }), { distanceKm: 10.2 }, 'unchanged field not stored')
eq(diffEdits(raw, { distanceKm: 10.2 }, { distanceKm: 10 }), {}, 'editing back to original removes the edit')
eq(diffEdits(raw, { avgHr: 150 }, { distanceKm: 10.2 }), { avgHr: 150, distanceKm: 10.2 }, 'earlier edits kept')
eq(diffEdits(raw, {}, { avgHr: null }), { avgHr: null }, 'clearing a value is an edit')

// filterPulled skips rows that still have unsent local changes
eq(filterPulled([{ id: 'a' }, { id: 'b' }], new Set(['b'])).map(r => r.id), ['a'], 'pending row skipped')

// seed: stable uuids, mock types mapped by name
eq(seedUuid('hk-00000000-0001-4000-8000-000000000001'), '00000000-0001-4000-8000-000000000001', 'seed uuid')
const types: RunType[] = [
  { id: 't-easy', name: 'Easy', hue: 170 }, { id: 't-long', name: 'Long', hue: 220 },
  { id: 't-tempo', name: 'Tempo', hue: 70 }, { id: 't-int', name: 'Interval', hue: 320 },
]
const seeded = seedRows(MOCK_RUNS, types)
eq(seeded.length, MOCK_RUNS.length, 'every mock run seeded')
eq(new Set(seeded.map(r => r.id)).size, MOCK_RUNS.length, 'seed ids unique')
eq(seeded.every(r => /^[0-9a-f-]{36}$/.test(r.id)), true, 'seed ids are uuids')
eq(seedRows(MOCK_RUNS, types)[0].id, seeded[0].id, 'seed ids stable across calls')
eq([...new Set(seeded.map(r => r.type_id))].sort(), ['t-easy', 't-int', 't-long', 't-tempo'], 'mock types mapped')
eq(seeded[0].edits, {}, 'seeded runs have no edits')

console.log('sync.check: all passed')
