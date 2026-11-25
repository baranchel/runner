// Run: node src/db/sync.check.ts
/// <reference types="node" />
import type { Run } from '../types/index.ts'
import { readFileSync } from 'node:fs'
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
  segments: null, splits: [{ km: 1, timeSec: 360, avgHr: 140 }], weather: null, hrHist: null, hrCurve: null,
  needsType: false,
  shoeId: null,
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

// RA-39: needs_type round-trips; SQLite gives 1/0, the cloud gives booleans
eq(runToRow({ ...raw, needsType: true }).needs_type, true, 'needsType → needs_type')
eq(rowToRun({ ...runToRow(raw), needs_type: 1 as unknown as boolean }).needsType, true, 'SQLite 1 → true')
eq(rowToRun({ ...runToRow(raw), needs_type: 0 as unknown as boolean }).needsType, false, 'SQLite 0 → false')
eq(rowToRun({ ...runToRow(raw), needs_type: true }).needsType, true, 'cloud true → true')
eq(rowToRun({ ...runToRow(raw), needs_type: undefined as unknown as boolean }).needsType, false, 'missing → false')

// RA-8: shoe_id round-trips
eq(runToRow({ ...raw, shoeId: 's1' }).shoe_id, 's1', 'shoeId → shoe_id')
eq(rowToRun({ ...runToRow(raw), shoe_id: 's1' }).shoeId, 's1', 'shoe_id → shoeId')
eq('shoe_id' in runToRow(raw), false, 'no shoe → column left out of the insert')
eq(rowToRun({ ...runToRow(raw), shoe_id: undefined as unknown as null }).shoeId, null, 'missing shoe_id → null')

// Tripwire: if any of these change, a HealthKit re-import could overwrite the user's type.
const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
eq(src('../healthkit/importRuns.ts').includes("writeChange('runs', 'insert'"), true, 'import is insert-only')
eq(src('./queries.ts').includes('INSERT OR IGNORE INTO ${tbl}'), true, 'local insert ignores existing rows')
eq(src('../api/sync.ts').includes('ignoreDuplicates: true'), true, 'cloud insert ignores existing rows')

console.log('sync.check: all passed')
