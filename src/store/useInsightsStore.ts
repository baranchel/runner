// RA-29: last 91 days of every Insights metric, read live from Apple Health and kept in memory only.
// 91 days = last 30 + prior 30 (compare) and the 90-day baseline (wrist temperature).
import { create } from 'zustand'
import { readMetric } from '../healthkit/insights'
import { METRICS } from '../insights/metrics'
import { periodStart, type MetricData } from '../insights/summary'

const STALE_MS = 10 * 60_000  // re-read on focus / foreground at most every 10 min; pull-to-refresh forces it

type State = {
  data: Record<string, MetricData>
  loadedAt: number   // 0 = never loaded
  loading: boolean
  load: (force?: boolean) => Promise<void>
}

export const useInsightsStore = create<State>((set, get) => ({
  data: {},
  loadedAt: 0,
  loading: false,
  load: async (force = false) => {
    const { loading, loadedAt } = get()
    if (loading || (!force && Date.now() - loadedAt < STALE_MS)) return
    set({ loading: true })
    const from = periodStart('3m', new Date())
    const pairs = await Promise.all(METRICS.map(async m => [m.key, await readMetric(m, from, 'day')] as const))
    set({ data: Object.fromEntries(pairs), loadedAt: Date.now(), loading: false })
  },
}))
