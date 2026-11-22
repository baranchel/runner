export interface RunType {
  id: string
  name: string
  hue: number
}

export interface Segment {
  type: 'warmup' | 'rep' | 'rest' | 'main' | 'cooldown'
  label: string
  distanceKm: number
  timeSec: number
  avgHr: number | null
}

export interface Split {
  km: number       // 1, 2, … or partial endpoint e.g. 5.5
  timeSec: number  // time for that km (or partial km)
  avgHr: number | null
}

/** Fields the Edit Run modal can change. Stored in runs.edits, applied on top of HealthKit values. */
export type EditFields = 'name' | 'distanceKm' | 'timeSec' | 'avgHr' | 'minHr' | 'maxHr' | 'elevGain'
export type RunEdits = Partial<Pick<Run, EditFields>>

export interface Run {
  id: string
  healthkitUuid: string
  typeId: string | null
  name: string            // default "<TypeName>: <Distance>km", user-editable
  date: string            // 'YYYY-MM-DD'
  startedAt: string | null  // ISO start time; null for runs saved before RA-3
  distanceKm: number
  timeSec: number
  avgHr: number | null
  maxHr: number | null
  minHr: number | null          // lowest HR recorded
  elevGain: number | null
  cadence: number | null
  calories: number | null       // active kcal from HealthKit (RA-3); null for older rows
  source: 'apple_health' | 'strava' | 'garmin'
  notes: string | null
  segments: Segment[] | null
  splits: Split[]
  weather: { tempC: number; humidity: number } | null
  hrHist: Record<string, number> | null  // seconds at each bpm (rounded); zones are computed from it (RA-9)
  hrCurve: [number, number][] | null    // HR chart: [min, max] bpm per 1/80 of active time; null = no HR recorded
  edits?: RunEdits        // manual edits; the other fields already include them
}

export interface MonthStats {
  year: number
  month: number           // 1–12
  cutoffDay: number | null // null = full month; set to today's day for mid-month comparison
  runCount: number
  totalDistanceKm: number
  totalTimeSec: number
  avgPaceSecPerKm: number
  avgHr: number | null
}

export interface PeriodStats {
  totalDistanceKm: number
  totalTimeSec: number
  runCount: number
  avgDistanceKm: number
  avgTimeSec: number
  avgPaceSecPerKm: number
}

export interface User {
  name: string
  email: string
  unit: 'km' | 'mi'
}
