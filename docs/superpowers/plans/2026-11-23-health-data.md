# Health Data on Insights (RA-29) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Insights tab shows 25 Apple Health metrics as grouped trend cards, each opening a detail chart, with an Edit screen to hide and reorder them (choice saved in the profile).

**Architecture:** A pure catalogue (`src/insights/metrics.ts`) lists every metric. Pure maths + text (`src/insights/summary.ts`, node self-check) turns daily points into card text, buckets and layouts. A read-only HealthKit reader (`src/healthkit/insights.ts`) fills a Zustand store (`useInsightsStore`); nothing from Health is stored. The hide/order choice is one jsonb/TEXT column on `profiles`, saved through the existing `writeChange` + `syncNow()` path.

**Tech Stack:** Expo Router, Zustand, expo-sqlite, Supabase, `@kingstinct/react-native-healthkit` 16.2.0, react-native-svg, react-native-gesture-handler 3.3 (legacy `Gesture` API via `GestureDetector`), react-native-reanimated 4.7.

**Spec:** `docs/superpowers/specs/2026-11-23-health-data-design.md`. Mockup: `.superpowers/brainstorm/insights/insights-v2.html`.

**Project rules for every task (from `CLAUDE.md`):**
- **Never run git.** Each task ends with a *Checkpoint*: list the changed files; Bar commits.
- Self-checks run with plain node (`node file.check.ts`, Node 24 strips types). Pure modules import siblings **with the `.ts` extension** (`'./metrics.ts'`) and must not import React Native.
- HealthKit is read-only. The HealthKit module is lazy (`hk()` from `src/healthkit/native.ts`), never a top-level import.
- Type-check: `npx tsc --noEmit` must stay clean.

**Deliberate simplifications vs the spec (tell Bar in the final report):**
- Sleep detail chart = bars of hours asleep per night / week / month (the stacked stages stay on the card only).
- "All" period = the last 10 years by month, not "from the oldest sample".
- Detail screen's dim line under the big value = the card's meta line (no exact time of the latest reading).
- `fmtHMM` lives in `src/utils/format.ts` (as the spec says) — `format.ts` has no imports, so node can load it.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/insights/metrics.ts` | create | Catalogue: 25 metrics, 6 groups, `InsightsLayout` type. Pure. |
| `src/insights/summary.ts` | create | Pure maths: periods, buckets, compare/avg/baseline/stats, sleep nights, workout weeks, card text, layout order/hide/move. |
| `src/insights/summary.check.ts` | create | Self-check for `summary.ts`. |
| `src/utils/format.ts` | modify | Add `fmtHMM`. |
| `src/utils/tokens.ts` | modify | Add `groupColors`, `groupLabelColors`, `sleepColors`. |
| `src/utils/profile.ts` | modify | `ProfileRow.insights_layout?`. |
| `src/db/schema.ts` | modify | SQLite v7: `profiles.insights_layout`. |
| `src/db/queries.ts` | modify | Column list + JSON parse for `insights_layout`. |
| `supabase/schema.sql` | modify | `insights_layout jsonb`. |
| `supabase/migrations/2026-11-23-insights-layout.sql` | create | Migration for the existing DB. |
| `src/healthkit/permissions.ts` | modify | `READ` = base list + every catalogue `hk` id. |
| `app.json` | modify | Health usage string. |
| `src/healthkit/insights.ts` | create | `readMetric()` — HealthKit → `MetricData`. |
| `src/store/useInsightsStore.ts` | create | 91-day cache of every metric, throttled reload. |
| `src/components/Chart.tsx` | modify | Add `Sparkline`, `TrendChart`. |
| `app/(tabs)/insights.tsx` | replace | The tab. |
| `app/insight/[key].tsx` | create | Detail screen. |
| `app/insights-edit.tsx` | create | Edit screen (switch + drag). |
| `app/_layout.tsx` | modify | `GestureHandlerRootView` wrapper + 2 new routes. |
| `architecture.md`, `CLAUDE.md`, `FRONTEND_SPEC.md`, `docs/HANDOFF.md` | modify | Docs. |

---

### Task 1: Metric catalogue + colour tokens

**Files:**
- Create: `src/insights/metrics.ts`
- Modify: `src/utils/tokens.ts` (append after `buttons`)

- [ ] **Step 1: Create `src/insights/metrics.ts`**

```ts
// Insights catalogue (RA-29): every Apple Health metric the Insights tab can show.
// Pure — no React Native imports (node self-check imports it). Adding a metric = one entry here.

export type Group = 'heart' | 'fitness' | 'form' | 'sleep' | 'body' | 'activity'
export type Kind = 'line' | 'bars' | 'sleep' | 'events' | 'workouts'
/** The card's dim line: see cardText() in summary.ts. */
export type Meta = 'compare' | 'today' | 'date' | 'lastRun' | 'baseline' | 'none'

export interface Metric {
  key: string                // stable id, stored in profiles.insights_layout
  group: Group
  label: string
  unit: string               // display unit ('' for counts)
  kind: Kind
  hk: readonly string[]      // HealthKit identifiers (read permission + query)
  hkUnit?: string            // unit asked from HealthKit (quantity types)
  scale?: number             // HealthKit value × scale = display value (m/s → km/h, fraction → %)
  meta: Meta
  decimals: number
  explain: string            // detail screen "what this means" — facts only, no judging
}

/** What the user hid and how they ordered metrics. null on the profile = defaults (all shown, catalogue order). */
export interface InsightsLayout { hidden: string[]; order: string[] }

export const GROUPS: readonly { key: Group; title: string; note?: string }[] = [
  { key: 'heart', title: 'Heart' },
  { key: 'fitness', title: 'Fitness' },
  { key: 'form', title: 'Running form', note: 'Apple Watch' },
  { key: 'sleep', title: 'Sleep & recovery' },
  { key: 'body', title: 'Body' },
  { key: 'activity', title: 'Activity', note: 'daily totals' },
]

const Q = (id: string) => `HKQuantityTypeIdentifier${id}`
const C = (id: string) => `HKCategoryTypeIdentifier${id}`

