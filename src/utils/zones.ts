// Pure zone math (RA-9). No React Native imports: `node src/utils/zones.check.ts` runs it.
// Runs store an HR histogram (seconds per bpm); zones are always computed from it + the user's current zones.
import type { ProfileRow, ZoneMethod } from './profile.ts'

export const ZONE_NAMES = ['Very Easy', 'Easy', 'Aerobic', 'Threshold', 'Max'] as const

/** bpm where Z2..Z5 start. Z1 = everything below Starts[0]. */
export type Starts = [number, number, number, number]
export type ZoneSeconds = [number, number, number, number, number]
export type HrHist = Record<string, number>  // bpm (floored) → seconds

export interface ZoneInputs {
  hrMax: number
  restingHr: number | null
  lthr: number | null
  manual: readonly number[] | null
}

/** 4 whole-bpm values in 40–230, strictly increasing. */
export const validStarts = (s: readonly number[] | null | undefined): s is Starts =>
  !!s && s.length === 4 && s.every((v, i) => Number.isFinite(v) && v >= 40 && v <= 230 && (i === 0 || v > s[i - 1]))

// Integer percents: 185 * 70 / 100 = 129.5 exactly (185 * 0.7 is 129.4999… in floating point).
const pct = (base: number, ps: number[], add = 0) => ps.map(p => Math.round(add + (base * p) / 100)) as Starts

const usable = (s: Starts | null) => (validStarts(s) ? s : null)  // e.g. LTHR "5" half-typed → [4,5,5,5]

/** Starts for one method, or null when its value is missing / unusable. % Max is never null (it's the fallback). */
export function methodStarts(m: ZoneMethod, x: ZoneInputs): Starts | null {
  switch (m) {
    case 'hrmax': return pct(x.hrMax, [60, 70, 80, 90])
    case 'hrr':   return x.restingHr != null && x.restingHr < x.hrMax
      ? usable(pct(x.hrMax - x.restingHr, [60, 70, 80, 90], x.restingHr)) : null
    case 'lthr':  return x.lthr != null ? usable(pct(x.lthr, [85, 90, 95, 100])) : null
    case 'manual': return validStarts(x.manual) ? ([...x.manual] as Starts) : null
  }
}

/** The user's zones. Not chosen yet, or the method's value went missing → % of max HR. */
export function zoneStarts(p: ProfileRow | null, hrMax: number): Starts {
  const x: ZoneInputs = { hrMax, restingHr: p?.resting_hr ?? null, lthr: p?.lthr ?? null, manual: p?.zone_bounds ?? null }
  return methodStarts(p?.zone_method ?? 'hrmax', x) ?? methodStarts('hrmax', x)!
}

/** Seconds in each zone. A bpm exactly on a start belongs to the upper zone. */
export function zoneTimes(hist: HrHist | null, s: Starts): ZoneSeconds | null {
  if (!hist) return null
  const z: ZoneSeconds = [0, 0, 0, 0, 0]
  for (const [bpm, sec] of Object.entries(hist)) {
    let i = 0
    while (i < 4 && Number(bpm) >= s[i]) i++
    z[i] += sec
  }
  return z
}

/** "below 111", "111–129", …, "167 and up" */
export function zoneRangeLabel(i: number, s: Starts): string {
  if (i === 0) return `below ${s[0]}`
  if (i === 4) return `${s[3]} and up`
  return `${s[i - 1]}–${s[i] - 1}`
}

export function computePrimaryZone(hist: HrHist | null, s: Starts): { zone: number; name: string; timeSec: number } | null {
  const z = zoneTimes(hist, s)
  if (!z || z.every(v => v === 0)) return null
  const i = z.reduce((best, v, k) => (v > z[best] ? k : best), 0)
  return { zone: i + 1, name: ZONE_NAMES[i], timeSec: z[i] }
}
