// Facts layer (RA-45): numbers from runs, no wording. Pure — `node src/facts/facts.check.ts` imports it.
// The insight rules use it now; RA-15 (auto run type) can reuse runFacts() as classifier features later.
import type { Run } from '../types/index.ts'
import { zoneTimes, type Starts, type ZoneSeconds } from '../utils/zones.ts'
import { addDays, bucketKey, type Point } from '../insights/summary.ts'

export interface RunFacts {
  id: string
  date: string               // 'YYYY-MM-DD'
  typeId: string | null
  km: number
  sec: number
  pace: number | null        // s/km
  avgHr: number | null
  maxHr: number | null
  zones: ZoneSeconds | null  // seconds per zone, from the HR histogram
  load: number | null        // Σ minutes in zone × zone number (Z1 = 1 … Z5 = 5)
}

export function runFacts(r: Run, s: Starts): RunFacts {
  const zones = zoneTimes(r.hrHist, s)
  return {
    id: r.id, date: r.date, typeId: r.typeId, km: r.distanceKm, sec: r.timeSec,
    pace: r.distanceKm > 0 ? r.timeSec / r.distanceKm : null,
    avgHr: r.avgHr, maxHr: r.maxHr, zones,
    load: zones ? zones.reduce((a, sec, i) => a + (sec / 60) * (i + 1), 0) : null,
  }
}

/** Average HR inside the user's Z2 (starts[0] ≤ hr < starts[1]). */
export const isZ2 = (f: RunFacts, s: Starts): boolean => f.avgHr != null && f.avgHr >= s[0] && f.avgHr < s[1]

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)
export const mean = (xs: readonly number[]): number | null => (xs.length ? sum(xs) / xs.length : null)
export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Items in the `days` days ending `offset` days before today (offset 0 = up to and including today). */
export function inDays<T extends { date: string }>(xs: readonly T[], today: string, offset: number, days: number): T[] {
  const to = addDays(today, -offset), from = addDays(today, -(offset + days - 1))
  return xs.filter(x => x.date >= from && x.date <= to)
}
export const oldest = (xs: readonly { date: string }[]): string => xs.reduce((m, x) => (x.date < m ? x.date : m), '9999-12-31')

/** Start dates of the last `count` buckets (week = Monday, month = 1st), ascending, ending with today's bucket. */
export function bucketsBack(today: string, b: 'week' | 'month', count: number): string[] {
  const out: string[] = []
  let k = bucketKey(today, b)
  for (let i = 0; i < count; i++) {
    out.unshift(k)
    k = b === 'week' ? addDays(k, -7) : bucketKey(addDays(k, -1), 'month')
  }
  return out
}

/** One point per bucket of bucketsBack(); fn gets that bucket's runs (maybe none); a null result drops the bucket. */
export function series(fs: readonly RunFacts[], today: string, b: 'week' | 'month', count: number,
  fn: (fs: RunFacts[]) => number | null): Point[] {
  const keys = bucketsBack(today, b, count)
  const by = new Map(keys.map(k => [k, [] as RunFacts[]]))
  for (const f of fs) if (f.date >= keys[0]) by.get(bucketKey(f.date, b))?.push(f)
  return keys.flatMap(k => { const v = fn(by.get(k)!); return v == null ? [] : [{ date: k, value: v }] })
}

/** % of HR-recorded running time in Z2. null when no run has zone time. */
export function z2Pct(fs: readonly RunFacts[]): number | null {
  let z2 = 0, all = 0
  for (const f of fs) if (f.zones) { z2 += f.zones[1]; all += sum(f.zones) }
  return all > 0 ? (z2 / all) * 100 : null
}