export const METRICS: readonly Metric[] = [
  // Heart
  { key: 'restingHr', group: 'heart', label: 'Resting HR', unit: 'bpm', kind: 'line', hk: [Q('RestingHeartRate')], hkUnit: 'count/min', meta: 'compare', decimals: 0,
    explain: 'Your heart rate while you are fully at rest. It usually drops as aerobic fitness improves, and can rise with fatigue, illness or short sleep.' },
  { key: 'hrv', group: 'heart', label: 'HRV', unit: 'ms', kind: 'line', hk: [Q('HeartRateVariabilitySDNN')], hkUnit: 'ms', meta: 'compare', decimals: 0,
    explain: 'Heart rate variability: how much the time between heartbeats varies (SDNN). It changes a lot from day to day; the trend over weeks says more than one reading.' },
  { key: 'cardioRecovery', group: 'heart', label: 'Cardio recovery', unit: 'bpm', kind: 'line', hk: [Q('HeartRateRecoveryOneMinute')], hkUnit: 'count/min', meta: 'date', decimals: 0,
    explain: 'How much your heart rate drops in the first minute after a workout ends. Apple measures it when you end a workout on Apple Watch.' },
  { key: 'walkingHr', group: 'heart', label: 'Walking HR', unit: 'bpm', kind: 'line', hk: [Q('WalkingHeartRateAverage')], hkUnit: 'count/min', meta: 'compare', decimals: 0,
    explain: 'Your average heart rate while walking during the day, measured by Apple Watch.' },
  { key: 'hrEvents', group: 'heart', label: 'HR notifications', unit: '', kind: 'events', hk: [C('HighHeartRateEvent'), C('LowHeartRateEvent'), C('IrregularHeartRhythmEvent')], meta: 'none', decimals: 0,
    explain: 'Notifications Apple Watch sent for a high or low heart rate while you seemed inactive, or for an irregular rhythm.' },
  // Fitness
  { key: 'vo2max', group: 'fitness', label: 'VO2max', unit: 'ml/kg·min', kind: 'line', hk: [Q('VO2Max')], hkUnit: 'ml/(kg*min)', meta: 'date', decimals: 1,
    explain: 'Cardio fitness: the most oxygen your body can use during intense exercise. Apple Watch estimates it during outdoor walks, runs and hikes.' },
  // Running form
  { key: 'power', group: 'form', label: 'Running power', unit: 'W', kind: 'line', hk: [Q('RunningPower')], hkUnit: 'W', meta: 'lastRun', decimals: 0,
    explain: 'How much power you produce while running, from your speed, the slope and your weight.' },
  { key: 'groundContact', group: 'form', label: 'Ground contact', unit: 'ms', kind: 'line', hk: [Q('RunningGroundContactTime')], hkUnit: 'ms', meta: 'lastRun', decimals: 0,
    explain: 'How long each foot stays on the ground per step while running.' },
  { key: 'vertOsc', group: 'form', label: 'Vertical osc.', unit: 'cm', kind: 'line', hk: [Q('RunningVerticalOscillation')], hkUnit: 'cm', meta: 'lastRun', decimals: 1,
    explain: 'How much your body moves up and down with each step while running.' },
  { key: 'runSpeed', group: 'form', label: 'Running speed', unit: 'km/h', kind: 'line', hk: [Q('RunningSpeed')], hkUnit: 'm/s', scale: 3.6, meta: 'lastRun', decimals: 1,
    explain: 'Your average running speed as measured by Apple Watch.' },
  // Sleep & recovery
  { key: 'sleep', group: 'sleep', label: 'Sleep last night', unit: 'h', kind: 'sleep', hk: [C('SleepAnalysis')], meta: 'none', decimals: 1,
    explain: 'Time asleep per night, split into core, deep and REM sleep when Apple Watch tracked it. Time awake in bed is not counted as sleep.' },
  { key: 'respiratory', group: 'sleep', label: 'Respiratory', unit: '/min', kind: 'line', hk: [Q('RespiratoryRate')], hkUnit: 'count/min', meta: 'compare', decimals: 1,
    explain: 'Breaths per minute, measured by Apple Watch while you sleep.' },
  { key: 'spo2', group: 'sleep', label: 'Blood oxygen', unit: '%', kind: 'line', hk: [Q('OxygenSaturation')], hkUnit: '%', scale: 100, meta: 'compare', decimals: 0,
    explain: 'The percentage of oxygen carried by your red blood cells, measured by Apple Watch.' },
  { key: 'wristTemp', group: 'sleep', label: 'Wrist temp', unit: '°C', kind: 'line', hk: [Q('AppleSleepingWristTemperature')], hkUnit: 'degC', meta: 'baseline', decimals: 1,
    explain: 'Your wrist temperature during sleep, shown as the change from your own 90-day average.' },
  // Body
  { key: 'weight', group: 'body', label: 'Weight', unit: 'kg', kind: 'line', hk: [Q('BodyMass')], hkUnit: 'kg', meta: 'date', decimals: 1,
    explain: 'Your body weight, as logged in Apple Health by you or a connected scale.' },
  { key: 'bodyFat', group: 'body', label: 'Body fat', unit: '%', kind: 'line', hk: [Q('BodyFatPercentage')], hkUnit: '%', scale: 100, meta: 'date', decimals: 1,
    explain: 'Your body fat percentage, as logged in Apple Health by you or a connected scale.' },
  // Activity (daily totals)
  { key: 'steps', group: 'activity', label: 'Steps', unit: '', kind: 'bars', hk: [Q('StepCount')], hkUnit: 'count', meta: 'today', decimals: 0,
    explain: 'Steps per day, from your iPhone and Apple Watch (Apple Health removes the overlap).' },
  { key: 'activeKcal', group: 'activity', label: 'Active calories', unit: 'kcal', kind: 'bars', hk: [Q('ActiveEnergyBurned')], hkUnit: 'kcal', meta: 'today', decimals: 0,
    explain: 'Energy burned by movement per day, on top of what your body uses at rest.' },
  { key: 'exercise', group: 'activity', label: 'Exercise', unit: 'min', kind: 'bars', hk: [Q('AppleExerciseTime')], hkUnit: 'min', meta: 'today', decimals: 0,
    explain: 'Minutes per day of movement at the intensity of a brisk walk or more (the green Activity ring).' },
  { key: 'walkRun', group: 'activity', label: 'Walk + run', unit: 'km', kind: 'bars', hk: [Q('DistanceWalkingRunning')], hkUnit: 'm', scale: 0.001, meta: 'today', decimals: 1,
    explain: 'Total distance walked and run per day, including your runs.' },
  { key: 'flights', group: 'activity', label: 'Flights climbed', unit: '', kind: 'bars', hk: [Q('FlightsClimbed')], hkUnit: 'count', meta: 'today', decimals: 0,
    explain: 'Floors climbed per day (about 3 m of height each).' },
  { key: 'standHours', group: 'activity', label: 'Stand hours', unit: 'h', kind: 'bars', hk: [C('AppleStandHour')], meta: 'today', decimals: 0,
    explain: 'Hours per day in which you stood and moved for at least a minute (the blue Activity ring).' },
  { key: 'restingKcal', group: 'activity', label: 'Resting energy', unit: 'kcal', kind: 'bars', hk: [Q('BasalEnergyBurned')], hkUnit: 'kcal', meta: 'today', decimals: 0,
    explain: 'Energy your body uses per day at rest, estimated by Apple Health.' },
  { key: 'daylight', group: 'activity', label: 'Time in daylight', unit: 'min', kind: 'bars', hk: [Q('TimeInDaylight')], hkUnit: 'min', meta: 'today', decimals: 0,
    explain: 'Minutes per day spent in daylight, measured by Apple Watch.' },
  { key: 'otherWorkouts', group: 'activity', label: 'Other workouts', unit: 'h', kind: 'workouts', hk: ['HKWorkoutTypeIdentifier'], meta: 'none', decimals: 1,
    explain: 'Time per week in workouts other than running (cycling, strength, swimming…), from any app that saves workouts to Apple Health.' },
]
```

- [ ] **Step 2: Append colour tokens to `src/utils/tokens.ts`**

```ts
// Insights (RA-29): one colour per metric group, all reused from the palette above.
// Lime is not used here: it is kept for the calculated insight cards (later).
export const groupColors = {
  heart: colors.hrLine,       // #d74f49
  fitness: colors.elevLine,   // #3bac68
  form: colors.iconOrange,    // #dc6600
  sleep: colors.iconSky,      // #6db8e8
  body: colors.iconTeal,      // #00a6b8
  activity: colors.iconGold,  // #e8a900
} as const

// Card labels: 70 % group colour + 30 % lavender, pre-blended (RN has no color-mix).
export const groupLabelColors = {
  heart: '#d16880', fitness: '#64a995', form: '#d5784c', sleep: '#87b2ef', body: '#3ba5cd', activity: '#dda74c',
} as const

