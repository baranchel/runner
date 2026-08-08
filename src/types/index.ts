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

export interface Run {
  id: string
  healthkitUuid: string
  typeId: string | null
  name: string            // default "<TypeName>: <Distance>km", user-editable
  date: string            // 'YYYY-MM-DD'
  distanceKm: number
  timeSec: number
  avgHr: number | null
  maxHr: number | null
  elevGain: number | null
  cadence: number | null
  source: 'apple_health' | 'strava' | 'garmin'
  notes: string | null
  segments: Segment[] | null
  splits: Split[]
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

export interface User {
  name: string
  email: string
  unit: 'km' | 'mi'
}
