// RA-45: stores → facts → findings → ranked feed → today's wording. Computed in memory; nothing is stored.
// The tab and the running insight screen both call it, so a card and its detail screen show the same text.
import { useMemo } from 'react'
import { runFacts } from '../facts/facts'
import { useInsightsStore } from '../store/useInsightsStore'
import { useZoneStarts } from '../store/useProfileStore'
import { useRunStore } from '../store/useRunStore'
import { isoDate } from '../utils/profile'
import { wordAll } from './phrases'
import { buildFeed, feedOrder } from './rank'
import { findings, type Finding, type InsightKey } from './rules'

/** Health insights open the RA-29 detail screen of their metric. */
const HEALTH_METRIC: Partial<Record<InsightKey, string>> = {
  restingHr: 'restingHr', hrv: 'hrv', sleep: 'sleep', steps: 'steps', vo2max: 'vo2max',
  stepsRunDays: 'steps', sleepBeforeSlow: 'sleep', restingHrSleep: 'restingHr',
}
export const insightHref = (f: Finding): string =>
  f.side === 'running' ? `/insight-run/${f.key}` : `/insight/${HEALTH_METRIC[f.key] ?? 'restingHr'}`

export function useFeed() {
  const runs = useRunStore(s => s.runs)
  const starts = useZoneStarts()
  const health = useInsightsStore(s => s.data)
  const steps365 = useInsightsStore(s => s.steps365)
  const today = isoDate(new Date())
  const startsKey = starts.join(',')   // zoneStarts() returns a new array each render
  return useMemo(() => {
    const feed = buildFeed(findings({ today, runs: runs.map(r => runFacts(r, starts)), starts, health, steps365 }))
    return { feed, words: wordAll(feedOrder(feed), today) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, startsKey, health, steps365, today])
}
