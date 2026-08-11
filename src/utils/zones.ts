import type { Run } from '../types'

export const ZONE_NAMES = ['Very Easy', 'Easy', 'Aerobic', 'Threshold', 'Max'] as const

export function computePrimaryZone(
  run: Run,
): { zone: number; name: string; timeSec: number } | null {
  if (!run.zones) return null
  const maxIdx = run.zones.reduce((best, v, i) => (v > run.zones![best] ? i : best), 0)
  return { zone: maxIdx + 1, name: ZONE_NAMES[maxIdx], timeSec: run.zones[maxIdx] }
}
