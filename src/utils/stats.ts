import type { Run, MonthStats, PeriodStats } from '../types'

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

function aggregatePeriod(runs: Run[]): PeriodStats {
  const totalDistanceKm = runs.reduce((s, r) => s + r.distanceKm, 0)
  const totalTimeSec    = runs.reduce((s, r) => s + r.timeSec, 0)
  const runCount        = runs.length
  return {
    totalDistanceKm:  Math.round(totalDistanceKm * 10) / 10,
    totalTimeSec,
    runCount,
    avgDistanceKm:    runCount > 0 ? Math.round(totalDistanceKm / runCount * 10) / 10 : 0,
    avgTimeSec:       runCount > 0 ? Math.round(totalTimeSec / runCount)               : 0,
    avgPaceSecPerKm:  totalDistanceKm > 0 ? Math.round(totalTimeSec / totalDistanceKm) : 0,
  }
}

const DAY = 86400_000
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const runDay = (r: Run) => { const [y, m, d] = r.date.split('-').map(Number); return new Date(y, m - 1, d).getTime() }

/** Runs from the last 30 days, today included (same window as the Dashboard's Last 30 days card). */
export function inLast30Days(runs: Run[], today: Date): Run[] {
  const t = dayStart(today)
  return runs.filter(r => { const d = runDay(r); return d >= t - 29 * DAY && d <= t })
}

export function getPeriodStats(
  runs: Run[],
  today: Date,
): { current: PeriodStats; previous: PeriodStats } {
  const t = dayStart(today)
  const previous = runs.filter(r => { const d = runDay(r); return d >= t - 59 * DAY && d < t - 29 * DAY })
  return { current: aggregatePeriod(inLast30Days(runs, today)), previous: aggregatePeriod(previous) }
}