// Sleep stages on the Sleep card (sky shades).
export const sleepColors = { awake: '#3a4a6b', core: '#4f86b8', deep: '#6db8e8', rem: '#a6d8f5' } as const
```

- [ ] **Step 3: Verify**

Run: `node -e "import('./src/insights/metrics.ts').then(m => console.log(m.METRICS.length, new Set(m.METRICS.map(x => x.key)).size))"`
Expected: `25 25`

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Checkpoint** — files: `src/insights/metrics.ts`, `src/utils/tokens.ts`. Bar commits.

---

### Task 2: Pure Insights maths + self-check (TDD)

**Files:**
- Modify: `src/utils/format.ts` (append)
- Create: `src/insights/summary.check.ts`
- Create: `src/insights/summary.ts`

- [ ] **Step 1: Append `fmtHMM` to `src/utils/format.ts`**

```ts
/** Seconds → "h:mm" (sleep, workout time). 25 920 → "7:12". */
export function fmtHMM(sec: number): string {
  const m = Math.round(sec / 60)
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}
```

- [ ] **Step 2: Write the failing self-check `src/insights/summary.check.ts`**

```ts
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
eq(toggleHidden(moved, 'hrv').order, moved.order, 'toggle keeps order')

console.log('summary.check: all passed')
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node src/insights/summary.check.ts`
Expected: FAIL — `Cannot find module …/src/insights/summary.ts`.

- [ ] **Step 4: Create `src/insights/summary.ts`**

```ts
// Pure Insights maths (RA-29). No React Native imports: `node src/insights/summary.check.ts` runs it.
// Points are daily (or weekly/monthly) values, sorted by date ascending, already in display units.
import { GROUPS, METRICS, type InsightsLayout, type Metric } from './metrics.ts'
import { fmtDate, fmtHMM } from '../utils/format.ts'
import { isoDate } from '../utils/profile.ts'

export interface Point { date: string; value: number }   // 'YYYY-MM-DD' = start of the bucket
export interface Night { date: string; asleep: number; core: number; deep: number; rem: number; awake: number }  // seconds
export interface HrEvent { start: Date; type: 'high' | 'low' | 'irregular' }
export interface WorkoutItem { start: Date; seconds: number; type: string }
export interface WorkoutWeek { date: string; seconds: number; byType: Record<string, number> }
/** What the reader returns. `points` is always the chartable series (sleep: hours/night, workouts: hours/week). */
export interface MetricData { points: Point[]; nights?: Night[]; events?: HrEvent[]; weeks?: WorkoutWeek[] }

export type Period = 'month' | '3m' | 'year' | 'all'
export type Bucket = 'day' | 'week' | 'month'
export const PERIODS: readonly { key: Period; label: string }[] = [
  { key: 'month', label: 'Month' }, { key: '3m', label: '3 months' }, { key: 'year', label: 'Year' }, { key: 'all', label: 'All' },
]
// ponytail: "All" = 10 years back, not the oldest sample; empty buckets are dropped anyway.
const PERIOD_DAYS: Record<Period, number> = { month: 30, '3m': 91, year: 365, all: 3650 }
export const bucketFor = (p: Period): Bucket => (p === 'year' ? 'week' : p === 'all' ? 'month' : 'day')

export const EVENT_LABEL: Record<HrEvent['type'], string> = { high: 'High heart rate', low: 'Low heart rate', irregular: 'Irregular rhythm' }

// ─── dates & buckets ─────────────────────────────────────────────────────────

const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12) }  // noon: DST-safe
export const addDays = (iso: string, n: number): string => { const d = parse(iso); d.setDate(d.getDate() + n); return isoDate(d) }
const mondayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))

/** Local midnight where a period starts, aligned to its bucket (HealthKit uses it as the statistics anchor). */
export function periodStart(p: Period, today: Date): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - PERIOD_DAYS[p] + 1)
  if (bucketFor(p) === 'week') return mondayOf(d)
  if (bucketFor(p) === 'month') return new Date(d.getFullYear(), d.getMonth(), 1)
  return d
}

export function bucketKey(iso: string, b: Bucket): string {
  if (b === 'day') return iso
  if (b === 'month') return iso.slice(0, 8) + '01'
  return isoDate(mondayOf(parse(iso)))
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const mean = (xs: number[]): number | null => (xs.length ? sum(xs) / xs.length : null)

export function rebucket(points: Point[], b: Bucket, how: 'sum' | 'avg'): Point[] {
  const by = new Map<string, number[]>()
  for (const p of points) {
    const k = bucketKey(p.date, b)
    by.set(k, [...(by.get(k) ?? []), p.value])
  }
  return [...by.keys()].sort().map(date => {
    const vs = by.get(date)!
    return { date, value: how === 'sum' ? sum(vs) : sum(vs) / vs.length }
  })
}

/** Points in the `days` days ending `offset` days before today (offset 0 = up to and including today). */
export function inWindow(points: Point[], today: string, offset: number, days: number): Point[] {
  const to = addDays(today, -offset), from = addDays(today, -(offset + days - 1))
  return points.filter(p => p.date >= from && p.date <= to)
}
const vals = (ps: Point[]) => ps.map(p => p.value)

// ─── numbers ─────────────────────────────────────────────────────────────────

/** Mean of the last 30 days minus mean of the 30 days before. */
export function compare(points: Point[], today: string): number | null {
  const a = mean(vals(inWindow(points, today, 0, 30))), b = mean(vals(inWindow(points, today, 30, 30)))
  return a == null || b == null ? null : a - b
}
export const dailyAvg = (points: Point[], today: string) => mean(vals(inWindow(points, today, 0, 30)))
/** Latest value minus the 90-day mean (wrist temperature, like Apple shows it). */
export function baseline(points: Point[], today: string): number | null {
  const last = points.at(-1), m = mean(vals(inWindow(points, today, 0, 90)))
  return last && m != null ? last.value - m : null
}
export function stats(points: Point[]): { min: number; avg: number; max: number } | null {
  if (!points.length) return null
  const v = vals(points)
  return { min: Math.min(...v), avg: sum(v) / v.length, max: Math.max(...v) }
}

/** 11840 → "11,840"; negatives use a real minus sign; never "−0.0". */
export function fmtNum(v: number, decimals: number): string {
  const abs = Math.abs(v).toFixed(decimals)
  const [i, f] = abs.split('.')
  const neg = v < 0 && Number(abs) !== 0
  return (neg ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? `.${f}` : '')
}
const signed = (v: number, d: number) => (Number(v.toFixed(d)) > 0 ? '+' : '') + fmtNum(v, d)
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

// ─── sleep ───────────────────────────────────────────────────────────────────

export interface SleepSample { start: Date; end: Date; value: number; source: string; isWatch: boolean }
// HKCategoryValueSleepAnalysis: 0 inBed (ignored), 1 asleepUnspecified, 2 awake, 3 core, 4 deep, 5 REM.
/** A night belongs to the date it ends; anything ending after 18:00 counts for the next night. */
const nightOf = (end: Date) => isoDate(new Date(end.getTime() + 6 * 3600_000))

export function sleepNights(samples: SleepSample[]): Night[] {
  const by = new Map<string, Map<string, { isWatch: boolean; n: Night }>>()
  for (const s of samples) {
    if (s.value === 0) continue
    const date = nightOf(s.end), sec = (s.end.getTime() - s.start.getTime()) / 1000
    if (!by.has(date)) by.set(date, new Map())
    const srcs = by.get(date)!
    if (!srcs.has(s.source)) srcs.set(s.source, { isWatch: s.isWatch, n: { date, asleep: 0, core: 0, deep: 0, rem: 0, awake: 0 } })
    const n = srcs.get(s.source)!.n
    if (s.value === 2) { n.awake += sec; continue }
    n.asleep += sec
    if (s.value === 3) n.core += sec
    else if (s.value === 4) n.deep += sec
    else if (s.value === 5) n.rem += sec
  }
  // Several sources for one night (Watch + a sleep app): the Watch wins, else the source with the most sleep.
  return [...by.keys()].sort().map(date => {
    const cands = [...by.get(date)!.values()]
    const pool = cands.some(c => c.isWatch) ? cands.filter(c => c.isWatch) : cands
    return pool.reduce((a, b) => (b.n.asleep > a.n.asleep ? b : a)).n
  }).filter(n => n.asleep > 0)
}

// ─── workouts ────────────────────────────────────────────────────────────────

/** HealthKit enum name → label: 'traditionalStrengthTraining' → 'Traditional strength training'. */
export function activityName(raw: string): string {
  const s = raw.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function workoutWeeks(items: WorkoutItem[]): WorkoutWeek[] {
  const by = new Map<string, WorkoutWeek>()
  for (const w of items) {
    const date = bucketKey(isoDate(w.start), 'week')
    if (!by.has(date)) by.set(date, { date, seconds: 0, byType: {} })
    const wk = by.get(date)!
    wk.seconds += w.seconds
    wk.byType[w.type] = (wk.byType[w.type] ?? 0) + w.seconds
  }
  return [...by.keys()].sort().map(k => by.get(k)!)
}

// ─── card text ───────────────────────────────────────────────────────────────

export const hasData = (d: MetricData | undefined): boolean => !!d && (d.points.length > 0 || !!d.events?.length)

export interface CardText { value: string; unit: string; meta: string }

/** Big value + unit + dim line for a card. Call only when hasData(d). */
export function cardText(m: Metric, d: MetricData, now: Date): CardText {
  const today = isoDate(now)
  switch (m.kind) {
    case 'sleep': {
      const n = d.nights!.at(-1)!
      const avg = mean(vals(inWindow(d.points, today, 0, 30)))
      return { value: fmtHMM(n.asleep), unit: 'h', meta: avg == null ? '' : `avg ${fmtHMM(avg * 3600)} over 30 days` }
    }
    case 'events': {
      const ev = d.events!, e = ev.at(-1)!
      return { value: String(ev.length), unit: 'in 90 days', meta: `${EVENT_LABEL[e.type]} · ${fmtDate(isoDate(e.start))}, ${hhmm(e.start)}` }
    }
    case 'workouts': {
      const wk = d.weeks?.find(w => w.date === bucketKey(today, 'week'))
      const top = wk
        ? Object.entries(wk.byType).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t, s]) => `${t} ${fmtHMM(s)}`).join(' · ')
        : 'none this week'
      return { value: fmtHMM(wk?.seconds ?? 0), unit: 'h this week', meta: top }
    }
    case 'bars': {
      const t = d.points.find(p => p.date === today)?.value ?? 0
      return { value: fmtNum(t, m.decimals), unit: m.unit, meta: `today · avg ${fmtNum(dailyAvg(d.points, today) ?? 0, m.decimals)}` }
    }
    case 'line': {
      const last = d.points.at(-1)!
      if (m.meta === 'baseline') {
        const b = baseline(d.points, today)
        return { value: b == null ? '—' : signed(b, m.decimals), unit: m.unit, meta: 'vs your average' }
      }
      const value = fmtNum(last.value, m.decimals)
      if (m.meta === 'lastRun') return { value, unit: m.unit, meta: 'avg, last run' }
      const c = m.meta === 'compare' ? compare(d.points, today) : null
      return { value, unit: m.unit, meta: c != null ? `${signed(c, m.decimals)} vs prior 30 days` : fmtDate(last.date) }
    }
  }
}

