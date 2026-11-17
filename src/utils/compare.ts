import type { Run } from '../types'
import { fmtDate, fmtDistance, fmtMMSS, fmtPace } from './format'
import { computePrimaryZone } from './zones'

export type Better = 'higher' | 'lower' | 'none'

export interface CompareMetric {
  label: string
  get: (run: Run) => number | null
  fmt: (value: number, unit: 'km' | 'mi') => string
  better: Better
}

// "Better" is judged per row only — there is no overall verdict on which run is better.
// ponytail: placeholder rule; redefine by editing `better` per row (or replacing betterValue)
export const COMPARE_METRICS: CompareMetric[] = [
  { label: 'Distance',     get: r => r.distanceKm,                                  fmt: (v, u) => fmtDistance(v, u),    better: 'higher' },
  { label: 'Time',         get: r => r.timeSec,                                     fmt: v => fmtMMSS(v),                better: 'lower' },
  { label: 'Avg Pace',     get: r => (r.distanceKm > 0 ? r.timeSec / r.distanceKm : null), fmt: (v, u) => fmtPace(v, u), better: 'lower' },
  { label: 'Avg HR',       get: r => r.avgHr,                                       fmt: v => `${Math.round(v)} bpm`,    better: 'lower' },
  { label: 'Max HR',       get: r => r.maxHr,                                       fmt: v => `${Math.round(v)} bpm`,    better: 'lower' },
  { label: 'Elevation',    get: r => r.elevGain,                                    fmt: v => `${Math.round(v)} m`,      better: 'higher' },
  { label: 'Cadence',      get: r => r.cadence,                                     fmt: v => `${Math.round(v)} spm`,    better: 'higher' },
  { label: 'Calories',     get: r => Math.round(r.distanceKm * 62),                 fmt: v => `${v} kcal`,               better: 'none' },
  { label: 'Primary Zone', get: r => computePrimaryZone(r)?.zone ?? null,           fmt: v => `Zone ${v}`,               better: 'none' },
  { label: 'Weather',      get: r => r.weather?.tempC ?? null,                      fmt: v => `${v}°C`,                  better: 'none' },
]

// Which side has the better value in this one row. null = no highlight
// (rule is 'none', a value is missing, or the values are equal).
export function betterValue(m: CompareMetric, a: Run, b: Run): 'a' | 'b' | null {
  if (m.better === 'none') return null
  const va = m.get(a)
  const vb = m.get(b)
  if (va == null || vb == null || va === vb) return null
  return (va > vb) === (m.better === 'higher') ? 'a' : 'b'
}

export const paceOf = (r: Run) => r.timeSec / r.distanceKm

// "same" only when the displayed distances match; within 10% is just "similar"
export function distanceLabel(a: Run, b: Run): string {
  if (Math.round(a.distanceKm * 10) === Math.round(b.distanceKm * 10)) return 'SAME DISTANCE · A FAIR COMPARISON'
  if (Math.abs(a.distanceKm - b.distanceKm) / Math.max(a.distanceKm, b.distanceKm) <= 0.1) return 'SIMILAR DISTANCE'
  return 'DIFFERENT DISTANCES'
}

// Fact only, no verdict (compare spec): how A's average pace differs from B's
export function paceTakeaway(a: Run, b: Run): string {
  const diff = Math.round(paceOf(b) - paceOf(a))
  if (diff === 0) return 'Same average pace'
  return `${fmtDate(a.date)} was ${Math.abs(diff)} sec/km ${diff > 0 ? 'faster' : 'slower'}`
}
