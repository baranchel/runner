// Run: node src/facts/facts.check.ts
import type { Run } from '../types/index.ts'
import type { Starts } from '../utils/zones.ts'
import { bucketsBack, inDays, isZ2, mean, median, oldest, runFacts, series, z2Pct, type RunFacts } from './facts.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}
const S: Starts = [130, 145, 160, 175]
const run = (o: Partial<Run> = {}): Run => ({
  id: 'r1', healthkitUuid: 'r1', typeId: null, name: 'Run', date: '2026-11-27', startedAt: null,
  distanceKm: 8, timeSec: 2720, avgHr: 140, maxHr: 170, minHr: 100, elevGain: null, cadence: null, calories: null,
  source: 'apple_health', notes: null, segments: null, splits: [], weather: null,
  hrHist: { '120': 600, '140': 600 }, hrCurve: null, needsType: false, shoeId: null, ...o,
})

// ─── runFacts ────────────────────────────────────────────────────────────────
const f = runFacts(run(), S)
eq(f.pace, 340, 'pace = s/km')
eq(f.zones, [600, 600, 0, 0, 0], 'zones from the histogram')
eq(f.load, 30, 'load = 10 min × Z1 + 10 min × Z2')
eq(runFacts(run({ distanceKm: 0 }), S).pace, null, 'no distance → no pace')
eq(runFacts(run({ hrHist: null }), S).load, null, 'no HR → no load')

// ─── Z2 ──────────────────────────────────────────────────────────────────────
eq(isZ2({ ...f, avgHr: 140 }, S), true, '140 is in Z2 (130–144)')
eq(isZ2({ ...f, avgHr: 145 }, S), false, '145 starts Z3')
eq(isZ2({ ...f, avgHr: 129 }, S), false, '129 is Z1')
eq(isZ2({ ...f, avgHr: null }, S), false, 'no HR → not Z2')
eq(z2Pct([f, f]), 50, 'half the time in Z2')
eq(z2Pct([{ ...f, zones: null }]), null, 'no zone time → null')

// ─── numbers ─────────────────────────────────────────────────────────────────
eq(median([3, 1, 2]), 2, 'median odd'); eq(median([4, 1, 2, 3]), 2.5, 'median even'); eq(median([]), null, 'median empty')
eq(mean([2, 4]), 3, 'mean'); eq(mean([]), null, 'mean empty')

// ─── windows & buckets (2026-11-28 is a Saturday) ────────────────────────────
const at = (date: string): RunFacts => ({ ...f, date })
eq(inDays([at('2026-11-28'), at('2026-10-30'), at('2026-10-29')], '2026-11-28', 0, 30).length, 2, '30 days incl. today')
eq(inDays([at('2026-10-29'), at('2026-09-30'), at('2026-09-29')], '2026-11-28', 30, 30).length, 2, 'the 30 days before')
eq(oldest([at('2026-11-02'), at('2026-10-01')]), '2026-10-01', 'oldest date')
eq(bucketsBack('2026-11-28', 'week', 3), ['2026-11-09', '2026-11-16', '2026-11-23'], 'weeks back, Mondays, ascending')
eq(bucketsBack('2026-11-28', 'month', 3), ['2026-09-01', '2026-10-01', '2026-11-01'], 'months back')
eq(series([at('2026-11-24'), at('2026-11-25'), at('2026-11-10')], '2026-11-28', 'week', 3, fs => fs.length),
  [{ date: '2026-11-09', value: 1 }, { date: '2026-11-16', value: 0 }, { date: '2026-11-23', value: 2 }], 'series keeps empty weeks')
eq(series([at('2026-11-24')], '2026-11-28', 'week', 2, fs => (fs.length ? fs.length : null)),
  [{ date: '2026-11-23', value: 1 }], 'series drops buckets where fn returns null')

console.log('facts.check: all passed')