// ─── layout (Edit) ───────────────────────────────────────────────────────────

/** Every metric, groups in fixed order; inside a group the user's order first, then catalogue order. */
export function orderedMetrics(layout: InsightsLayout | null): Metric[] {
  const pos = new Map((layout?.order ?? []).map((k, i) => [k, i]))
  const rank = (m: Metric) => pos.get(m.key) ?? 1000 + METRICS.indexOf(m)
  return GROUPS.flatMap(g => METRICS.filter(m => m.group === g.key).sort((a, b) => rank(a) - rank(b)))
}
export const isHidden = (layout: InsightsLayout | null, key: string): boolean => layout?.hidden.includes(key) ?? false

export function toggleHidden(layout: InsightsLayout | null, key: string): InsightsLayout {
  const hidden = layout?.hidden ?? []
  return { hidden: hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key], order: layout?.order ?? [] }
}

/** Move a metric to index `to` inside its own group. Returns the full order (every key). */
export function moveTo(layout: InsightsLayout | null, key: string, to: number): InsightsLayout {
  const all = orderedMetrics(layout)
  const group = all.find(m => m.key === key)!.group
  const keys = all.filter(m => m.group === group).map(m => m.key).filter(k => k !== key)
  keys.splice(Math.max(0, Math.min(to, keys.length)), 0, key)
  const order = GROUPS.flatMap(g => (g.key === group ? keys : all.filter(m => m.group === g.key).map(m => m.key)))
  return { hidden: layout?.hidden ?? [], order }
}
```

- [ ] **Step 5: Run the self-check**

Run: `node src/insights/summary.check.ts`
Expected: `summary.check: all passed`. If an assertion fails, fix `summary.ts` (not the expected value) unless the expectation itself contradicts the spec.

- [ ] **Step 6: Type-check** — `npx tsc --noEmit` → no errors.

- [ ] **Step 7: Checkpoint** — files: `src/utils/format.ts`, `src/insights/summary.ts`, `src/insights/summary.check.ts`. Bar commits.

---

### Task 3: `profiles.insights_layout` (cloud + phone)

**Files:**
- Modify: `supabase/schema.sql` (profiles table, after `zone_bounds`)
- Create: `supabase/migrations/2026-11-23-insights-layout.sql`
- Modify: `src/db/schema.ts` (VERSION + new block)
- Modify: `src/db/queries.ts:15-16` (profile columns) and `loadProfile()`
- Modify: `src/utils/profile.ts` (`ProfileRow`)

- [ ] **Step 1: `supabase/schema.sql`** — in `create table public.profiles`, after the `zone_bounds` line add:

```sql
  insights_layout jsonb,                                  -- RA-29: { hidden: [...], order: [...] }; null = defaults
```

- [ ] **Step 2: Create `supabase/migrations/2026-11-23-insights-layout.sql`**

```sql
-- RA-29: the Insights tab's hide/order choice. Run once in the Supabase SQL Editor
-- BEFORE opening the new app code (a profile push rejected for a missing column is marked failed for good).
alter table public.profiles
  add column if not exists insights_layout jsonb;
```

- [ ] **Step 3: `src/db/schema.ts`** — change `const VERSION = 6` to `const VERSION = 7` and append at the end of the file:

```ts
// RA-29: Insights hide/order choice (JSON text, like zone_bounds).
if (v < 7) db.execSync(`ALTER TABLE profiles ADD COLUMN insights_layout TEXT; PRAGMA user_version = ${VERSION};`)
```

- [ ] **Step 4: `src/db/queries.ts`** — add `'insights_layout'` to the `profiles` column list (before `'updated_at'`), and parse it in `loadProfile()`:

```ts
  profiles: ['id', 'unit', 'first_name', 'last_name', 'dob', 'sex', 'height_cm', 'weight_kg', 'resting_hr',
    'vo2max', 'hr_max', 'hr_max_manual', 'zone_method', 'lthr', 'zone_bounds', 'insights_layout', 'updated_at'],
```

```ts
  return {
    ...r,
    hr_max_manual: r.hr_max_manual === 1,
    zone_bounds: r.zone_bounds == null ? null : JSON.parse(r.zone_bounds as string),
    insights_layout: r.insights_layout == null ? null : JSON.parse(r.insights_layout as string),
  } as unknown as ProfileRow
