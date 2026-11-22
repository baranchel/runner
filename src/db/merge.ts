// Pure data logic for the DB layer (no React Native imports, so `node src/db/sync.check.ts` can run it).
import type { Run, RunEdits } from '../types/index.ts'

/** Columns holding JSON: TEXT in SQLite, jsonb in Postgres. */
export const JSON_COLS = ['splits', 'segments', 'hr_hist', 'hr_curve', 'weather', 'edits'] as const

/** A run as stored (same snake_case columns locally and in the cloud), JSON columns parsed. */
export interface RunRow {
  id: string
  healthkit_uuid: string | null
  type_id: string | null
  name: string
  date: string
  started_at: string | null
  distance_km: number
  time_sec: number
  avg_hr: number | null
  max_hr: number | null
  min_hr: number | null
  elev_gain: number | null
  cadence: number | null
  calories: number | null
  source: Run['source']
  notes: string | null
  splits: Run['splits']
  segments: Run['segments']
  hr_hist: Run['hrHist']
  hr_curve: Run['hrCurve']
  weather: Run['weather']
  edits: RunEdits
  updated_at?: string | null
}

/** Stored row → what screens show: HealthKit values with the user's edits on top. */
export function rowToRun(r: RunRow): Run {
  return {
    id: r.id, healthkitUuid: r.healthkit_uuid ?? '', typeId: r.type_id, name: r.name, date: r.date, startedAt: r.started_at ?? null,
    distanceKm: r.distance_km, timeSec: r.time_sec, avgHr: r.avg_hr, maxHr: r.max_hr, minHr: r.min_hr,
    elevGain: r.elev_gain, cadence: r.cadence, calories: r.calories ?? null, source: r.source, notes: r.notes,
    splits: r.splits, segments: r.segments, hrHist: r.hr_hist ?? null, hrCurve: r.hr_curve ?? null, weather: r.weather,
    ...r.edits,
    edits: r.edits,
  }
}

/** Run (without edits) → row. Used for HealthKit imports. */
export function runToRow(r: Run): RunRow {
  return {
    id: r.id, healthkit_uuid: r.healthkitUuid || null, type_id: r.typeId, name: r.name, date: r.date, started_at: r.startedAt,
    distance_km: r.distanceKm, time_sec: r.timeSec, avg_hr: r.avgHr, max_hr: r.maxHr, min_hr: r.minHr,
    elev_gain: r.elevGain, cadence: r.cadence, calories: r.calories, source: r.source, notes: r.notes,
    splits: r.splits, segments: r.segments, hr_hist: r.hrHist, hr_curve: r.hrCurve, weather: r.weather,
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

/** Column that identifies a row in the cloud. profiles has no id: one row per user, keyed by user_id. */
export const cloudKey = (tbl: string): 'id' | 'user_id' => (tbl === 'profiles' ? 'user_id' : 'id')

/** Pulled cloud rows → local shape (every local table is keyed by id). */
export const fromCloud = (tbl: string, rows: Record<string, unknown>[]): Record<string, unknown>[] =>
  cloudKey(tbl) === 'id' ? rows : rows.map(r => ({ ...r, id: r.user_id }))
