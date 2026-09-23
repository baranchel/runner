import type { Run } from '../types'

export const ZONE_NAMES = ['Very Easy', 'Easy', 'Aerobic', 'Threshold', 'Max'] as const

export function computePrimaryZone(
  run: Run,
): { zone: number; name: string; timeSec: number } | null {
  if (!run.zones) return null
  const maxIdx = run.zones.reduce((best, v, i) => (v > run.zones![best] ? i : best), 0)
  return { zone: maxIdx + 1, name: ZONE_NAMES[maxIdx], timeSec: run.zones[maxIdx] }
}

export const MOCK_HR_MAX = 190  // ponytail: placeholder until per-user HRmax setting exists

// lower-bound bpm for each zone (Z1..Z5) at 50/60/70/80/90% of HRmax
export function zoneBounds(hrMax = MOCK_HR_MAX): [number, number, number, number, number] {
  return [0.5, 0.6, 0.7, 0.8, 0.9].map(p => Math.round(hrMax * p)) as
    [number, number, number, number, number]
}

// human range per zone: Z1 "<b2", middle "b–(next-1)", Z5 "b5+"
export function zoneRangeLabel(i: number, hrMax = MOCK_HR_MAX): string {
  const b = zoneBounds(hrMax)
  if (i === 0) return `<${b[1]}`
  if (i === 4) return `${b[4]}+`
  return `${b[i]}–${b[i + 1] - 1}`
}