```

(`toSql` already stringifies objects on write; the pull path goes through `upsertLocal`, which uses the same column list.)

- [ ] **Step 5: `src/utils/profile.ts`** — add the import at the top (type-only, `.ts` extension) and the optional field after `zone_bounds`:

```ts
import type { InsightsLayout } from '../insights/metrics.ts'
```

```ts
  zone_bounds: number[] | null    // Manual: bpm where Z2..Z5 start
  insights_layout?: InsightsLayout | null  // RA-29: Insights hide/order; null/missing = defaults
```

(Optional so existing `ProfileRow` literals in the self-checks still type-check.)

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → no errors.
Run: `node src/db/sync.check.ts` and `node src/utils/profile.check.ts` → both pass as before.

- [ ] **Step 7: Checkpoint** — files: `supabase/schema.sql`, `supabase/migrations/2026-11-23-insights-layout.sql`, `src/db/schema.ts`, `src/db/queries.ts`, `src/utils/profile.ts`. Bar commits.

---

### Task 4: Health permissions for the new types

**Files:**
- Modify: `src/healthkit/permissions.ts:4-16`
- Modify: `app.json` (`NSHealthShareUsageDescription`)

- [ ] **Step 1: Build `READ` from the catalogue** — replace the `READ` constant with:

```ts
import type { ObjectTypeIdentifier } from '@kingstinct/react-native-healthkit'
import { METRICS } from '../insights/metrics'
```

```ts
// One prompt for everything the app reads (RA-3 runs, RA-11 body data, RA-29 Insights).
// iOS shows it once per install; types added later are asked about once more (only the new ones).
const BASE = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierStepCount',
  'HKCharacteristicTypeIdentifierDateOfBirth',
  'HKCharacteristicTypeIdentifierBiologicalSex',
  'HKQuantityTypeIdentifierHeight',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierVO2Max',
]
const READ = [...new Set([...BASE, ...METRICS.flatMap(m => m.hk)])] as ObjectTypeIdentifier[]
```

(`import type` is erased, so the lazy-load rule holds. If `ObjectTypeIdentifier` is not exported from the package root, import it from `@kingstinct/react-native-healthkit/src/types/Shared` or cast `as never` in the two calls.)

- [ ] **Step 2: `app.json`** — set the usage string to:

```
"Chronodrom reads your runs, heart rate, sleep, activity and body data from Apple Health to build your run history and Insights. It never writes to Apple Health."
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → no errors; `npx expo config --type public > /dev/null` → exits 0.

- [ ] **Step 4: Checkpoint** — files: `src/healthkit/permissions.ts`, `app.json`. Bar commits. (Native permission change → a new dev build is needed before device testing, Task 11.)

---

### Task 5: HealthKit reader

**Files:**
- Create: `src/healthkit/insights.ts`

- [ ] **Step 1: Create the reader**

```ts
// Reads Insights data from Apple Health (RA-29). Read-only. Every failure → empty data:
// iOS never says what was refused, so a "no" and "no data" look the same.
import type { Metric } from '../insights/metrics'
import {
  activityName, rebucket, sleepNights, workoutWeeks,
  type Bucket, type HrEvent, type MetricData, type Point,
} from '../insights/summary'
import { isoDate } from '../utils/profile'
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
            seconds: (w.endDate.getTime() - w.startDate.getTime()) / 1000,
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
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → no errors. If a library type disagrees (e.g. `sourceRevision.productType` path, `queryWorkoutSamples` options), check the real shape in `node_modules/@kingstinct/react-native-healthkit/src/types/` (`Shared.ts`, `Workouts.ts`, `Source.ts`) and in `src/healthkit/importRuns.ts`, which already reads `w.sourceRevision.productType` and `w.sourceRevision.source.bundleIdentifier` — follow that code. Do not add `any` beyond the existing `as never` casts.

- [ ] **Step 3: Checkpoint** — file: `src/healthkit/insights.ts`. Bar commits.

---

### Task 6: Insights store

**Files:**
- Create: `src/store/useInsightsStore.ts`

- [ ] **Step 1: Create the store**

```ts
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
```

(No reset on logout: the data is this iPhone's Health data, identical for any account signed in on it.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Checkpoint** — file: `src/store/useInsightsStore.ts`. Bar commits.

---

### Task 7: `Sparkline` + `TrendChart`

**Files:**
- Modify: `src/components/Chart.tsx` (append; add imports at the top)

- [ ] **Step 1: Imports** — `React`, `useState`, `View`, `Circle`, `Line`, `Path`, `Rect`, `Svg`, `SvgText` are already imported in `src/components/Chart.tsx`. Extend the existing format import to:

```ts
import { fmtDate, fmtMMSS, fmtPace } from '../utils/format'
```

- [ ] **Step 2: Append the two components**

```tsx
// ─── Insights (RA-29) ────────────────────────────────────────────────────────
// Real data only. line = readings (group colour line + 12 % fill, last point dotted);
// bars = totals (past buckets 40 % opacity, latest solid).

type TrendPoint = { date: string; value: number }

