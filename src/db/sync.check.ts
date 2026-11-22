// Run: node src/db/sync.check.ts
import type { Run } from '../types/index.ts'
import { cloudKey, diffEdits, filterPulled, fromCloud, rowToRun, runToRow } from './merge.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}

const raw: Run = {
  id: 'r1', healthkitUuid: 'r1', typeId: null, name: 'Easy: 10km', date: '2026-11-01',
  startedAt: '2026-11-01T05:00:00.000Z',
  distanceKm: 10, timeSec: 3600, avgHr: 140, maxHr: 160, minHr: 120,
  elevGain: 30, cadence: 170, calories: 600, source: 'apple_health', notes: null,
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
eq(runToRow(raw).started_at, '2026-11-01T05:00:00.000Z', 'startedAt → started_at')
eq(rowToRun(runToRow(raw)).startedAt, '2026-11-01T05:00:00.000Z', 'started_at → startedAt')
eq(rowToRun({ ...runToRow(raw), started_at: undefined as unknown as null }).startedAt, null, 'missing started_at → null')

// diffEdits keeps only values that differ from HealthKit
eq(diffEdits(raw, {}, { name: 'Easy: 10km', distanceKm: 10.2 }), { distanceKm: 10.2 }, 'unchanged field not stored')
eq(diffEdits(raw, { distanceKm: 10.2 }, { distanceKm: 10 }), {}, 'editing back to original removes the edit')
eq(diffEdits(raw, { avgHr: 150 }, { distanceKm: 10.2 }), { avgHr: 150, distanceKm: 10.2 }, 'earlier edits kept')
eq(diffEdits(raw, {}, { avgHr: null }), { avgHr: null }, 'clearing a value is an edit')

// filterPulled skips rows that still have unsent local changes
eq(filterPulled([{ id: 'a' }, { id: 'b' }], new Set(['b'])).map(r => r.id), ['a'], 'pending row skipped')

// profiles: cloud key is user_id, local key is id
eq(cloudKey('profiles'), 'user_id', 'profiles keyed by user_id')
eq(cloudKey('runs'), 'id', 'runs keyed by id')
eq(fromCloud('profiles', [{ user_id: 'u1', first_name: 'Bar' }]), [{ user_id: 'u1', first_name: 'Bar', id: 'u1' }], 'user_id → id')
eq(fromCloud('runs', [{ id: 'r1' }]), [{ id: 'r1' }], 'other tables unchanged')

console.log('sync.check: all passed')
