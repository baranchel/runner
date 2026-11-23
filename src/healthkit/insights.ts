// Reads Insights data from Apple Health (RA-29). Read-only. Every failure → empty data:
// iOS never says what was refused, so a "no" and "no data" look the same.
import type { Metric } from '../insights/metrics'
import {
  activityName, rebucket, sleepNights, workoutWeeks,
  type Bucket, type HrEvent, type MetricData, type Point,
} from '../insights/summary'
import { isoDate } from '../utils/profile'
import { seconds } from './mapWorkout'
import { hk } from './native'

const INTERVAL = { day: { day: 1 }, week: { day: 7 }, month: { month: 1 } } as const
const EMPTY: MetricData = { points: [] }
const EVENT_TYPE: Record<string, HrEvent['type']> = {
  HKCategoryTypeIdentifierHighHeartRateEvent: 'high',
  HKCategoryTypeIdentifierLowHeartRateEvent: 'low',
  HKCategoryTypeIdentifierIrregularHeartRhythmEvent: 'irregular',
}
const STOOD = 0  // HKCategoryValueAppleStandHour.stood

/** One metric from `from` (bucket-aligned: periodStart) until now, in `bucket` steps. */
export async function readMetric(metric: Metric, from: Date, bucket: Bucket): Promise<MetricData> {
  const m = await hk()
  if (!m) return EMPTY
  const filter = { date: { startDate: from, endDate: new Date() } }
  const range = { filter, limit: 0, ascending: true }
  const scale = metric.scale ?? 1
  try {
    switch (metric.kind) {
      case 'line':
      case 'bars': {
        if (metric.hk[0].startsWith('HKCategory')) {  // stand hours: one sample per hour, value stood/idle
          const ss = await m.queryCategorySamples(metric.hk[0] as never, range)
          const daily = rebucket(ss.filter(s => (s.value as number) === STOOD).map(s => ({ date: isoDate(s.startDate), value: 1 })), 'day', 'sum')
          return { points: rebucket(daily, bucket, 'sum') }
        }
        const rs = await m.queryStatisticsCollectionForQuantity(
          metric.hk[0] as never,
          [metric.kind === 'bars' ? 'cumulativeSum' : 'discreteAverage'],
          from,
          INTERVAL[bucket],
          { filter, unit: metric.hkUnit } as never,
        )
        const points: Point[] = []
        for (const r of rs) {
          const q = metric.kind === 'bars' ? r.sumQuantity : r.averageQuantity
          if (q && r.startDate) points.push({ date: isoDate(r.startDate), value: q.quantity * scale })
        }
        return { points }
      }
      case 'sleep': {
        const ss = await m.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', range)
        const nights = sleepNights(ss.map(s => ({
          start: s.startDate, end: s.endDate, value: s.value as number,
          source: s.sourceRevision.source.bundleIdentifier,
          isWatch: s.sourceRevision.productType?.startsWith('Watch') ?? false,
        })))
        return { nights, points: rebucket(nights.map(n => ({ date: n.date, value: n.asleep / 3600 })), bucket, 'avg') }
      }
      case 'events': {
        const lists = await Promise.all(metric.hk.map(id =>
          m.queryCategorySamples(id as never, range)
            .then(ss => ss.map(s => ({ start: s.startDate, type: EVENT_TYPE[id] })))
            .catch(() => [] as HrEvent[])))
        return { points: [], events: lists.flat().sort((a, b) => a.start.getTime() - b.start.getTime()) }
      }
      case 'workouts': {
        const ws = await m.queryWorkoutSamples(range as never)
        const weeks = workoutWeeks(ws
          .filter(w => w.workoutActivityType !== m.WorkoutActivityType.running)
          .map(w => ({
            start: w.startDate,
            seconds: seconds(w.duration as never),  // real duration, paused time excluded
            type: activityName(m.WorkoutActivityType[w.workoutActivityType] ?? 'other'),
          })))
        const hours = weeks.map(w => ({ date: w.date, value: w.seconds / 3600 }))
        return { weeks, points: rebucket(hours, bucket === 'day' ? 'week' : bucket, 'sum') }  // never finer than a week
      }
    }
  } catch (e) {
    console.warn('[insights] read failed', metric.key, e)
    return EMPTY
  }
}