export function Sparkline({ points, kind, color, height = 30 }: {
  points: TrendPoint[]; kind: 'line' | 'bars'; color: string; height?: number
}) {
  const [w, setW] = useState(0)
  const n = points.length
  let body: React.ReactNode = null
  if (w > 0 && n > 0) {
    const v = points.map(p => p.value)
    if (kind === 'bars') {
      const gap = 3, bw = Math.max(1, (w - gap * (n - 1)) / n), max = Math.max(...v) || 1
      body = v.map((x, i) => {
        const bh = Math.max(2, (height - 2) * x / max)
        return <Rect key={i} x={i * (bw + gap)} y={height - bh} width={bw} height={bh} rx={2} fill={color} opacity={i === n - 1 ? 1 : 0.4} />
      })
    } else {
      const p = 4, min = Math.min(...v), range = (Math.max(...v) - min) || 1
      const X = (i: number) => (n === 1 ? w / 2 : p + i * (w - 2 * p) / (n - 1))
      const Y = (x: number) => p + (height - 2 * p) * (1 - (x - min) / range)
      const d = v.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x).toFixed(1)}`).join(' ')
      body = <>
        {n > 1 && <Path d={`${d} L${X(n - 1)} ${height} L${X(0)} ${height} Z`} fill={color} opacity={0.12} />}
        {n > 1 && <Path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />}
        <Circle cx={X(n - 1)} cy={Y(v[n - 1])} r={3.2} fill={color} stroke={colors.bgSurface} strokeWidth={2} />
      </>
    }
  }
  return (
    <View style={{ height }} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {body && <Svg width={w} height={height}>{body}</Svg>}
    </View>
  )
}

/** Detail chart: 3 dashed gridlines with values on the right, 3 date labels below. */
export function TrendChart({ points, kind, color, format, height = 170 }: {
  points: TrendPoint[]; kind: 'line' | 'bars'; color: string; format: (v: number) => string; height?: number
}) {
  const [w, setW] = useState(0)
  const n = points.length
  const pl = 4, pr = 34, pt = 8, pb = 20
  let body: React.ReactNode = null
  if (w > 0 && n > 0) {
    const v = points.map(p => p.value)
    const lo = kind === 'bars' ? 0 : Math.min(...v), hi = Math.max(...v)
    const pad = kind === 'bars' ? 0 : ((hi - lo) || 1) * 0.1
    const min = lo - pad, max = hi + pad, range = (max - min) || 1
    const plotW = w - pl - pr, plotH = height - pt - pb
    const Y = (x: number) => pt + plotH * (1 - (x - min) / range)
    const grid = [min, (min + max) / 2, max].map((g, i) => (
      <React.Fragment key={`g${i}`}>
        <Line x1={pl} x2={pl + plotW} y1={Y(g)} y2={Y(g)} stroke={colors.borderSubtle} strokeDasharray="2 4" />
        <SvgText x={w - pr + 6} y={Y(g) + 4} fill={colors.textFaint} fontSize={10} fontFamily={fonts.mono}>{format(g)}</SvgText>
      </React.Fragment>
    ))
    const idx = n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1]
    const X = (i: number) => (n === 1 ? pl + plotW / 2 : pl + i * plotW / (n - 1))
    const anchors = ['start', 'middle', 'end'] as const
    const dates = idx.map((i, k) => (
      <SvgText key={`d${k}`} x={X(i)} y={height - 4} fill={colors.textFaint} fontSize={10} fontFamily={fonts.body}
        textAnchor={n === 1 ? 'middle' : anchors[k]}>{fmtDate(points[i].date)}</SvgText>
    ))
    let marks: React.ReactNode
    if (kind === 'bars') {
      const slot = plotW / n, bw = Math.max(1.5, slot * 0.6)
      marks = v.map((x, i) => (
        <Rect key={i} x={pl + i * slot + (slot - bw) / 2} y={Y(x)} width={bw} height={Math.max(1, Y(0) - Y(x))} rx={1.5}
          fill={color} opacity={i === n - 1 ? 1 : 0.55} />
      ))
    } else {
      const d = v.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x).toFixed(1)}`).join(' ')
      marks = <>
        {n > 1 && <Path d={`${d} L${X(n - 1)} ${pt + plotH} L${X(0)} ${pt + plotH} Z`} fill={color} opacity={0.12} />}
        {n > 1 && <Path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />}
        <Circle cx={X(n - 1)} cy={Y(v[n - 1])} r={4} fill={color} stroke={colors.bgChart} strokeWidth={2} />
      </>
    }
    body = <>{grid}{marks}{dates}</>
  }
  return (
    <View style={{ height }} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {body && <Svg width={w} height={height}>{body}</Svg>}
    </View>
  )
}
```

Screens pass the value formatter (`v => fmtNum(v, decimals)` or h:mm), so the chart stays unit-agnostic.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Checkpoint** — file: `src/components/Chart.tsx`. Bar commits.

---

### Task 8: Insights tab

**Files:**
- Replace: `app/(tabs)/insights.tsx`

- [ ] **Step 1: Replace the placeholder**

```tsx
// Insights tab (RA-29): Apple Health metrics as grouped trend cards. Layout from the Figma
// "01 Data & insights" heading + dark card style; one colour per group; lime kept for future insight cards.
import { useCallback, useEffect } from 'react'
import { AppState, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Sparkline } from '../../src/components/Chart'
import { GROUPS, type Metric } from '../../src/insights/metrics'
import { addDays, cardText, hasData, isHidden, orderedMetrics, type MetricData } from '../../src/insights/summary'
import { useInsightsStore } from '../../src/store/useInsightsStore'
import { useProfileStore } from '../../src/store/useProfileStore'
import { fmtHMM } from '../../src/utils/format'
import { isoDate } from '../../src/utils/profile'
import { buttons, colors, fonts, groupColors, groupLabelColors, sleepColors } from '../../src/utils/tokens'

const WIDE = new Set(['hrEvents', 'vo2max', 'sleep', 'otherWorkouts'])

