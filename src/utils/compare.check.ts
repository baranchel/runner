// Run: npx tsx src/utils/compare.check.ts
import type { Run } from '../types'
import { COMPARE_METRICS, betterValue, distanceLabel, paceTakeaway } from './compare'

function eq(actual: unknown, expected: unknown, msg: string) {
  if (actual !== expected) throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`)
}

const base: Run = {
  id: 'x', healthkitUuid: 'x', typeId: null, name: 'x', date: '2026-01-01', startedAt: null,
  distanceKm: 10, timeSec: 3000, avgHr: 150, maxHr: 170, minHr: 120,
  elevGain: 50, cadence: 170, calories: 600, source: 'apple_health', notes: null,
  segments: null, splits: [], weather: null, zones: null,
}
const run = (o: Partial<Run>): Run => ({ ...base, ...o })
const metric = (label: string) => {
  const m = COMPARE_METRICS.find(x => x.label === label)
  if (!m) throw new Error(`missing metric ${label}`)
  return m
}

eq(COMPARE_METRICS.length, 10, 'row count')
eq(betterValue(metric('Distance'), run({ distanceKm: 10 }), run({ distanceKm: 12 })), 'b', 'higher wins')
eq(betterValue(metric('Time'), run({ timeSec: 2900 }), run({ timeSec: 3000 })), 'a', 'lower wins')
eq(betterValue(metric('Avg Pace'), run({ timeSec: 3000 }), run({ timeSec: 2900 })), 'b', 'faster pace wins')
eq(betterValue(metric('Avg HR'), run({ avgHr: 150 }), run({ avgHr: 150 })), null, 'tie')
eq(betterValue(metric('Calories'), run({ calories: 300 }), run({ calories: 600 })), null, 'none rule')
eq(betterValue(metric('Avg HR'), run({ avgHr: null }), run({ avgHr: 140 })), null, 'missing value')
eq(metric('Avg Pace').get(run({ distanceKm: 0 })), null, 'zero distance pace')
eq(metric('Time').fmt(2892, 'km'), '48:12', 'time format')

eq(distanceLabel(run({ distanceKm: 8.02 }), run({ distanceKm: 7.98 })), 'SAME DISTANCE · A FAIR COMPARISON', 'same at 0.1 km')
eq(distanceLabel(run({ distanceKm: 8 }), run({ distanceKm: 8.5 })), 'SIMILAR DISTANCE', 'within 10%')
eq(distanceLabel(run({ distanceKm: 5 }), run({ distanceKm: 12 })), 'DIFFERENT DISTANCES', 'far apart')
eq(paceTakeaway(run({ date: '2026-11-14', timeSec: 3350 }), run({ timeSec: 3500 })), 'Nov 14 was 15 sec/km faster', 'A faster')
eq(paceTakeaway(run({ date: '2026-11-14', timeSec: 3500 }), run({ timeSec: 3350 })), 'Nov 14 was 15 sec/km slower', 'A slower')
eq(paceTakeaway(run({ timeSec: 3000 }), run({ timeSec: 3002 })), 'Same average pace', 'rounds to same')

console.log('compare.check: all passed')
