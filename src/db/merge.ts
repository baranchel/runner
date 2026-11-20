// Pure data logic for the DB layer (no React Native imports, so `node src/db/sync.check.ts` can run it).
import type { Run, RunEdits, RunType } from '../types/index.ts'

/** Columns holding JSON: TEXT in SQLite, jsonb in Postgres. */
export const JSON_COLS = ['splits', 'segments', 'zones', 'weather', 'edits'] as const

/** A run as stored (same snake_case columns locally and in the cloud), JSON columns parsed. */
export interface RunRow {
  id: string
  healthkit_uuid: string | null
  type_id: string | null
  name: string
  date: string
  distance_km: number
  time_sec: number
  avg_hr: number | null
  max_hr: number | null
  min_hr: number | null
  elev_gain: number | null
  cadence: number | null
  source: Run['source']
  notes: string | null
  splits: Run['splits']
  segments: Run['segments']
  zones: Run['zones']
  weather: Run['weather']
  edits: RunEdits
  updated_at?: string | null
}

/** Stored row → what screens show: HealthKit values with the user's edits on top. */
export function rowToRun(r: RunRow): Run {
  return {
    id: r.id, healthkitUuid: r.healthkit_uuid ?? '', typeId: r.type_id, name: r.name, date: r.date,
    distanceKm: r.distance_km, timeSec: r.time_sec, avgHr: r.avg_hr, maxHr: r.max_hr, minHr: r.min_hr,
    elevGain: r.elev_gain, cadence: r.cadence, source: r.source, notes: r.notes,
    splits: r.splits, segments: r.segments, zones: r.zones, weather: r.weather,
    ...r.edits,
    edits: r.edits,
  }
}

/** Run (without edits) → row. Used for imports (seed now, HealthKit in RA-3). */
export function runToRow(r: Run): RunRow {
  return {
    id: r.id, healthkit_uuid: r.healthkitUuid || null, type_id: r.typeId, name: r.name, date: r.date,
    distance_km: r.distanceKm, time_sec: r.timeSec, avg_hr: r.avgHr, max_hr: r.maxHr, min_hr: r.minHr,
    elev_gain: r.elevGain, cadence: r.cadence, source: r.source, notes: r.notes,
    splits: r.splits, segments: r.segments, zones: r.zones, weather: r.weather,
    edits: {},
  }
}

/** New edits after saving `patch`: a field equal to the HealthKit value is dropped (= not edited). */
export function diffEdits(raw: Run, current: RunEdits, patch: RunEdits): RunEdits {
  const next: Record<string, unknown> = { ...current }
  for (const [k, v] of Object.entries(patch)) {
    if (v === raw[k as keyof Run]) delete next[k]
    else next[k] = v
  }
  return next as RunEdits
}

/** Pulled rows minus those with unsent local changes (the local change wins until it is pushed). */
export function filterPulled<T extends { id: string }>(rows: T[], pendingIds: Set<string>): T[] {
  return rows.filter(r => !pendingIds.has(r.id))
}

// ─── Dev seed ────────────────────────────────────────────────────────────────

const MOCK_TYPE_NAMES: Record<string, string> = { easy: 'Easy', long: 'Long', tempo: 'Tempo', interval: 'Interval' }

/** Mock healthkitUuid 'hk-<uuid>' → '<uuid>': the same id on every press and every device. */
export const seedUuid = (hk: string) => hk.replace(/^hk-/, '')

export function seedRows(mock: Run[], types: RunType[]): RunRow[] {
  const byName = Object.fromEntries(types.map(t => [t.name, t.id]))
  return mock.map(r => {
    const id = seedUuid(r.healthkitUuid)
    const typeId = r.typeId ? byName[MOCK_TYPE_NAMES[r.typeId]] ?? null : null
    return runToRow({ ...r, id, healthkitUuid: id, typeId })
  })
}