export default function Insights() {
  const router = useRouter()
  const data = useInsightsStore(s => s.data)
  const loading = useInsightsStore(s => s.loading)
  const loadedAt = useInsightsStore(s => s.loadedAt)
  const load = useInsightsStore(s => s.load)
  const layout = useProfileStore(s => s.profile?.insights_layout ?? null)

  useFocusEffect(useCallback(() => { load() }, [load]))
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') load() })
    return () => sub.remove()
  }, [load])

  const now = new Date()
  const shown = orderedMetrics(layout).filter(m => !isHidden(layout, m.key) && hasData(data[m.key]))
  const noHealth = loadedAt > 0 && !Object.values(data).some(hasData)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading && loadedAt > 0} onRefresh={() => load(true)} tintColor={colors.textSecondary} />}
      >
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Your body,{'\n'}over time.</Text>
            <Text style={s.sub}>From Apple Health · last 30 days</Text>
          </View>
          {!noHealth && (
            <TouchableOpacity style={buttons.outline} onPress={() => router.push('/insights-edit')} activeOpacity={0.7}>
              <Text style={buttons.outlineText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {noHealth && (
          <View style={s.empty}>
            <Text style={s.emptyText}>Allow Apple Health access to see your data here.</Text>
            <TouchableOpacity style={buttons.outline} onPress={() => Linking.openSettings()} activeOpacity={0.7}>
              <Text style={buttons.outlineText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {GROUPS.map(g => {
          const ms = shown.filter(m => m.group === g.key)
          if (!ms.length) return null
          return (
            <View key={g.key} style={s.group}>
              <View style={s.gh}>
                <View style={s.ghLeft}>
                  <View style={[s.gdot, { backgroundColor: groupColors[g.key] }]} />
                  <Text style={s.gtitle}>{g.title}</Text>
                </View>
                {g.note && <Text style={s.gnote}>{g.note}</Text>}
              </View>
              <View style={s.grid}>
                {ms.map(m => (
                  <Card key={m.key} m={m} d={data[m.key]} now={now} onPress={() => router.push(`/insight/${m.key}`)} />
                ))}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

function Card({ m, d, now, onPress }: { m: Metric; d: MetricData; now: Date; onPress: () => void }) {
  const t = cardText(m, d, now)
  const color = groupColors[m.group]
  const from = addDays(isoDate(now), -29)
  const last30 = d.points.filter(p => p.date >= from)
  const night = m.kind === 'sleep' ? d.nights?.at(-1) : undefined
  return (
    <TouchableOpacity style={[s.card, WIDE.has(m.key) && s.wide]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.lbl, { color: groupLabelColors[m.group] }]}>{m.label}</Text>
      <Text style={s.val}>{t.value}{t.unit ? <Text style={s.unit}> {t.unit}</Text> : null}</Text>
      {!!t.meta && <Text style={s.meta} numberOfLines={1}>{t.meta}</Text>}
      {night && (
        <>
          <View style={s.stages}>
            {(['awake', 'core', 'deep', 'rem'] as const).map(k => night[k] > 0 && (
              <View key={k} style={{ flex: night[k], backgroundColor: sleepColors[k] }} />
            ))}
          </View>
          <View style={s.legend}>
            {(['awake', 'core', 'deep', 'rem'] as const).map(k => night[k] > 0 && (
              <View key={k} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: sleepColors[k] }]} />
                <Text style={s.legendText}>{k === 'rem' ? 'REM' : k[0].toUpperCase() + k.slice(1)} {fmtHMM(night[k])}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {(m.kind === 'line' || m.kind === 'bars') && last30.length > 0 && (
        <View style={s.spark}>
          <Sparkline points={last30} kind={m.kind} color={color} height={WIDE.has(m.key) ? 40 : 30} />
        </View>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 },
  head:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 22 },
  title:   { fontFamily: fonts.body, fontSize: 26, lineHeight: 30, fontWeight: '700', color: colors.textPrimary },
  sub:     { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, marginTop: 4 },
  empty:   { alignItems: 'center', gap: 14, paddingVertical: 60 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  group:   { marginBottom: 22 },
  gh:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  ghLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gdot:    { width: 9, height: 9, borderRadius: 3 },
  gtitle:  { fontFamily: fonts.body, fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  gnote:   { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:    { width: '48.5%', minHeight: 128, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault,
             borderRadius: 16, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  wide:    { width: '100%', minHeight: 0 },
  lbl:     { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  val:     { fontFamily: fonts.mono, fontSize: 26, fontWeight: '600', color: colors.textPrimary, marginTop: 6 },
  unit:    { fontFamily: fonts.body, fontSize: 12, fontWeight: '500', color: colors.textMuted },
  meta:    { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 4 },
  spark:   { marginTop: 'auto', paddingTop: 8 },
  stages:  { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 10 },
  legend:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 7, height: 7, borderRadius: 2 },
  legendText: { fontFamily: fonts.body, fontSize: 10, color: colors.textFaint },
})
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → no errors. (Routes `/insights-edit` and `/insight/[key]` are added in Tasks 9–10; typed routes may complain until then — if so, do Tasks 9–10 before re-running tsc.)

- [ ] **Step 3: Visual check in Expo Go** — `npx expo start`, open Insights: in Expo Go there is no HealthKit, so the tab must show the "Allow Apple Health access…" message with "Open Settings", and no Edit button. No red screen.

- [ ] **Step 4: Checkpoint** — file: `app/(tabs)/insights.tsx`. Bar commits.

---

### Task 9: Detail screen

**Files:**
- Create: `app/insight/[key].tsx`
- Modify: `app/_layout.tsx` (register the route)

- [ ] **Step 1: Create `app/insight/[key].tsx`**

```tsx
// Insights detail (RA-29): one metric over Month / 3 months / Year / All, read live from Apple Health.
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TrendChart } from '../../src/components/Chart'
import { readMetric } from '../../src/healthkit/insights'
import { METRICS } from '../../src/insights/metrics'
import {
  bucketFor, cardText, EVENT_LABEL, fmtNum, hasData, PERIODS, periodStart, stats,
  type MetricData, type Period,
} from '../../src/insights/summary'
import { useInsightsStore } from '../../src/store/useInsightsStore'
import { fmtDate, fmtHMM } from '../../src/utils/format'
import { isoDate } from '../../src/utils/profile'
import { colors, fonts, groupColors } from '../../src/utils/tokens'

export default function InsightDetail() {
  const { key } = useLocalSearchParams<{ key: string }>()
  const metric = METRICS.find(m => m.key === key)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const cached = useInsightsStore(s => s.data[key])
  const [period, setPeriod] = useState<Period>('3m')
  const [d, setD] = useState<MetricData | null>(null)

  useEffect(() => {
    if (!metric) return
    let live = true
    setD(null)
    readMetric(metric, periodStart(period, new Date()), bucketFor(period)).then(r => { if (live) setD(r) })
    return () => { live = false }
  }, [metric, period])

  if (!metric) return null
  const color = groupColors[metric.group]
  const head = hasData(cached) ? cardText(metric, cached, new Date()) : null
  const hours = metric.kind === 'sleep' || metric.kind === 'workouts'   // points are hours → show h:mm
  const format = (v: number) => (hours ? fmtHMM(v * 3600) : fmtNum(v, metric.decimals))
  const st = d && metric.kind !== 'events' ? stats(d.points) : null
  const typeTotals = metric.kind === 'workouts' && d?.weeks
    ? Object.entries(d.weeks.reduce<Record<string, number>>((acc, w) => {
        for (const [t, s] of Object.entries(w.byType)) acc[t] = (acc[t] ?? 0) + s
        return acc
      }, {})).sort((a, b) => b[1] - a[1])
    : []

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      <View style={s.back}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.iconText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.backTitle}>{metric.label}</Text>
      </View>

      {head && (
        <>
          <Text style={s.big}>{head.value}{head.unit ? <Text style={s.bigUnit}> {head.unit}</Text> : null}</Text>
          {!!head.meta && <Text style={s.meta}>{head.meta}</Text>}
        </>
      )}

      <View style={s.seg}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p.key} style={[s.segItem, period === p.key && s.segOn]} onPress={() => setPeriod(p.key)} activeOpacity={0.7}>
            <Text style={[s.segText, period === p.key && s.segTextOn]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!d ? (
        <ActivityIndicator color={colors.textSecondary} style={{ marginVertical: 60 }} />
      ) : metric.kind === 'events' ? (
        <View style={s.list}>
          {!d.events?.length && <Text style={s.none}>No notifications in this period.</Text>}
          {[...(d.events ?? [])].reverse().map((e, i) => (
            <View key={i} style={[s.row, i > 0 && s.rowBorder]}>
              <Text style={s.rowName}>{EVENT_LABEL[e.type]}</Text>
              <Text style={s.rowVal}>{fmtDate(isoDate(e.start))}, {String(e.start.getHours()).padStart(2, '0')}:{String(e.start.getMinutes()).padStart(2, '0')}</Text>
            </View>
          ))}
        </View>
      ) : d.points.length === 0 ? (
        <Text style={s.none}>No data in this period.</Text>
      ) : (
        <View style={s.chartBox}>
          <TrendChart points={d.points} kind={metric.kind === 'line' ? 'line' : 'bars'} color={color} format={format} />
        </View>
      )}

      {st && (
        <View style={s.stats}>
          {([['Min', st.min], ['Avg', st.avg], ['Max', st.max]] as const).map(([l, v]) => (
            <View key={l} style={s.stat}>
              <Text style={s.statLbl}>{l}</Text>
              <Text style={s.statVal}>{format(v)}</Text>
            </View>
          ))}
        </View>
      )}

      {typeTotals.length > 0 && (
        <View style={[s.list, { marginTop: 12 }]}>
          {typeTotals.map(([t, sec], i) => (
            <View key={t} style={[s.row, i > 0 && s.rowBorder]}>
              <Text style={s.rowName}>{t}</Text>
              <Text style={s.rowVal}>{fmtHMM(sec)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={s.explain}>{metric.explain}</Text>
      <Text style={s.src}>From Apple Health. Read-only.</Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bgApp },
  content:  { paddingHorizontal: 18, paddingBottom: 40 },
  back:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  iconBtn:  { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, lineHeight: 24, color: colors.textPrimary },
  backTitle:{ fontFamily: fonts.body, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  big:      { fontFamily: fonts.mono, fontSize: 44, fontWeight: '600', color: colors.textPrimary },
  bigUnit:  { fontFamily: fonts.body, fontSize: 15, fontWeight: '500', color: colors.textMuted },
  meta:     { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 4 },
  seg:      { flexDirection: 'row', backgroundColor: colors.bgSurface, borderRadius: 12, padding: 3, marginTop: 16, marginBottom: 12 },
  segItem:  { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  segOn:    { backgroundColor: colors.bgElevated },
  segText:  { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  segTextOn:{ color: colors.textPrimary, fontWeight: '600' },
  chartBox: { backgroundColor: colors.bgChart, borderRadius: 16, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8 },
  none:     { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, textAlign: 'center', marginVertical: 40 },
  stats:    { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat:     { flex: 1, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  statLbl:  { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textDim },
  statVal:  { fontFamily: fonts.mono, fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: 4 },
  list:     { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 16 },
  row:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  rowBorder:{ borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  rowName:  { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
  rowVal:   { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
  explain:  { marginTop: 14, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 16,
              padding: 14, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  src:      { marginTop: 10, fontFamily: fonts.body, fontSize: 11, color: colors.textGhost },
})
```

- [ ] **Step 2: Register the route in `app/_layout.tsx`** — inside the signed-in `Stack.Protected` block, after `<Stack.Screen name="run/[id]/zones" … />`:

```tsx
          <Stack.Screen name="insight/[key]" />
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Checkpoint** — files: `app/insight/[key].tsx`, `app/_layout.tsx`. Bar commits.

---

### Task 10: Edit screen (switch + drag within a group)

**Files:**
- Create: `app/insights-edit.tsx`
- Modify: `app/_layout.tsx` (GestureHandlerRootView + route)

- [ ] **Step 1: Wrap the app in `GestureHandlerRootView`** — in `app/_layout.tsx` add the import and replace the outer fragment `<>…</>` returned by `RootLayout` with:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler'
```

```tsx
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgApp }}>
      {/* …existing StatusBar, SplashGate, Stack unchanged… */}
    </GestureHandlerRootView>
```

and register the route next to `insight/[key]`:

```tsx
          <Stack.Screen name="insights-edit" />
```

- [ ] **Step 2: Create `app/insights-edit.tsx`**

```tsx
// Insights Edit (RA-29): switch a metric off to hide it, drag the handle to reorder inside its group.
// Saved on Done through the profile (writeChange + syncNow), so it is offline-safe and follows the user.
import { useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { GROUPS, type InsightsLayout, type Metric } from '../src/insights/metrics'
import { hasData, isHidden, moveTo, orderedMetrics, toggleHidden } from '../src/insights/summary'
import { useAuthStore } from '../src/store/useAuthStore'
import { useInsightsStore } from '../src/store/useInsightsStore'
import { useProfileStore } from '../src/store/useProfileStore'
import { buttons, colors, fonts } from '../src/utils/tokens'

const ROW_H = 48

export default function InsightsEdit() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore(s => s.session?.user.id)
  const saved = useProfileStore(s => s.profile?.insights_layout ?? null)
  const save = useProfileStore(s => s.save)
  const data = useInsightsStore(s => s.data)
  const [layout, setLayout] = useState<InsightsLayout | null>(saved)

  const done = () => {
    if (userId && layout) save(userId, { insights_layout: layout })
    router.back()
  }
  const all = orderedMetrics(layout)

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Edit insights</Text>
          <Text style={s.sub}>Drag to reorder. Switch off to hide.</Text>
        </View>
        <TouchableOpacity style={buttons.primary} onPress={done} activeOpacity={0.8}>
          <Text style={buttons.primaryText}>Done</Text>
        </TouchableOpacity>
      </View>
      {GROUPS.map(g => {
        const ms = all.filter(m => m.group === g.key)
        return (
          <View key={g.key}>
            <Text style={s.gtitle}>{g.title}</Text>
            <View style={s.list}>
              {ms.map((m, i) => (
                <Row
                  key={m.key} m={m} index={i} count={ms.length}
                  on={!isHidden(layout, m.key)} noData={!hasData(data[m.key])}
                  onToggle={() => setLayout(l => toggleHidden(l, m.key))}
                  onMove={to => setLayout(l => moveTo(l, m.key, to))}
                />
              ))}
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

function Row({ m, index, count, on, noData, onToggle, onMove }: {
  m: Metric; index: number; count: number; on: boolean; noData: boolean
  onToggle: () => void; onMove: (to: number) => void
}) {
  const y = useSharedValue(0)
  const pan = Gesture.Pan()
    .onChange(e => { y.value = e.translationY })
    .onEnd(e => {
      const to = Math.max(0, Math.min(count - 1, index + Math.round(e.translationY / ROW_H)))
      y.value = 0
      if (to !== index) runOnJS(onMove)(to)
    })
  const lifted = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    zIndex: y.value === 0 ? 0 : 10,
    backgroundColor: y.value === 0 ? 'transparent' : colors.bgElevated,
  }))
  return (
    <Animated.View style={[s.row, index > 0 && s.rowBorder, lifted]}>
      <GestureDetector gesture={pan}>
        <View style={s.grip} hitSlop={8}><Text style={s.gripText}>⋮⋮</Text></View>
      </GestureDetector>
      <Text style={[s.name, (!on || noData) && s.nameOff]} numberOfLines={1}>{m.label}</Text>
      {noData && <Text style={s.na}>No data in Health</Text>}
      <Switch
        value={on} onValueChange={onToggle}
        trackColor={{ true: colors.accent, false: colors.bgElevated }}
        thumbColor={on ? colors.ink : colors.textGhost}
        ios_backgroundColor={colors.bgElevated}
      />
    </Animated.View>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  head:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  title:   { fontFamily: fonts.body, fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  sub:     { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, marginTop: 4 },
  gtitle:  { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginHorizontal: 4, marginBottom: 8 },
  list:    { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 16, marginBottom: 18 },
  row:     { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  grip:    { paddingVertical: 8 },
  gripText:{ fontSize: 16, color: colors.textGhost, letterSpacing: -2 },
  name:    { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
  nameOff: { color: colors.textGhost },
  na:      { fontFamily: fonts.body, fontSize: 11, color: colors.textGhost },
})
```

Notes for the implementer:
- `list` has no `overflow: 'hidden'` on purpose, so a dragged row can be lifted over its neighbours.
- `runOnJS` is still exported by Reanimated 4.7 (`node_modules/react-native-reanimated/src/index.ts`). With Reanimated installed, gesture-handler runs the `Gesture.Pan()` callbacks as worklets.
- Rows can't be dragged into another group (the target index is clamped to the group).

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → no errors. `npx expo start`: in Expo Go open Edit by typing the route is not possible (no Edit button without data) — that's fine; the drag is tested on the device (Task 11).

- [ ] **Step 4: Checkpoint** — files: `app/insights-edit.tsx`, `app/_layout.tsx`. Bar commits.

---

### Task 11: Docs + final checks

**Files:**
- Modify: `architecture.md` (file tree: `src/insights/`, `src/healthkit/insights.ts`, `useInsightsStore`, `app/insight/[key].tsx`, `app/insights-edit.tsx`; data model: `profiles.insights_layout`; a short "Insights (RA-29)" section: live read, nothing stored, 91-day cache, hide/order in profile)
- Modify: `CLAUDE.md` (Stack: `src/insights/` pure + self-check `node src/insights/summary.check.ts`; Conventions: "Insights read Apple Health live — never store Health metrics; group colours from `groupColors`, lime reserved for insight cards")
- Modify: `FRONTEND_SPEC.md` (new "Insights tab" section: heading, group header, card, sparkline rules line vs bars, detail screen, edit screen, group colour table)
- Modify: `docs/HANDOFF.md` (RA-29 section: status, Bar-to-do list below)

- [ ] **Step 1: Update the four docs** as listed above. `architecture.md` line 98 (`insights.tsx ← placeholder…`) becomes `insights.tsx ← Apple Health trend cards (RA-29)`.

- [ ] **Step 2: Run every self-check and the type-check**

```
node src/insights/summary.check.ts
node src/utils/zones.check.ts
node src/utils/profile.check.ts
node src/utils/compare.check.ts
node src/healthkit/import.check.ts
node src/db/sync.check.ts
npx tsc --noEmit
```

Expected: every check prints its pass line, tsc prints nothing.

- [ ] **Step 3: Checkpoint** — files: the four docs. Bar commits.

---

### Task 12: Device test (Bar)

- [ ] **Step 1:** Run `supabase/migrations/2026-11-23-insights-layout.sql` in the Supabase SQL Editor **before** opening the new code.
- [ ] **Step 2:** `eas build --profile development --platform ios`, install, `npx expo start --dev-client`.
- [ ] **Step 3:** On launch the Health screen appears once; iOS lists only the new types → Allow all.
- [ ] **Step 4:** Insights shows real data. Compare with the Health app: resting HR, HRV, VO2max, weight (latest values), steps today, last night's sleep (total + stages).
- [ ] **Step 5:** A metric you don't have (e.g. body fat) is hidden on the tab and shows "No data in Health" in Edit.
- [ ] **Step 6:** Detail: each period switches, chart + Min/Avg/Max look right; HR notifications shows a list; Other workouts shows per-type totals.
- [ ] **Step 7:** Edit: hide one metric, drag one to a new place in its group, Done → tab updates; kill and reopen the app → kept; log out/in → kept (synced).
- [ ] **Step 8:** iOS Settings → Health → Data Access → Chronodrom → turn everything off → Insights shows "Allow Apple Health access…" (pull to refresh).
