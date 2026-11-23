// Run: node src/insights/summary.check.ts
import { METRICS } from './metrics.ts'
import {
  activityName, addDays, baseline, bucketFor, bucketKey, cardText, compare, dailyAvg, fmtNum, hasData,
  isHidden, moveTo, orderedMetrics, periodStart, rebucket, sleepNights, stats, toggleHidden, workoutWeeks,
  type Point,
} from './summary.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}
const metric = (key: string) => METRICS.find(m => m.key === key)!
const TODAY = '2026-11-23'                        // a Monday
const NOW = new Date(2026, 10, 23, 9, 0)
/** One point per day, `days` days ending `endOffset` days before TODAY, all = value. */
const run = (days: number, endOffset: number, value: number): Point[] =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(TODAY, -(endOffset + days - 1 - i)), value }))

// ─── dates & buckets ─────────────────────────────────────────────────────────
eq(addDays('2026-11-23', -30), '2026-10-24', 'addDays back over a month end')
eq(addDays('2026-03-28', 2), '2026-03-30', 'addDays across DST (noon anchor)')
eq(bucketFor('month'), 'day', 'month → day'); eq(bucketFor('3m'), 'day', '3m → day')
eq(bucketFor('year'), 'week', 'year → week'); eq(bucketFor('all'), 'month', 'all → month')
eq(bucketKey('2026-11-26', 'week'), '2026-11-23', 'week bucket = Monday')
eq(bucketKey('2026-11-23', 'week'), '2026-11-23', 'Monday is its own week')
eq(bucketKey('2026-11-26', 'month'), '2026-11-01', 'month bucket = 1st')
eq(periodStart('month', NOW).getDate(), 25, 'month = 30 days incl. today (Oct 25)')
eq(periodStart('year', NOW).getDay(), 1, 'year starts on a Monday (week anchor)')
eq(periodStart('all', NOW).getDate(), 1, 'all starts on the 1st (month anchor)')
eq(rebucket([{ date: '2026-11-23', value: 2 }, { date: '2026-11-25', value: 4 }, { date: '2026-11-17', value: 1 }], 'week', 'sum'),
  [{ date: '2026-11-16', value: 1 }, { date: '2026-11-23', value: 6 }], 'rebucket sum, sorted')
eq(rebucket([{ date: '2026-11-23', value: 2 }, { date: '2026-11-25', value: 4 }], 'week', 'avg'),
  [{ date: '2026-11-23', value: 3 }], 'rebucket avg')

// ─── numbers ─────────────────────────────────────────────────────────────────
eq(compare([...run(30, 30, 56), ...run(30, 0, 54)], TODAY), -2, 'last 30 vs prior 30')
eq(compare(run(30, 0, 54), TODAY), null, 'no prior window → null')
eq(dailyAvg([...run(29, 1, 9000), { date: TODAY, value: 12000 }], TODAY), 9100, 'daily avg over 30 days')
eq(baseline([...run(89, 1, 36.0), { date: TODAY, value: 36.9 }], TODAY)!.toFixed(2), '0.89', 'latest minus 90-day mean')
eq(stats([{ date: 'a', value: 3 }, { date: 'b', value: 1 }, { date: 'c', value: 5 }]), { min: 1, avg: 3, max: 5 }, 'stats')
eq(stats([]), null, 'stats empty')
eq(fmtNum(11840, 0), '11,840', 'thousands'); eq(fmtNum(-2.04, 1), '−2.0', 'minus sign')
eq(fmtNum(-0.01, 1), '0.0', 'no −0.0'); eq(fmtNum(47.25, 1), '47.3', 'rounds')

// ─── sleep ───────────────────────────────────────────────────────────────────
const at = (d: number, h: number, min = 0) => new Date(2026, 10, d, h, min)
const s = (start: Date, end: Date, value: number, source = 'watch', isWatch = true) => ({ start, end, value, source, isWatch })
const nights = sleepNights([
  s(at(22, 23), at(23, 1), 3),            // core 2 h, ends after midnight
  s(at(22, 22, 30), at(22, 23), 3),       // core 0.5 h, ends 23:00 → still the night of the 23rd
  s(at(23, 1), at(23, 2), 4),             // deep 1 h
  s(at(23, 2), at(23, 2, 10), 2),         // awake 10 min (not sleep)
  s(at(23, 2, 10), at(23, 3), 5),         // REM 50 min
  s(at(22, 21), at(23, 7), 0),            // inBed → ignored
  s(at(22, 22), at(23, 8), 1, 'phoneApp', false), // other app, 10 h unspecified → loses to the Watch
])
eq(nights.length, 1, 'one night')
eq(nights[0].date, '2026-11-23', 'night = date it ends (23:00 sample shifts forward)')
eq([nights[0].asleep, nights[0].core, nights[0].deep, nights[0].rem, nights[0].awake], [15600, 9000, 3600, 3000, 600], 'stages from the Watch source only')
eq(sleepNights([s(at(22, 22), at(23, 6), 1, 'a', false), s(at(22, 23), at(23, 6), 1, 'b', false)])[0].asleep, 28800,
  'no Watch → source with most sleep')
eq(sleepNights([s(at(23, 14), at(23, 15), 1)])[0].date, '2026-11-23', 'afternoon nap stays on its day')

