// RA-29: last 91 days of every Health metric, read live from Apple Health and kept in memory only.
// 91 days = last 30 + prior 30 (compare) and the 90-day baseline (wrist temperature).
// RA-45: plus 365 days of daily steps (Insights "most active month since …"), also memory only.
import { create } from 'zustand'
import { readMetric } from '../healthkit/insights'
import { METRICS } from '../insights/metrics'
import { periodStart, type MetricData, type Point } from '../insights/summary'

const STALE_MS = 10 * 60_000  // re-read on focus / foreground at most every 10 min; pull-to-refresh forces it
const STEPS = METRICS.find(m => m.key === 'steps')!

type State = {
  data: Record<string, MetricData>
  steps365: Point[] | null
  loadedAt: number   // 0 = never loaded
  loading: boolean
  load: (force?: boolean) => Promise<void>
}

export const useInsightsStore = create<State>((set, get) => ({
  data: {},
  steps365: null,
  loadedAt: 0,
  loading: false,
  load: async (force = false) => {
    const { loading, loadedAt } = get()
    if (loading || (!force && Date.now() - loadedAt < STALE_MS)) return
    set({ loading: true })
    const now = new Date()
    const [pairs, year] = await Promise.all([
      Promise.all(METRICS.map(async m => [m.key, await readMetric(m, periodStart('3m', now), 'day')] as const)),
      readMetric(STEPS, periodStart('year', now), 'day'),
    ])
    set({ data: Object.fromEntries(pairs), steps365: year.points, loadedAt: Date.now(), loading: false })
  },
}))
