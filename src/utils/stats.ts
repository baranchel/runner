import type { Run, MonthStats } from '../types'

/**
 * Aggregate runs for a given month, optionally capped at a day-of-month.
 * Usage for mid-month comparison:
 *   const today = new Date()
 *   const aug = getMonthStats(runs, 2026, 8, today.getDate())   // Aug through today
 *   const jul = getMonthStats(runs, 2026, 7, today.getDate())   // Jul through same day
 */
export function getMonthStats(
  runs: Run[],
  year: number,
  month: number,
  cutoffDay?: number,
): MonthStats {
  const filtered = runs.filter(r => {
    const [y, m, d] = r.date.split('-').map(Number)
    if (y !== year || m !== month) return false
    if (cutoffDay != null && d > cutoffDay) return false
    return true
  })

  const totalDistanceKm = filtered.reduce((s, r) => s + r.distanceKm, 0)
  const totalTimeSec    = filtered.reduce((s, r) => s + r.timeSec, 0)
  const hrsWithData     = filtered.filter(r => r.avgHr != null)
  const avgHr = hrsWithData.length
    ? Math.round(hrsWithData.reduce((s, r) => s + r.avgHr!, 0) / hrsWithData.length)
    : null

  return {
    year,
    month,
    cutoffDay: cutoffDay ?? null,
    runCount: filtered.length,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalTimeSec,
    avgPaceSecPerKm: totalDistanceKm > 0 ? Math.round(totalTimeSec / totalDistanceKm) : 0,
    avgHr,
  }
}