// ─── workouts ────────────────────────────────────────────────────────────────
eq(activityName('traditionalStrengthTraining'), 'Traditional strength training', 'activity name')
eq(workoutWeeks([
  { start: at(24, 18), seconds: 3600, type: 'Cycling' },
  { start: at(26, 18), seconds: 1800, type: 'Cycling' },
  { start: at(17, 18), seconds: 600, type: 'Yoga' },
]), [
  { date: '2026-11-16', seconds: 600, byType: { Yoga: 600 } },
  { date: '2026-11-23', seconds: 5400, byType: { Cycling: 5400 } },
], 'weekly totals by type')

// ─── card text ───────────────────────────────────────────────────────────────
eq(cardText(metric('restingHr'), { points: [...run(30, 30, 56), ...run(30, 0, 54)] }, NOW),
  { value: '54', unit: 'bpm', meta: '−2 vs prior 30 days' }, 'compare meta')
eq(cardText(metric('restingHr'), { points: [{ date: '2026-08-02', value: 55 }] }, NOW),
  { value: '55', unit: 'bpm', meta: 'Aug 2' }, 'compare without windows → date of the reading')
eq(cardText(metric('weight'), { points: [{ date: '2026-11-20', value: 71.44 }] }, NOW),
  { value: '71.4', unit: 'kg', meta: 'Nov 20' }, 'date meta')
eq(cardText(metric('steps'), { points: [...run(29, 1, 9000), { date: TODAY, value: 12000 }] }, NOW),
  { value: '12,000', unit: '', meta: 'today · avg 9,100' }, 'today meta')
eq(cardText(metric('steps'), { points: run(29, 1, 9000) }, NOW).value, '0', 'no steps today → 0')
eq(cardText(metric('power'), { points: [{ date: '2026-11-21', value: 248.4 }] }, NOW),
  { value: '248', unit: 'W', meta: 'avg, last run' }, 'last run meta')
eq(cardText(metric('wristTemp'), { points: [...run(89, 1, 36.0), { date: TODAY, value: 36.2 }] }, NOW),
  { value: '+0.2', unit: '°C', meta: 'vs your average' }, 'baseline meta')
eq(cardText(metric('sleep'), { points: run(30, 0, 7), nights: [{ date: TODAY, asleep: 25920, core: 0, deep: 0, rem: 0, awake: 0 }] }, NOW),
  { value: '7:12', unit: 'h', meta: 'avg 7:00 over 30 days' }, 'sleep card')
eq(cardText(metric('sleep'), { points: [], nights: [{ date: '2026-11-10', asleep: 25920, core: 0, deep: 0, rem: 0, awake: 0 }] }, NOW).meta,
  'Nov 10', 'old night shows its date')
eq(cardText(metric('hrEvents'), { points: [], events: [{ start: new Date(2026, 10, 2, 14, 20), type: 'high' }] }, NOW),
  { value: '1', unit: 'in 90 days', meta: 'High heart rate · Nov 2, 14:20' }, 'events card')
eq(cardText(metric('otherWorkouts'), { points: [], weeks: [{ date: TODAY, seconds: 7800, byType: { Strength: 4800, Cycling: 3000 } }] }, NOW),
  { value: '2:10', unit: 'h this week', meta: 'Strength 1:20 · Cycling 0:50' }, 'workouts card')
eq(hasData({ points: [] }), false, 'empty'); eq(hasData({ points: [], events: [{ start: NOW, type: 'low' }] }), true, 'events count')
eq(hasData(undefined), false, 'not loaded')

// ─── layout ──────────────────────────────────────────────────────────────────
const keys = (l: Parameters<typeof orderedMetrics>[0]) => orderedMetrics(l).map(m => m.key)
eq(keys(null), METRICS.map(m => m.key), 'null layout = catalogue order')
eq(keys({ hidden: [], order: ['hrv', 'restingHr'] }).slice(0, 3), ['hrv', 'restingHr', 'cardioRecovery'], 'ordered first, rest in catalogue order')
eq(keys({ hidden: [], order: ['gone', 'weight'] }).includes('gone'), false, 'unknown keys ignored')
eq(keys({ hidden: [], order: ['weight'] }).indexOf('weight') > keys(null).indexOf('vo2max'), true, 'order never moves a metric out of its group')
const moved = moveTo(null, 'walkingHr', 0)
eq(keys(moved).slice(0, 5), ['walkingHr', 'restingHr', 'hrv', 'cardioRecovery', 'hrEvents'], 'move within group')
eq(keys(moveTo(moved, 'walkingHr', 99)).slice(0, 5), ['restingHr', 'hrv', 'cardioRecovery', 'hrEvents', 'walkingHr'], 'move clamps to the end')
const hid = toggleHidden(null, 'hrv')
eq([isHidden(hid, 'hrv'), isHidden(toggleHidden(hid, 'hrv'), 'hrv'), isHidden(null, 'hrv')], [true, false, false], 'toggle hidden')
eq(isHidden({ order: [] } as never, 'hrv'), false, 'layout without hidden')
eq(keys({ hidden: [] } as never), METRICS.map(m => m.key), 'layout without order = catalogue order')
eq(toggleHidden(moved, 'hrv').order, moved.order, 'toggle keeps order')

console.log('summary.check: all passed')
