# Smart Insights (RA-45) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Insights tab's Coming soon screen with a ranked feed of 13 calculated insights (running + Apple Health) worded by an on-device phrase engine, plus a shared detail screen for running insights.

**Architecture:** Pure layers, each with a node self-check: `src/facts/facts.ts` (numbers from runs) → `src/insights/rules.ts` (13 rules → Findings) → `src/insights/rank.ts` (links, hero, accents) → `src/insights/phrases.ts` (Findings → sentences, daily edition). A React hook `src/insights/useFeed.ts` glues them to the stores; two screens render the result. Nothing is stored; no Supabase / SQLite change.

**Tech Stack:** Expo / React Native, expo-router, Zustand, TypeScript run directly by Node (type stripping; imports inside pure files use `.ts` extensions, `import type` for types, no enums).

**Spec:** `docs/superpowers/specs/2026-11-28-smart-insights-design.md`

**Project rules for every task:**
- **Never run git.** Each task ends with a checkpoint listing the changed files for Bar; Bar commits.
- Pure files (`src/facts/*`, `src/insights/rules.ts`, `rank.ts`, `phrases.ts`) must not import React Native or stores, so `node <file>.check.ts` works.
- Units: `'km'` hardcoded (until RA-6).
- Subagents: Sonnet minimum.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/facts/facts.ts` | Create | `RunFacts` per run, window / bucket / median helpers, `z2Pct`, `series` |
| `src/facts/facts.check.ts` | Create | Self-check |
| `src/insights/rules.ts` | Create | `Finding`, `Inputs`, the 13 rules, `findings()`, `VALUE_KEYS` |
| `src/insights/rules.check.ts` | Create | Self-check for rules + rank |
| `src/insights/rank.ts` | Create | Linked insights, `buildFeed()` (hero, groups, accents) |
| `src/insights/phrases.ts` | Create | Phrase table + engine: `word()`, `wordAll()`, `BANNED` |
| `src/insights/phrases.check.ts` | Create | Self-check (slots, banned words, daily edition, openings) |
| `src/store/useInsightsStore.ts` | Modify | Also read 365 days of daily steps (`steps365`) |
| `src/insights/useFeed.ts` | Create | Hook: stores → facts → findings → feed → words; `insightHref()` |
| `app/(tabs)/insights.tsx` | Rewrite | The feed |
| `app/insight-run/[key].tsx` | Create | Running insight detail |
| `app/_layout.tsx` | Modify | Register `insight-run/[key]` |
| `CLAUDE.md`, `architecture.md`, `FRONTEND_SPEC.md`, `docs/HANDOFF.md` | Modify | Docs |

---

### Task 1: Facts layer

**Files:**
- Create: `src/facts/facts.ts`
- Test: `src/facts/facts.check.ts`

- [ ] **Step 1: Write the failing check**

`src/facts/facts.check.ts`:
```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/facts/facts.check.ts`
Expected: FAIL, `Cannot find module ... src/facts/facts.ts`

- [ ] **Step 3: Write the facts layer**

`src/facts/facts.ts`:
```ts
// Facts layer (RA-45): numbers from runs, no wording. Pure — `node src/facts/facts.check.ts` imports it.
// The insight rules use it now; RA-15 (auto run type) can reuse runFacts() as classifier features later.
import type { Run } from '../types/index.ts'
import { zoneTimes, type Starts, type ZoneSeconds } from '../utils/zones.ts'
import { addDays, bucketKey, type Point } from '../insights/summary.ts'

export interface RunFacts {
  id: string
  date: string               // 'YYYY-MM-DD'
  typeId: string | null
  km: number
  sec: number
  pace: number | null        // s/km
  avgHr: number | null
  maxHr: number | null
  zones: ZoneSeconds | null  // seconds per zone, from the HR histogram
  load: number | null        // Σ minutes in zone × zone number (Z1 = 1 … Z5 = 5)
}

export function runFacts(r: Run, s: Starts): RunFacts {
  const zones = zoneTimes(r.hrHist, s)
  return {
    id: r.id, date: r.date, typeId: r.typeId, km: r.distanceKm, sec: r.timeSec,
    pace: r.distanceKm > 0 ? r.timeSec / r.distanceKm : null,
    avgHr: r.avgHr, maxHr: r.maxHr, zones,
    load: zones ? zones.reduce((a, sec, i) => a + (sec / 60) * (i + 1), 0) : null,
  }
}

/** Average HR inside the user's Z2 (starts[0] ≤ hr < starts[1]). */
export const isZ2 = (f: RunFacts, s: Starts): boolean => f.avgHr != null && f.avgHr >= s[0] && f.avgHr < s[1]

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)
export const mean = (xs: readonly number[]): number | null => (xs.length ? sum(xs) / xs.length : null)
export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Items in the `days` days ending `offset` days before today (offset 0 = up to and including today). */
export function inDays<T extends { date: string }>(xs: readonly T[], today: string, offset: number, days: number): T[] {
  const to = addDays(today, -offset), from = addDays(today, -(offset + days - 1))
  return xs.filter(x => x.date >= from && x.date <= to)
}
export const oldest = (xs: readonly { date: string }[]): string => xs.reduce((m, x) => (x.date < m ? x.date : m), '9999-12-31')

/** Start dates of the last `count` buckets (week = Monday, month = 1st), ascending, ending with today's bucket. */
export function bucketsBack(today: string, b: 'week' | 'month', count: number): string[] {
  const out: string[] = []
  let k = bucketKey(today, b)
  for (let i = 0; i < count; i++) {
    out.unshift(k)
    k = b === 'week' ? addDays(k, -7) : bucketKey(addDays(k, -1), 'month')
  }
  return out
}

/** One point per bucket of bucketsBack(); fn gets that bucket's runs (maybe none); a null result drops the bucket. */
export function series(fs: readonly RunFacts[], today: string, b: 'week' | 'month', count: number,
  fn: (fs: RunFacts[]) => number | null): Point[] {
  const keys = bucketsBack(today, b, count)
  const by = new Map(keys.map(k => [k, [] as RunFacts[]]))
  for (const f of fs) if (f.date >= keys[0]) by.get(bucketKey(f.date, b))?.push(f)
  return keys.flatMap(k => { const v = fn(by.get(k)!); return v == null ? [] : [{ date: k, value: v }] })
}

/** % of HR-recorded running time in Z2. null when no run has zone time. */
export function z2Pct(fs: readonly RunFacts[]): number | null {
  let z2 = 0, all = 0
  for (const f of fs) if (f.zones) { z2 += f.zones[1]; all += sum(f.zones) }
  return all > 0 ? (z2 / all) * 100 : null
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node src/facts/facts.check.ts`
Expected: `facts.check: all passed`

- [ ] **Step 5: Checkpoint (no git)**

Tell Bar: new files `src/facts/facts.ts`, `src/facts/facts.check.ts`.

---

### Task 2: Insight rules

**Files:**
- Create: `src/insights/rules.ts`
- Test: `src/insights/rules.check.ts` (rank tests are added in Task 3)

- [ ] **Step 1: Write the failing check**

`src/insights/rules.check.ts`:
```ts
// Run: node src/insights/rules.check.ts
import type { RunFacts } from '../facts/facts.ts'
import type { Starts } from '../utils/zones.ts'
import { RULES, VALUE_KEYS, type Finding, type Inputs } from './rules.ts'
import { addDays, type MetricData, type Point } from './summary.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}
const T = '2026-11-28'                                       // a Saturday
const d = (n: number) => addDays(T, -n)
let seq = 0
const f = (date: string, o: Partial<RunFacts> = {}): RunFacts => ({
  id: `r${seq++}`, date, typeId: null, km: 8, sec: 2720, pace: 340, avgHr: 140, maxHr: 170,
  zones: [0, 2400, 0, 0, 0], load: 80, ...o,
})
const S: Starts = [130, 145, 160, 175]
const inp = (o: Partial<Inputs>): Inputs => ({ today: T, runs: [], starts: S, health: {}, ...o })
/** `count` daily points, the newest `endOffset` days before T, all = value. */
const pts = (count: number, endOffset: number, value: number): Point[] =>
  Array.from({ length: count }, (_, i) => ({ date: d(endOffset + count - 1 - i), value }))
const md = (points: Point[]): MetricData => ({ points })
const all: Finding[] = []
const keep = (x: Finding | null, msg: string): Finding => { if (!x) throw new Error(`${msg}: got null`); all.push(x); return x }

// ─── R1 efficiency ───────────────────────────────────────────────────────────
const effRuns = [
  f(d(65), { pace: 341 }), f(d(70), { pace: 341 }), f(d(75), { pace: 341 }),
  f(d(2), { pace: 329 }), f(d(5), { pace: 329 }), f(d(9), { pace: 329 }),
  f(d(3), { pace: 300, avgHr: 150 }),                       // not Z2 → ignored
  f(d(4), { pace: 300, km: 1.5 }),                          // under 2 km → ignored
]
const eff = keep(RULES.efficiency(inp({ runs: effRuns })), 'efficiency')
eq([eff.direction, eff.score.toFixed(2), eff.values.delta, eff.values.then], ['down', '2.40', '12 s/km', 'September'], 'efficiency: 12 s/km quicker')
eq(eff.runIds!.length, 3, 'efficiency: based on the 3 recent Z2 runs')
eq(RULES.efficiency(inp({ runs: effRuns.slice(1) })), null, 'efficiency: 2 old runs → hidden')

// ─── R2 Z2 share ─────────────────────────────────────────────────────────────
const z2Runs = [
  ...[35, 40, 45].map(n => f(d(n), { zones: [600, 600, 0, 0, 0] })),
  ...[1, 6, 10].map(n => f(d(n), { zones: [200, 800, 0, 0, 0] })),
]
const z2 = keep(RULES.z2Share(inp({ runs: z2Runs })), 'z2Share')
eq([z2.direction, z2.score.toFixed(2), z2.values.from, z2.values.to], ['up', '6.00', '50%', '80%'], 'z2Share: 50% → 80%')

// ─── R3 load ─────────────────────────────────────────────────────────────────
const loadRuns = [10, 17, 24, 34].map(n => f(d(n), { load: 100 }))
const ld = keep(RULES.load(inp({ runs: [...loadRuns, f(d(1), { load: 140 })] })), 'load')
eq([ld.direction, ld.values.pct, ld.values.avg], ['up', '40%', '100'], 'load: 40% above the 4-week average')
eq(RULES.load(inp({ runs: [...loadRuns.slice(0, 3), f(d(1), { load: 140 })] })), null, 'load: under 5 weeks of history → hidden')

// ─── R4 longest ──────────────────────────────────────────────────────────────
const lg = keep(RULES.longest(inp({ runs: [f(d(100), { km: 15 }), f(d(5), { km: 21.1 })] })), 'longest')
eq([lg.direction, lg.values.since, lg.values.km], ['record', 'you started tracking', '21.10 km'], 'longest: longest ever')
eq(RULES.longest(inp({ runs: [f(d(200), { km: 22 }), f(d(100), { km: 15 }), f(d(5), { km: 21.1 })] }))!.values.since,
  'May', 'longest: longest since May')
eq(RULES.longest(inp({ runs: [f(d(100), { km: 15 }), f(d(40), { km: 22 }), f(d(5), { km: 21.1 })] }))!.direction,
  'steady', 'longest: a longer run 35 days earlier → no record')
eq(RULES.longest(inp({ runs: [f(d(5))] })), null, 'longest: under 60 days of history → hidden')

// ─── R5 streak ───────────────────────────────────────────────────────────────
const weekRuns = Array.from({ length: 7 }, (_, w) => [0, 1, 2].map(k => f(addDays('2026-11-23', -7 * w + k)))).flat()
const st = keep(RULES.streak(inp({ runs: weekRuns })), 'streak')
eq([st.direction, st.values.weeks, st.values.target], ['streak', '7', '3 or more runs'], 'streak: 7 weeks of 3 runs')
const st2 = RULES.streak(inp({ runs: [f(d(27)), f(d(1))] }))!
eq([st2.direction, st2.values.perWeek], ['steady', '1 run'], 'streak: no streak → steady')

// ─── R6 highest HR ───────────────────────────────────────────────────────────
const hm = keep(RULES.hrMax(inp({ runs: [
  f('2026-07-20', { maxHr: 180 }), f('2026-08-10', { maxHr: 193 }), f('2026-09-10', { maxHr: 185 }), f('2026-11-10', { maxHr: 188 }),
] })), 'hrMax')
eq([hm.direction, hm.score.toFixed(2), hm.values.prev], ['down', '0.83', '193 bpm'], 'hrMax: down 5, score halved')

// ─── H1 resting HR ───────────────────────────────────────────────────────────
const rh = keep(RULES.restingHr(inp({ health: { restingHr: md([...pts(30, 7, 58), ...pts(7, 0, 65)]) } })), 'restingHr')
eq([rh.direction, rh.boost, rh.values.delta, rh.values.normal], ['up', true, '7 bpm', '58 bpm'], 'restingHr: +7 → boosted')
eq(RULES.restingHr(inp({ health: { restingHr: md([...pts(30, 7, 58), ...pts(4, 0, 65)]) } })), null, 'restingHr: 4 of 7 days → hidden')

// ─── H2 HRV ──────────────────────────────────────────────────────────────────
const hv = keep(RULES.hrv(inp({ health: { hrv: md([...pts(30, 7, 52), ...pts(7, 0, 42.64)]) } })), 'hrv')
eq([hv.direction, hv.boost, hv.values.pct], ['down', true, '18%'], 'hrv: −18% → boosted')

// ─── H3 sleep ────────────────────────────────────────────────────────────────
const sl = keep(RULES.sleep(inp({ health: { sleep: md([...pts(30, 7, 7), ...pts(7, 0, 7 - 50 / 60)]) } })), 'sleep')
eq([sl.direction, sl.score.toFixed(2), sl.values.delta, sl.values.now], ['down', '2.50', '50 min', '6:10'], 'sleep: 50 min less')

// ─── H4 steps ────────────────────────────────────────────────────────────────
const sp = keep(RULES.steps(inp({ health: { steps: md([...pts(30, 31, 8000), ...pts(30, 1, 8400)]) } })), 'steps')
eq([sp.direction, sp.values.now], ['steady', '8,400'], 'steps: +5% → steady')
const up9 = md([...pts(30, 31, 7000), ...pts(30, 1, 9000)])
eq(RULES.steps(inp({ health: { steps: up9 }, steps365: [...pts(330, 31, 7000), ...pts(30, 1, 9000)] }))!.values.since,
  'November last year', 'steps: highest in a year')
const aug = RULES.steps(inp({ health: { steps: up9 }, steps365: [...pts(30, 91, 9500), ...pts(30, 61, 7000), ...pts(30, 31, 7000), ...pts(30, 1, 9000)] }))!
eq([aug.direction, aug.values.since], ['record', 'August'], 'steps: most active since August')
const low = RULES.steps(inp({ health: { steps: md([...pts(30, 31, 9000), ...pts(30, 1, 7000)]) }, steps365: [...pts(330, 31, 9000), ...pts(30, 1, 7000)] }))!
eq(low.direction, 'recordLow', 'steps: quietest in a year')

// ─── H5 VO2max ───────────────────────────────────────────────────────────────
const vo = keep(RULES.vo2max(inp({ health: { vo2max: md([{ date: d(85), value: 48.1 }, { date: d(10), value: 49.6 }]) } })), 'vo2max')
eq([vo.direction, vo.values.delta, vo.values.since], ['up', '1.5', 'September'], 'vo2max: +1.5 since September')
eq(RULES.vo2max(inp({ health: { vo2max: md([{ date: d(40), value: 48.1 }, { date: d(10), value: 49.6 }]) } })), null, 'vo2max: readings 30 days apart → hidden')

// ─── H6 steps on running days ────────────────────────────────────────────────
const runDays = [2, 5, 8, 11].map(d)
const srd = keep(RULES.stepsRunDays(inp({
  runs: runDays.map(x => f(x)),
  health: { steps: md(pts(30, 1, 8000).map(p => (runDays.includes(p.date) ? { ...p, value: 14000 } : p))) },
})), 'stepsRunDays')
eq([srd.direction, srd.values.delta], ['up', '6,000'], 'stepsRunDays: 6,000 more on run days')

// ─── H7 sleep before slow runs ───────────────────────────────────────────────
const slowRuns = Array.from({ length: 12 }, (_, i) => f(d(2 * i + 1), { typeId: 'easy', pace: i % 2 ? 350 : 330 }))
const nights = md(slowRuns.map(r => ({ date: r.date, value: r.pace === 350 ? 6.25 : 7 })).reverse())
const sbs = keep(RULES.sleepBeforeSlow(inp({ runs: slowRuns, health: { sleep: nights } })), 'sleepBeforeSlow')
eq([sbs.direction, sbs.score.toFixed(2), sbs.values.delta], ['down', '1.50', '45 min'], 'sleepBeforeSlow: 45 min less before slower runs')
eq(RULES.sleepBeforeSlow(inp({ runs: slowRuns.slice(0, 9), health: { sleep: nights } })), null, 'sleepBeforeSlow: 9 runs → hidden')

// ─── values match VALUE_KEYS (the phrase table relies on them) ───────────────
for (const x of all) eq(Object.keys(x.values).sort(), [...VALUE_KEYS[x.key]].sort(), `${x.key}: value keys`)
eq(new Set(all.map(x => x.key)).size, 13, 'every rule was exercised')

console.log('rules.check: all passed')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/insights/rules.check.ts`
Expected: FAIL, `Cannot find module ... src/insights/rules.ts`

- [ ] **Step 3: Write the rules**

`src/insights/rules.ts`:
```ts
// Insight rules (RA-45): facts + Apple Health data → Findings (numbers and formatted values, no sentences).
// Pure — `node src/insights/rules.check.ts`. Thresholds: docs/superpowers/specs/2026-11-28-smart-insights-design.md → Rules.
import { bucketsBack, inDays, isZ2, mean, median, oldest, series, sum, z2Pct, type RunFacts } from '../facts/facts.ts'
import { fmtDate, fmtDistance, fmtHMM, fmtPace } from '../utils/format.ts'
import type { Starts } from '../utils/zones.ts'
import { addDays, fmtNum, inWindow, type MetricData, type Point } from './summary.ts'

export type InsightKey =
  | 'efficiency' | 'z2Share' | 'load' | 'longest' | 'streak' | 'hrMax'
  | 'restingHr' | 'hrv' | 'sleep' | 'steps' | 'vo2max' | 'stepsRunDays' | 'sleepBeforeSlow'
  | 'restingHrSleep' | 'loadHrv'                            // merged cards (rank.ts)
export type BaseKey = Exclude<InsightKey, 'restingHrSleep' | 'loadHrv'>
export type Direction = 'up' | 'down' | 'steady' | 'record' | 'recordLow' | 'streak'

export interface Finding {
  key: InsightKey
  side: 'running' | 'health'
  direction: Direction
  score: number                    // |change| ÷ steady threshold; < 1 = steady; records / streaks = 2
  boost: boolean                   // resting HR up ≥ 5 bpm / HRV down ≥ 15 %: ranked above everything
  values: Record<string, string>   // formatted slot values for phrases.ts; `period` = eyebrow period
  evidence: string                 // "58 → 64 bpm"
  series: Point[]                  // sparkline + detail chart
  seriesKind: 'line' | 'bars'
  runIds?: string[]                // running insights: the runs it is based on
  method?: string                  // running insights: "How this is worked out"
}

export interface Inputs {
  today: string                    // 'YYYY-MM-DD'
  runs: RunFacts[]
  starts: Starts
  health: Record<string, MetricData>   // useInsightsStore.data (91 days, daily)
  steps365?: Point[] | null            // daily steps, 365 days (H4 record)
}

/** The value names each rule fills. phrases.ts placeholders must come from these. */
export const VALUE_KEYS: Record<InsightKey, readonly string[]> = {
  efficiency: ['period', 'from', 'to', 'delta', 'then'],
  z2Share: ['period', 'from', 'to', 'delta'],
  load: ['period', 'now', 'avg', 'pct'],
  longest: ['period', 'km', 'day', 'since'],
  streak: ['period', 'weeks', 'target', 'perWeek'],
  hrMax: ['period', 'now', 'prev', 'delta', 'month'],
  restingHr: ['period', 'now', 'normal', 'delta'],
  hrv: ['period', 'now', 'normal', 'pct'],
  sleep: ['period', 'now', 'normal', 'delta'],
  steps: ['period', 'now', 'from', 'pct', 'since'],
  vo2max: ['period', 'from', 'to', 'delta', 'since'],
  stepsRunDays: ['period', 'run', 'rest', 'delta'],
  sleepBeforeSlow: ['period', 'slow', 'other', 'delta'],
  restingHrSleep: [],   // filled below: period + a.<restingHr> + b.<sleep>
  loadHrv: [],          // period + a.<load> + b.<hrv>
}
const merged = (a: BaseKey, b: BaseKey) => ['period', ...VALUE_KEYS[a].map(k => `a.${k}`), ...VALUE_KEYS[b].map(k => `b.${k}`)]
VALUE_KEYS.restingHrSleep = merged('restingHr', 'sleep')
VALUE_KEYS.loadHrv = merged('load', 'hrv')

// ─── helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthName = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1]
/** "March", or "March 2025" when it isn't this year. */
const sinceMonth = (iso: string, today: string) => monthName(iso) + (iso.slice(0, 4) === today.slice(0, 4) ? '' : ` ${iso.slice(0, 4)}`)
const fmtMin = (m: number) => { const r = Math.round(m); return r < 60 ? `${r} min` : `${Math.floor(r / 60)} h ${r % 60} min` }
const pct = (now: number, base: number) => ((now - base) / base) * 100

function change(delta: number, steady: number): { direction: Direction; score: number } {
  const score = Math.abs(delta) / steady
  return { direction: score < 1 ? 'steady' : delta > 0 ? 'up' : 'down', score }
}

/** Mean of the last 7 days vs "your normal" (the 30 days before them). Needs 5 of 7 and 20 of 30 days. */
function vsNormal(d: MetricData | undefined, today: string) {
  if (!d) return null
  const last = inWindow(d.points, today, 0, 7), norm = inWindow(d.points, today, 7, 30)
  if (last.length < 5 || norm.length < 20) return null
  return { now: mean(last.map(p => p.value))!, normal: mean(norm.map(p => p.value))!, spark: inWindow(d.points, today, 0, 37) }
}

// ─── running ─────────────────────────────────────────────────────────────────

function efficiency({ today, runs, starts }: Inputs): Finding | null {
  const ok = runs.filter(f => f.km >= 2 && f.pace != null && isZ2(f, starts))
  const now = inDays(ok, today, 0, 30), then = inDays(ok, today, 60, 30)
  if (now.length < 3 || then.length < 3) return null
  const a = median(then.map(f => f.pace!))!, b = median(now.map(f => f.pace!))!
  return {
    key: 'efficiency', side: 'running', ...change(b - a, 5), boost: false,
    values: { period: '3 MONTHS', from: fmtPace(a, 'km'), to: fmtPace(b, 'km'), delta: `${Math.round(Math.abs(b - a))} s/km`, then: monthName(addDays(today, -75)) },
    evidence: `${fmtPace(a, 'km')} → ${fmtPace(b, 'km')}`,
    series: series(ok, today, 'month', 6, fs => median(fs.map(f => f.pace!))), seriesKind: 'line',
    runIds: now.map(f => f.id),
    method: `Median pace of runs of 2 km or more whose average HR was in your Z2 (${starts[0]}–${starts[1] - 1} bpm), last 30 days vs 60–90 days ago.`,
  }
}

function z2Share({ today, runs }: Inputs): Finding | null {
  const hr = runs.filter(f => f.zones)
  const now = inDays(hr, today, 0, 30), prev = inDays(hr, today, 30, 30)
  if (now.length < 3 || prev.length < 3) return null
  const a = z2Pct(prev)!, b = z2Pct(now)!
  return {
    key: 'z2Share', side: 'running', ...change(b - a, 5), boost: false,
    values: { period: '30 DAYS', from: `${Math.round(a)}%`, to: `${Math.round(b)}%`, delta: `${Math.abs(Math.round(b) - Math.round(a))} points` },
    evidence: `${Math.round(a)}% → ${Math.round(b)}%`,
    series: series(hr, today, 'week', 12, z2Pct), seriesKind: 'line',
    runIds: now.map(f => f.id),
    method: 'Share of your running time with heart rate in Z2, last 30 days vs the 30 days before.',
  }
}

function load({ today, runs }: Inputs): Finding | null {
  const hr = runs.filter(f => f.load != null)
  if (!hr.length || oldest(hr) > addDays(today, -34)) return null
  const last = inDays(hr, today, 0, 7), before = inDays(hr, today, 7, 28)
  const now = sum(last.map(f => f.load!)), avg = sum(before.map(f => f.load!)) / 4
  if (avg === 0) return null
  const p = pct(now, avg)
  return {
    key: 'load', side: 'running', ...change(p, 15), boost: false,
    values: { period: '7 DAYS', now: fmtNum(now, 0), avg: fmtNum(avg, 0), pct: `${Math.round(Math.abs(p))}%` },
    evidence: `${fmtNum(avg, 0)} → ${fmtNum(now, 0)}`,
    series: series(hr, today, 'week', 12, fs => sum(fs.map(f => f.load!))), seriesKind: 'bars',
    runIds: last.map(f => f.id),
    method: 'Minutes in each heart-rate zone × the zone number (Z1 = 1 … Z5 = 5), last 7 days vs the weekly average of the 4 weeks before.',
  }
}

function longest({ today, runs }: Inputs): Finding | null {
  const recent = inDays(runs, today, 0, 30)
  if (!recent.length || oldest(runs) > addDays(today, -59)) return null
  const best = recent.reduce((a, b) => (b.km > a.km ? b : a))
  const prev = runs.filter(f => f.date < best.date && f.km >= best.km)
    .reduce<RunFacts | null>((a, b) => (!a || b.date > a.date ? b : a), null)
  const record = !prev || prev.date < addDays(best.date, -60)
  return {
    key: 'longest', side: 'running', direction: record ? 'record' : 'steady', score: record ? 2 : 0.5, boost: false,
    values: { period: '30 DAYS', km: fmtDistance(best.km, 'km'), day: fmtDate(best.date), since: prev ? sinceMonth(prev.date, today) : 'you started tracking' },
    evidence: `${fmtDistance(best.km, 'km')} · ${fmtDate(best.date)}`,
    series: series(runs, today, 'month', 6, fs => (fs.length ? Math.max(...fs.map(f => f.km)) : null)), seriesKind: 'bars',
    runIds: [best.id],
    method: 'Your longest run in the last 30 days, compared with every earlier run.',
  }
}

function streak({ today, runs }: Inputs): Finding | null {
  if (!runs.length || oldest(runs) > addDays(today, -27)) return null
  const counts = series(runs, today, 'week', 53, fs => fs.length)       // last = this week
  const target = Math.max(1, Math.round(median(counts.slice(-9, -1).map(p => p.value)) ?? 1))
  let n = counts.at(-1)!.value >= target ? 1 : 0                        // this week counts once it gets there
  for (let i = counts.length - 2; i >= 0 && counts[i].value >= target; i--) n++
  const isStreak = n >= 3
  const from = isStreak ? counts[counts.length - n].date : counts[counts.length - 8].date
  return {
    key: 'streak', side: 'running', direction: isStreak ? 'streak' : 'steady', score: isStreak ? 2 : 0.5, boost: false,
    values: {
      period: isStreak ? `${n} WEEKS` : '8 WEEKS', weeks: String(n),
      target: target === 1 ? 'at least one run' : `${target} or more runs`,
      perWeek: target === 1 ? '1 run' : `${target} runs`,
    },
    evidence: counts.slice(-8).map(p => p.value).join(' · '),
    series: counts.slice(-12), seriesKind: 'bars',
    runIds: runs.filter(f => f.date >= from).map(f => f.id),
    method: `Weeks in a row (Monday to Sunday) with at least your usual ${target === 1 ? 'one run' : `${target} runs`}; usual = the median of the last 8 full weeks. This week counts once it gets there.`,
  }
}

function hrMax({ today, runs }: Inputs): Finding | null {
  const hr = runs.filter(f => f.maxHr != null)
  const months = bucketsBack(today, 'month', 4)                       // 3 before + this month
  if (!hr.length || oldest(hr) > months[0]) return null
  const ser = series(hr, today, 'month', 6, fs => (fs.length ? Math.round(Math.max(...fs.map(f => f.maxHr!))) : null))
  const now = ser.find(p => p.date === months[3])?.value
  const before = ser.filter(p => p.date >= months[0] && p.date < months[3]).map(p => p.value)
  if (now == null || !before.length) return null
  const prev = Math.max(...before), c = change(now - prev, 3)
  return {
    key: 'hrMax', side: 'running', direction: c.direction, score: c.score * 0.5, boost: false,   // weak signal: ranked low
    values: { period: 'THIS MONTH', now: `${now} bpm`, prev: `${prev} bpm`, delta: `${Math.abs(now - prev)} bpm`, month: monthName(today) },
    evidence: `${prev} → ${now} bpm`,
    series: ser, seriesKind: 'bars',
    runIds: hr.filter(f => f.date >= months[3] && Math.round(f.maxHr!) === now).map(f => f.id),
    method: 'The highest heart rate of any run this calendar month vs the highest of the 3 months before.',
  }
}

// ─── health ──────────────────────────────────────────────────────────────────

function restingHr({ today, health }: Inputs): Finding | null {
  const v = vsNormal(health.restingHr, today)
  if (!v) return null
  const d = v.now - v.normal
  return {
    key: 'restingHr', side: 'health', ...change(d, 2), boost: d >= 5,
    values: { period: '7 DAYS', now: `${Math.round(v.now)} bpm`, normal: `${Math.round(v.normal)} bpm`, delta: `${Math.round(Math.abs(d))} bpm` },
    evidence: `${Math.round(v.normal)} → ${Math.round(v.now)} bpm`, series: v.spark, seriesKind: 'line',
  }
}

function hrv({ today, health }: Inputs): Finding | null {
  const v = vsNormal(health.hrv, today)
  if (!v) return null
  const p = pct(v.now, v.normal)
  return {
    key: 'hrv', side: 'health', ...change(p, 10), boost: p <= -15,
    values: { period: '7 DAYS', now: `${Math.round(v.now)} ms`, normal: `${Math.round(v.normal)} ms`, pct: `${Math.round(Math.abs(p))}%` },
    evidence: `${Math.round(v.normal)} → ${Math.round(v.now)} ms`, series: v.spark, seriesKind: 'line',
  }
}

function sleep({ today, health }: Inputs): Finding | null {
  const v = vsNormal(health.sleep, today)                              // points = hours asleep per night
  if (!v) return null
  const d = (v.now - v.normal) * 60
  return {
    key: 'sleep', side: 'health', ...change(d, 20), boost: false,
    values: { period: '7 DAYS', now: fmtHMM(v.now * 3600), normal: fmtHMM(v.normal * 3600), delta: fmtMin(Math.abs(d)) },
    evidence: `${fmtHMM(v.normal * 3600)} → ${fmtHMM(v.now * 3600)} h`, series: v.spark, seriesKind: 'bars',
  }
}

/** Highest / lowest 30-day mean of the year: compared with up to 11 earlier 30-day blocks (≥ 20 days each). */
function stepsRecord(pts: Point[], today: string, cur: number): { high: boolean; since: string } | null {
  const blocks: { end: string; mean: number }[] = []
  for (let i = 1; i < 12; i++) {
    const w = inWindow(pts, today, 1 + i * 30, 30)
    if (w.length >= 20) blocks.push({ end: addDays(today, -(1 + i * 30)), mean: mean(w.map(p => p.value))! })
  }
  if (blocks.length < 3) return null
  for (const high of [true, false]) {
    const k = blocks.findIndex(b => (high ? cur <= b.mean : cur >= b.mean))   // most recent block at least as high (low)
    if (k === -1) return { high, since: `${monthName(today)} last year` }
    if (k >= 2) return { high, since: sinceMonth(blocks[k].end, today) }
  }
  return null
}

function steps({ today, health, steps365 }: Inputs): Finding | null {
  const p = health.steps?.points ?? []
  const now = inWindow(p, today, 1, 30), prev = inWindow(p, today, 31, 30)   // ends yesterday: today is still counting
  if (now.length < 20 || prev.length < 20) return null
  const a = mean(prev.map(x => x.value))!, b = mean(now.map(x => x.value))!, c = pct(b, a)
  const rec = steps365 ? stepsRecord(steps365, today, b) : null
  return {
    key: 'steps', side: 'health', boost: false,
    ...(rec ? { direction: rec.high ? 'record' : 'recordLow', score: 2 } as const : change(c, 10)),
    values: { period: '30 DAYS', now: fmtNum(b, 0), from: fmtNum(a, 0), pct: `${Math.round(Math.abs(c))}%`, since: rec?.since ?? '' },
    evidence: `${fmtNum(a, 0)} → ${fmtNum(b, 0)} a day`, series: now, seriesKind: 'bars',
  }
}

function vo2max({ today, health }: Inputs): Finding | null {
  const p = inWindow(health.vo2max?.points ?? [], today, 0, 90)
  if (p.length < 2) return null
  const first = p[0], last = p.at(-1)!
  if (last.date < addDays(first.date, 60)) return null
  const d = last.value - first.value
  return {
    key: 'vo2max', side: 'health', ...change(d, 0.5), boost: false,
    values: { period: '3 MONTHS', from: fmtNum(first.value, 1), to: fmtNum(last.value, 1), delta: fmtNum(Math.abs(d), 1), since: sinceMonth(first.date, today) },
    evidence: `${fmtNum(first.value, 1)} → ${fmtNum(last.value, 1)} ml/kg·min`, series: p, seriesKind: 'line',
  }
}

function stepsRunDays({ today, runs, health }: Inputs): Finding | null {
  const p = inWindow(health.steps?.points ?? [], today, 1, 30)
  const days = new Set(inDays(runs, today, 1, 30).map(f => f.date))
  const on = p.filter(x => days.has(x.date)).map(x => x.value), off = p.filter(x => !days.has(x.date)).map(x => x.value)
  if (on.length < 4 || off.length < 4) return null
  const a = mean(on)!, b = mean(off)!, d = a - b
  return {
    key: 'stepsRunDays', side: 'health', ...change(d, 1000), boost: false,
    values: { period: '30 DAYS', run: fmtNum(a, 0), rest: fmtNum(b, 0), delta: fmtNum(Math.abs(d), 0) },
    evidence: `${fmtNum(b, 0)} → ${fmtNum(a, 0)} steps`, series: p, seriesKind: 'bars',
  }
}

function sleepBeforeSlow({ today, runs, health }: Inputs): Finding | null {
  const night = new Map((health.sleep?.points ?? []).map(p => [p.date, p.value]))   // a night has the date it ends
  const rs = inDays(runs, today, 0, 91).filter(f => f.pace != null)
  const byType = new Map<string, number[]>()
  for (const f of rs) byType.set(f.typeId ?? '', [...(byType.get(f.typeId ?? '') ?? []), f.pace!])
  const usual = new Map([...byType].map(([k, v]) => [k, median(v)!]))
  const withSleep = rs.filter(f => night.has(f.date))
  if (withSleep.length < 10) return null
  const slow = withSleep.filter(f => f.pace! > usual.get(f.typeId ?? '')!)
  const other = withSleep.filter(f => !slow.includes(f))
  if (slow.length < 3 || other.length < 3) return null
  const a = mean(slow.map(f => night.get(f.date)!))!, b = mean(other.map(f => night.get(f.date)!))!, d = (a - b) * 60
  return {
    key: 'sleepBeforeSlow', side: 'health', ...change(d, 30), boost: false,
    values: { period: '3 MONTHS', slow: fmtHMM(a * 3600), other: fmtHMM(b * 3600), delta: fmtMin(Math.abs(d)) },
    evidence: `${fmtHMM(b * 3600)} → ${fmtHMM(a * 3600)} h`,
    series: inWindow(health.sleep?.points ?? [], today, 0, 30), seriesKind: 'bars',
  }
}

export const RULES: Record<BaseKey, (i: Inputs) => Finding | null> = {
  efficiency, z2Share, load, longest, streak, hrMax,
  restingHr, hrv, sleep, steps, vo2max, stepsRunDays, sleepBeforeSlow,
}

/** Every rule with enough data. */
export const findings = (i: Inputs): Finding[] =>
  Object.values(RULES).map(r => r(i)).filter((x): x is Finding => x !== null)
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node src/insights/rules.check.ts`
Expected: `rules.check: all passed`

If a fixture assertion fails, fix the rule, not the expected value — the expected values come from the spec thresholds.

- [ ] **Step 5: Checkpoint (no git)**

Tell Bar: new files `src/insights/rules.ts`, `src/insights/rules.check.ts`.

---

### Task 3: Ranking, links, hero and accents

**Files:**
- Create: `src/insights/rank.ts`
- Modify: `src/insights/rules.check.ts` (append rank tests before the final `console.log`)

- [ ] **Step 1: Append the failing tests**

In `src/insights/rules.check.ts`, add `import { buildFeed, link } from './rank.ts'` and `import type { Direction, InsightKey } from './rules.ts'` to the imports, then insert before `console.log('rules.check: all passed')`:
```ts
// ─── rank.ts: links, hero, accents ───────────────────────────────────────────
const F = (key: InsightKey, side: 'running' | 'health', score: number, boost = false, direction: Direction = 'up'): Finding => ({
  key, side, direction, score, boost, values: { period: '7 DAYS', delta: key }, evidence: key, series: [], seriesKind: 'line',
})
const linked = link([F('restingHr', 'health', 3.5, true, 'up'), F('sleep', 'health', 2.5, false, 'down'), F('steps', 'health', 1)])
eq(linked.map(x => x.key).sort(), ['restingHrSleep', 'steps'], 'resting HR up + sleep down → one merged card')
const m = linked.find(x => x.key === 'restingHrSleep')!
eq([m.score.toFixed(2), m.boost, m.values['a.delta'], m.values['b.delta'], m.side], ['3.50', true, 'restingHr', 'sleep', 'health'], 'merged card keeps the higher score + boost')
eq(link([F('restingHr', 'health', 3.5, true, 'up'), F('sleep', 'health', 0.5, false, 'steady')]).length, 2, 'steady sleep → no link')
eq(link([F('load', 'running', 2), F('hrv', 'health', 2, false, 'down')]).map(x => [x.key, x.side]), [['loadHrv', 'running']], 'load up + HRV down → running card')

const feed = buildFeed([F('efficiency', 'running', 2.4), F('z2Share', 'running', 0.5), F('steps', 'health', 1.2), F('hrv', 'health', 3, true, 'down')])
eq([feed.hero?.key, feed.running.map(x => x.key), feed.health.map(x => x.key), feed.accent],
  ['hrv', ['efficiency', 'z2Share'], ['steps'], ['efficiency', 'steps']], 'boosted hero; groups by score; first of each group outlined')
const quiet = buildFeed([F('load', 'running', 3), F('streak', 'running', 0.5), F('vo2max', 'health', 0.4)])
eq([quiet.hero?.key, quiet.accent], ['load', []], 'steady group leaders get no outline')
eq(buildFeed([]).hero, null, 'no findings → no hero')
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/insights/rules.check.ts`
Expected: FAIL, `Cannot find module ... src/insights/rank.ts`

- [ ] **Step 3: Write rank.ts**

`src/insights/rank.ts`:
```ts
// Insight ranking (RA-45): linked cards, hero, groups, lime outlines. Pure — tested in rules.check.ts.
import type { BaseKey, Direction, Finding, InsightKey } from './rules.ts'

const prefix = (p: string, v: Record<string, string>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [`${p}.${k}`, x]))

/** Two findings that moved together become one card; the first one gives side, series, runs and method. */
const LINKS: { a: BaseKey; da: Direction; b: BaseKey; db: Direction; key: InsightKey; side: Finding['side'] }[] = [
  { a: 'restingHr', da: 'up', b: 'sleep', db: 'down', key: 'restingHrSleep', side: 'health' },
  { a: 'load', da: 'up', b: 'hrv', db: 'down', key: 'loadHrv', side: 'running' },
]

export function link(fs: Finding[]): Finding[] {
  let out = [...fs]
  for (const l of LINKS) {
    const a = out.find(f => f.key === l.a), b = out.find(f => f.key === l.b)
    if (!a || !b || a.direction !== l.da || b.direction !== l.db) continue
    out = [...out.filter(f => f !== a && f !== b), {
      ...a, key: l.key, side: l.side, direction: 'up', score: Math.max(a.score, b.score), boost: a.boost || b.boost,
      values: { period: '7 DAYS', ...prefix('a', a.values), ...prefix('b', b.values) },
      evidence: `${a.evidence} · ${b.evidence}`,
    }]
  }
  return out
}

export interface Feed {
  hero: Finding | null      // full lime card
  running: Finding[]        // after the hero, by score
  health: Finding[]
  accent: InsightKey[]      // lime outline: the first card of each group, when notable (score ≥ 1)
}

const byRank = (a: Finding, b: Finding) => Number(b.boost) - Number(a.boost) || b.score - a.score

export function buildFeed(fs: Finding[]): Feed {
  const [hero = null, ...rest] = link(fs).sort(byRank)
  const running = rest.filter(f => f.side === 'running'), health = rest.filter(f => f.side === 'health')
  const accent = [running[0], health[0]].filter((f): f is Finding => !!f && f.score >= 1).map(f => f.key)
  return { hero, running, health, accent }
}

/** Feed order = wording order (openings are kept unique in this order). */
export const feedOrder = (f: Feed): Finding[] => [...(f.hero ? [f.hero] : []), ...f.running, ...f.health]
```

- [ ] **Step 4: Run to verify it passes**

Run: `node src/insights/rules.check.ts`
Expected: `rules.check: all passed`

- [ ] **Step 5: Checkpoint (no git)**

Tell Bar: new `src/insights/rank.ts`; changed `src/insights/rules.check.ts`.

---

### Task 4: Phrase engine (daily edition)

**Files:**
- Create: `src/insights/phrases.ts`
- Test: `src/insights/phrases.check.ts`

- [ ] **Step 1: Write the failing check**

`src/insights/phrases.check.ts`:
```ts
// Run: node src/insights/phrases.check.ts
import { BANNED, PHRASES, candidates, opening, word, wordAll, type Entry } from './phrases.ts'
import { VALUE_KEYS, type Direction, type Finding, type InsightKey } from './rules.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}
/** The directions each insight's rule can return (rules.ts). */
const DIRS: Record<InsightKey, Direction[]> = {
  efficiency: ['up', 'down', 'steady'], z2Share: ['up', 'down', 'steady'], load: ['up', 'down', 'steady'],
  longest: ['record', 'steady'], streak: ['streak', 'steady'], hrMax: ['up', 'down', 'steady'],
  restingHr: ['up', 'down', 'steady'], hrv: ['up', 'down', 'steady'], sleep: ['up', 'down', 'steady'],
  steps: ['up', 'down', 'steady', 'record', 'recordLow'], vo2max: ['up', 'down', 'steady'],
  stepsRunDays: ['up', 'down', 'steady'], sleepBeforeSlow: ['up', 'down', 'steady'],
  restingHrSleep: ['up'], loadHrv: ['up'],
}
const sample = (key: InsightKey, direction: Direction): Finding => ({
  key, side: 'health', direction, score: 1, boost: false,
  values: Object.fromEntries(VALUE_KEYS[key].map(k => [k, k === 'period' ? '7 DAYS' : 'X'])),
  evidence: '', series: [], seriesKind: 'line',
})
const strings = (e: Entry): string[] => [
  e.label, e.guideline ?? '', ...(e.subject ?? []),
  ...[e.change, e.time, e.whole, e.meaning].flatMap(t => Object.values(t ?? {}).flat()),
]

// ─── coverage: every insight × direction has headlines, every slot fills ─────
eq(Object.keys(PHRASES).sort(), Object.keys(DIRS).sort(), 'one phrase entry per insight')
for (const [key, dirs] of Object.entries(DIRS) as [InsightKey, Direction[]][]) {
  for (const dir of dirs) {
    const f = sample(key, dir), opts = candidates(PHRASES[key], dir, 'seed')
    if (opts.length < 3) throw new Error(`${key}/${dir}: only ${opts.length} headlines`)
    for (const t of opts) {
      const h = word({ ...f }, '2026-11-28', new Set(), t).headline
      if (/[{}]/.test(h)) throw new Error(`${key}/${dir}: unfilled slot in "${h}"`)
      if (h[0] !== h[0].toUpperCase()) throw new Error(`${key}/${dir}: not capitalised "${h}"`)
    }
    for (const m of PHRASES[key].meaning?.[dir] ?? []) {
      const filled = m.replace(/\{([\w.]+)\}/g, (s, k) => (VALUE_KEYS[key].includes(k) ? 'X' : s))
      if (/[{}]/.test(filled)) throw new Error(`${key}/${dir}: unfilled slot in meaning "${m}"`)
    }
  }
}

// ─── voice: banned words, whole words, any case ──────────────────────────────
const banned = new RegExp(`\\b(${BANNED.join('|')})\\b`, 'i')
for (const [key, e] of Object.entries(PHRASES)) for (const s of strings(e)) {
  if (banned.test(s)) throw new Error(`${key}: banned word in "${s}"`)
}

// ─── guidelines only on Z2 share and sleep ───────────────────────────────────
eq(Object.entries(PHRASES).filter(([, e]) => e.guideline).map(([k]) => k).sort(), ['sleep', 'z2Share'], 'guideline only on R2 + H3')

// ─── daily edition ───────────────────────────────────────────────────────────
const eff = sample('efficiency', 'down')
eq(word(eff, '2026-11-28'), word(eff, '2026-11-28'), 'same date → same text')
const week = new Set(Array.from({ length: 10 }, (_, i) => word(eff, `2026-12-${String(i + 1).padStart(2, '0')}`).headline))
if (week.size < 4) throw new Error(`only ${week.size} different headlines over 10 days`)
eq(word(eff, '2026-11-28').eyebrow, 'EFFICIENCY · 7 DAYS', 'eyebrow = label · period')

// ─── one feed: no two cards open the same way ────────────────────────────────
const feed = (Object.keys(DIRS) as InsightKey[]).map(k => sample(k, DIRS[k][0]))
for (const date of ['2026-11-28', '2026-11-29', '2026-11-30']) {
  const ws = [...wordAll(feed, date).values()].map(w => opening(w.headline))
  eq(new Set(ws).size, ws.length, `${date}: openings unique`)
}

console.log('phrases.check: all passed')
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/insights/phrases.check.ts`
Expected: FAIL, `Cannot find module ... src/insights/phrases.ts`

- [ ] **Step 3: Write the phrase engine and table**

`src/insights/phrases.ts`:
```ts
// Insight wording (RA-45, option A): Findings → sentences from a fixed phrase table. No AI, no network.
// Daily edition: the phrasing choice is seeded by date + insight, so the text is stable all day and changes tomorrow.
// Voice: fact + what it usually means; never a verdict, never advice; health stays careful (nothing medical).
// These lists are the only words that can appear. Option B (an LLM) would replace word() and keep BANNED as its output check.
// Pure — `node src/insights/phrases.check.ts`.
import type { Direction, Finding, InsightKey } from './rules.ts'

type ByDir = Partial<Record<Direction, string[]>>
export interface Entry {
  label: string        // eyebrow: `${label} · ${values.period}`
  subject?: string[]   // headline = subject + change + time …
  change?: ByDir
  time?: ByDir
  whole?: ByDir        // … or a whole sentence (number-first variants)
  meaning?: ByDir      // what it usually means (left out where it adds nothing)
  guideline?: string   // fixed text about people in general; source in a comment
}
export interface Worded { eyebrow: string; headline: string; meaning?: string; guideline?: string }

/** Whole words never allowed in insight text (also the output check for a future LLM). */
export const BANNED = ['should', 'need', 'needs', 'must', 'good', 'bad', 'great', 'poor', 'risk', 'warning', 'danger',
  'injury', 'illness', 'sick', 'healthy', 'unhealthy', 'recommend', 'try'] as const

const WEEK = ['this week', 'over the last 7 days', 'in the past week']
const WEEK_STEADY = ['this week', 'over the last 7 days', 'again this week']
const LOAD_TIME = ['your 4-week average', 'the 4 weeks before', 'your recent weekly average']
const same = (xs: string[]): ByDir => ({ up: xs, down: xs, steady: xs })

export const PHRASES: Record<InsightKey, Entry> = {
  // ─── running ───────────────────────────────────────────────────────────────
  efficiency: {   // down = pace number down = quicker
    label: 'EFFICIENCY',
    subject: ['Your easy pace', 'Pace on your Z2 runs', 'Your pace at Z2 heart rate', 'Your Z2 pace'],
    change: {
      down: ['is {delta} quicker', 'runs {delta} quicker', 'is {delta} faster', 'comes in {delta} quicker'],
      up: ['is {delta} slower', 'runs {delta} slower', 'comes in {delta} slower'],
      steady: ['has held at {to}', 'has stayed around {to}', 'is steady at {to}'],
    },
    time: {
      down: ['than 3 months ago', 'than in {then}', 'than it was in {then}'],
      up: ['than 3 months ago', 'than in {then}', 'than it was in {then}'],
      steady: ['since {then}', 'over the last 3 months', 'for 3 months now'],
    },
    whole: {
      down: ['{delta} quicker at the same heart rate than in {then}', 'Same heart rate, {delta} quicker than in {then}', 'Your Z2 runs are {delta} quicker than 3 months ago'],
      up: ['{delta} slower at the same heart rate than in {then}', 'Same heart rate, {delta} slower than in {then}'],
      steady: ['Same heart rate, same pace as in {then}: {to}', 'Z2 pace steady at {to} for 3 months'],
    },
    meaning: {
      down: ['This usually means your aerobic base is growing.', 'Running quicker at the same effort is a common sign of aerobic fitness building up.'],
      up: ['Heat, hills, tiredness or a break in training often show up this way.', 'Pace at the same heart rate often drifts in hot weather or after time off.'],
    },
  },
  z2Share: {
    label: 'Z2 SHARE',
    subject: ['Z2 running', 'Your time in Z2', 'Running in Z2'],
    change: {
      up: ['made up {to} of your running', 'rose to {to}', 'climbed to {to}', 'reached {to}'],
      down: ['made up {to} of your running', 'fell to {to}', 'dropped to {to}', 'slipped to {to}'],
      steady: ['made up {to} of your running', 'held at {to}', 'stayed near {to}'],
    },
    time: {
      up: ['in the last 30 days, up from {from}', 'over the past month, up from {from}', 'this month, from {from} before'],
      down: ['in the last 30 days, down from {from}', 'over the past month, down from {from}', 'this month, from {from} before'],
      steady: ['in the last 30 days, like the month before', 'over the past month', 'again this month'],
    },
    whole: {
      up: ['{to} of your running was in Z2, up from {from}', 'Z2 is up {delta}, to {to} of your running'],
      down: ['{to} of your running was in Z2, down from {from}', 'Z2 is down {delta}, to {to} of your running'],
      steady: ['{to} of your running was in Z2, about the same as the month before'],
    },
    meaning: {
      up: ['More easy running usually means more aerobic base work.', 'A bigger share of easy running is typical of base-building blocks.'],
      down: ['More of your running was at higher heart rates.', 'Harder sessions, races or heat often lower the Z2 share.'],
    },
    // Polarised / "80/20" endurance training convention (Seiler); a training convention, not a health guideline.
    guideline: 'Many endurance training plans keep about 80% of running easy.',
  },
  load: {
    label: 'LOAD',
    subject: ["This week's training load", 'Your load for the last 7 days', 'Your 7-day load'],
    change: {
      up: ['is {pct} above', 'runs {pct} over', 'sits {pct} higher than'],
      down: ['is {pct} below', 'runs {pct} under', 'sits {pct} lower than'],
      steady: ['is in line with', 'matches', 'is close to'],
    },
    time: same(LOAD_TIME),
    whole: {
      up: ['{pct} more load this week than your 4-week average', 'A heavier week: load {pct} above your 4-week average'],
      down: ['{pct} less load this week than your 4-week average', 'A lighter week: load {pct} below your 4-week average'],
      steady: ['A typical week: load close to your 4-week average', 'Load right at your 4-week average this week'],
    },
    meaning: {
      up: ['Load is running time weighted by heart-rate zone, so longer or harder weeks both raise it.', 'Heavier weeks like this are common when mileage or intensity steps up.'],
      down: ['Lighter weeks often come with rest, travel or an easier block.'],
    },
  },
  longest: {
    label: 'LONGEST RUN',
    subject: ['Your longest run in 30 days', 'Your longest recent run', 'The longest run of your month'],
    change: { record: ['was {km}', 'came to {km}', 'reached {km}'], steady: ['was {km}', 'came to {km}'] },
    time: {
      record: ['on {day}, your longest since {since}', ', the longest since {since}', 'on {day}: your longest since {since}'],
      steady: ['', ', on {day}'],
    },
    whole: {
      record: ['{km} on {day}, your longest since {since}', 'Longest run since {since}: {km} on {day}', 'A new longest run since {since}: {km}'],
      steady: ['{km} on {day} was your longest run this month', 'Longest run this month: {km}'],
    },
    meaning: { record: ['A new longest run often marks a step up in endurance.', 'Longer runs are a common way endurance builds over a season.'] },
  },
  streak: {
    label: 'CONSISTENCY',
    whole: {
      streak: ['{target} every week for {weeks} weeks', '{weeks} weeks in a row with {target}', '{weeks} straight weeks of {target}',
        "You've hit {target} a week for {weeks} weeks", 'Week {weeks} in a row with {target}'],
      steady: ['Your usual week: {perWeek}', 'About {perWeek} a week over the last 8 weeks', 'Your running week has been about {perWeek} lately'],
    },
    meaning: { streak: ['Regular weeks are how fitness usually builds.', 'Consistency over weeks tends to matter more than any single run.'] },
  },
  hrMax: {
    label: 'HIGHEST HR',
    subject: ['Your highest heart rate this month', 'Your top heart rate in {month}', "This month's highest heart rate"],
    change: same(['is {now}', 'reached {now}', 'hit {now}']),
    time: {
      up: [', up from {prev} in the 3 months before', ', above the {prev} of the 3 months before', ', {delta} over the 3 months before'],
      down: [', down from {prev} in the 3 months before', ', below the {prev} of the 3 months before', ', {delta} under the 3 months before'],
      steady: [', close to the {prev} of the 3 months before', ', about the same as the 3 months before'],
    },
    meaning: {
      up: ['The highest heart rate in a month mostly reflects your hardest effort that month.'],
      down: ['Months without races or hard sessions usually show a lower top heart rate.'],
    },
  },
  // ─── health ────────────────────────────────────────────────────────────────
  restingHr: {
    label: 'RESTING HR',
    subject: ['Your resting HR', 'Resting heart rate', 'Your heart rate at rest'],
    change: {
      up: ['is {delta} above your normal', 'is up {delta}', 'averaged {now}, up from {normal}'],
      down: ['is {delta} below your normal', 'is down {delta}', 'averaged {now}, down from {normal}'],
      steady: ['is right at your normal of {normal}', 'has held near {normal}', 'is close to your usual {normal}'],
    },
    time: { up: WEEK, down: WEEK, steady: WEEK_STEADY },
    whole: {
      up: ['{now} resting HR this week, against a normal of {normal}', 'Resting HR up {delta} on your normal this week'],
      down: ['{now} resting HR this week, below your normal of {normal}', 'Resting HR down {delta} on your normal this week'],
      steady: ['Resting HR steady at {now} this week'],
    },
    meaning: {
      up: ['Resting HR often rises with short sleep, stress, heat or a hard training block.', 'A higher resting HR for a few days is common after hard weeks or short nights.'],
      down: ['Resting HR often drifts lower as aerobic fitness builds.', 'A lower resting HR is common after rest days and steady training.'],
    },
  },
  hrv: {
    label: 'HRV',
    subject: ['Your HRV', 'Heart rate variability', 'Your heart rate variability'],
    change: {
      up: ['is {pct} above your normal', 'is up {pct}', 'averaged {now}, up from {normal}'],
      down: ['is {pct} below your normal', 'is down {pct}', 'averaged {now}, down from {normal}'],
      steady: ['is close to your normal of {normal}', 'has held near {normal}', 'is right at your usual {normal}'],
    },
    time: { up: WEEK, down: WEEK, steady: WEEK_STEADY },
    whole: {
      up: ['HRV {pct} above your normal this week'],
      down: ['HRV {pct} below your normal this week', 'HRV averaged {now} this week, under your normal of {normal}'],
      steady: ['HRV steady at {now} this week'],
    },
    meaning: {
      up: ['Higher HRV than usual is often seen after rest and easy days.'],
      down: ['HRV often dips after hard sessions, short sleep, stress or alcohol.', 'A lower HRV for a few days is common after hard training or short nights.'],
      steady: ['HRV moves a lot from day to day; the weekly average is the steadier view.'],
    },
  },
  sleep: {
    label: 'SLEEP',
    subject: ['Your sleep', 'Sleep', 'Your time asleep'],
    change: {
      down: ['averaged {now} h a night, {delta} less than usual', 'came to {now} h a night, {delta} under your normal', 'was {delta} shorter than usual, at {now} h a night'],
      up: ['averaged {now} h a night, {delta} more than usual', 'came to {now} h a night, {delta} over your normal', 'was {delta} longer than usual, at {now} h a night'],
      steady: ['averaged {now} h a night, close to your normal', 'held near your usual {normal} h', 'came to {now} h a night, as usual'],
    },
    time: same(['this week', 'over the last 7 nights', 'in the past week']),
    whole: {
      down: ['{delta} less sleep a night than usual this week', 'You slept {now} h a night this week, {delta} less than usual'],
      up: ['{delta} more sleep a night than usual this week', 'You slept {now} h a night this week, {delta} more than usual'],
      steady: ['You slept about {now} h a night this week, close to your normal'],
    },
    meaning: {
      down: ['Shorter nights often show up in resting HR and HRV a day or two later.'],
      up: ['Longer nights are common in easier weeks or after a hard block.'],
    },
    // CDC / American Academy of Sleep Medicine: adults 18–60, 7 or more hours per night.
    guideline: 'Adults are generally advised to get 7 or more hours of sleep a night.',
  },
  steps: {
    label: 'STEPS',
    subject: ['Your daily steps', 'Your average steps', 'Your step count'],
    change: {
      up: ['averaged {now}, up {pct}', 'rose {pct} to {now} a day', 'climbed to {now} a day'],
      down: ['averaged {now}, down {pct}', 'fell {pct} to {now} a day', 'dropped to {now} a day'],
      steady: ['averaged {now}', 'held near {now} a day', 'stayed around {now} a day'],
    },
    time: {
      up: ['this month', 'over the last 30 days', 'in the past month'],
      down: ['this month', 'over the last 30 days', 'in the past month'],
      steady: ['this month, like the month before', 'over the last 30 days', 'again this month'],
    },
    whole: {
      record: ['Your most active month since {since}: {now} steps a day', '{now} steps a day, your highest 30 days since {since}', 'The most steps since {since}: {now} a day'],
      recordLow: ['Your quietest month since {since}: {now} steps a day', '{now} steps a day, your lowest 30 days since {since}', 'The fewest steps since {since}: {now} a day'],
    },
    meaning: {
      up: ['Steps include your runs, so running weeks raise this too.'],
      down: ['Fewer steps often come with less running, travel or desk-heavy weeks.'],
      record: ['Steps include your runs, so running weeks raise this too.'],
    },
  },
  vo2max: {
    label: 'VO2MAX',
    subject: ['Your VO2max', 'Cardio fitness (VO2max)', 'Your VO2max estimate'],
    change: {
      up: ['rose from {from} to {to}', 'went up {delta} to {to}', 'climbed to {to}'],
      down: ['fell from {from} to {to}', 'went down {delta} to {to}', 'dropped to {to}'],
      steady: ['has held at {to}', 'has stayed near {to}', 'has been steady at {to}'],
    },
    time: same(['over 3 months', 'in the last 3 months', 'since {since}']),
    meaning: {
      up: ['Apple Watch estimates VO2max from outdoor walks and runs; a rise usually means cardio fitness is building.'],
      down: ['VO2max estimates move with training volume, heat and how many outdoor runs Apple Watch saw.'],
    },
  },
  stepsRunDays: {
    label: 'STEPS ON RUNNING DAYS',
    whole: {
      up: ['You take {delta} more steps on days you run', '{delta} more steps on running days than on other days', 'Running days: {run} steps. Other days: {rest}'],
      down: ['You take {delta} fewer steps on days you run', '{delta} fewer steps on running days than on other days', 'Running days: {run} steps. Other days: {rest}'],
      steady: ['About the same steps on running and other days: {run} vs {rest}', 'Running days and other days come out close: {run} vs {rest} steps', 'Similar step counts with or without a run: {run} vs {rest}'],
    },
    meaning: {
      up: ['Most of the difference is the run itself.', 'The run itself accounts for most of the gap.'],
      down: ['Other days are more active than running days, outside the run.'],
    },
  },
  sleepBeforeSlow: {   // a link in the data, never a cause
    label: 'SLEEP BEFORE SLOW RUNS',
    whole: {
      down: ['On nights before slower runs you slept {delta} less', 'Slower runs came after nights {delta} shorter than usual', 'Nights before your slower runs: {slow} h. Before the others: {other} h'],
      up: ['On nights before slower runs you slept {delta} more', 'Slower runs came after nights {delta} longer than usual', 'Nights before your slower runs: {slow} h. Before the others: {other} h'],
      steady: ['You sleep about the same before slow and quick runs', 'Sleep before slower runs: {slow} h, close to {other} h before the others', 'Slow or quick, the night before looks the same: about {other} h'],
    },
    meaning: { down: ['This shows a link in your data, not a cause.'], up: ['This shows a link in your data, not a cause.'] },
  },
  // ─── merged cards (rank.ts) ────────────────────────────────────────────────
  restingHrSleep: {
    label: 'RESTING HR + SLEEP',
    whole: {
      up: ['Resting HR is up {a.delta} on a week you slept {b.delta} less a night', 'A week of {b.now} h nights, and resting HR {a.delta} above your normal',
        'Shorter nights and a higher resting HR this week: {b.delta} less sleep, {a.delta} more'],
    },
    meaning: { up: ['The two often move together after short nights.', 'Sleep and resting HR tend to move together.'] },
  },
  loadHrv: {
    label: 'LOAD + HRV',
    whole: {
      up: ['Load is {a.pct} above your average on a week HRV is {b.pct} below normal', 'A heavier week ({a.pct} more load) and HRV {b.pct} under your normal',
        'More load, lower HRV: {a.pct} up, {b.pct} down this week'],
    },
    meaning: { up: ['HRV often dips during harder training weeks.'] },
  },
}

// ─── engine ──────────────────────────────────────────────────────────────────

/** djb2: a small stable string hash (same input → same number on every device). */
export function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0
  return h
}
const fill = (t: string, v: Record<string, string>) => t.replace(/\{([\w.]+)\}/g, (m, k: string) => v[k] ?? m)
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/ ([,:])/g, '$1').trim()
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const opening = (h: string) => h.toLowerCase().split(' ').slice(0, 2).join(' ')

/** Every headline template for one insight + direction, shuffled by seed: 2 slot sentences, then 1 whole sentence, repeating. */
export function candidates(e: Entry, d: Direction, seed: string): string[] {
  const mix = (xs: string[]) => [...xs].sort((a, b) => hash(seed + a) - hash(seed + b))
  const combos = mix((e.subject ?? []).flatMap(s => (e.change?.[d] ?? []).flatMap(c => (e.time?.[d] ?? ['']).map(t => `${s} ${c} ${t}`))))
  const whole = mix(e.whole?.[d] ?? [])
  const out: string[] = []
  while (combos.length || whole.length) { out.push(...combos.splice(0, 2)); if (whole.length) out.push(whole.shift()!) }
  return out
}

/** Word one finding for `date`. `used` = openings already taken today (wordAll); `force` = a template (tests). */
export function word(f: Finding, date: string, used: Set<string> = new Set(), force?: string): Worded {
  const e = PHRASES[f.key], seed = date + f.key
  const opts = (force ? [force] : candidates(e, f.direction, seed)).map(t => cap(tidy(fill(t, f.values))))
  const headline = opts.find(h => !used.has(opening(h))) ?? opts[0] ?? ''
  used.add(opening(headline))
  const ms = e.meaning?.[f.direction] ?? []
  return {
    eyebrow: `${e.label} · ${f.values.period ?? ''}`,
    headline,
    meaning: ms.length ? fill(ms[hash(seed + 'm') % ms.length], f.values) : undefined,
    guideline: e.guideline,
  }
}

/** Word a whole feed in order, so no two cards open the same way. */
export function wordAll(fs: Finding[], date: string): Map<InsightKey, Worded> {
  const used = new Set<string>(), out = new Map<InsightKey, Worded>()
  for (const f of fs) out.set(f.key, word(f, date, used))
  return out
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node src/insights/phrases.check.ts`
Expected: `phrases.check: all passed`

If "openings unique" fails, add a phrasing with a different first two words to the insight that collided (more phrases is fine — Bar asked for more). Never remove the check.

- [ ] **Step 5: Read a sample feed (sanity check of the sentences)**

Run (prints every headline once per direction, for reading):
```bash
node -e "import('./src/insights/phrases.ts').then(({PHRASES,candidates})=>{for(const [k,e] of Object.entries(PHRASES))for(const d of Object.keys({...e.change,...e.whole}))console.log(k,d,'→',candidates(e,d,'x').slice(0,3).join(' | '))})"
```
Expected: readable sentences with `{slots}`. Fix any phrase that reads badly. Then re-run Step 4.

- [ ] **Step 6: Checkpoint (no git)**

Tell Bar: new `src/insights/phrases.ts`, `src/insights/phrases.check.ts`.

---

### Task 5: Store (365 days of steps) + useFeed hook

**Files:**
- Modify: `src/store/useInsightsStore.ts`
- Create: `src/insights/useFeed.ts`

- [ ] **Step 1: Add `steps365` to the Insights store**

Replace the whole of `src/store/useInsightsStore.ts` with:
```ts
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
```

- [ ] **Step 2: Create the hook**

`src/insights/useFeed.ts`:
```ts
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Checkpoint (no git)**

Tell Bar: changed `src/store/useInsightsStore.ts`; new `src/insights/useFeed.ts`.

---

### Task 6: Insights tab feed

**Files:**
- Rewrite: `app/(tabs)/insights.tsx`

- [ ] **Step 1: Replace the Coming soon screen**

Replace the whole of `app/(tabs)/insights.tsx` with:
```tsx
// Insights tab (RA-45): one feed of calculated insights, worded on the phone (daily edition).
// Layout A: one lime hero card; the first card of the running and the health group gets a lime outline when notable.
// Spec: docs/superpowers/specs/2026-11-28-smart-insights-design.md
import { useCallback, useEffect } from 'react'
import { ActivityIndicator, AppState, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Sparkline } from '../../src/components/Chart'
import type { Worded } from '../../src/insights/phrases'
import type { Finding } from '../../src/insights/rules'
import { hasData } from '../../src/insights/summary'
import { insightHref, useFeed } from '../../src/insights/useFeed'
import { useInsightsStore } from '../../src/store/useInsightsStore'
import { colors, fonts } from '../../src/utils/tokens'

type Variant = 'hero' | 'accent' | 'plain'

export default function Insights() {
  const router = useRouter()
  const { feed, words } = useFeed()
  const data = useInsightsStore(s => s.data)
  const loading = useInsightsStore(s => s.loading)
  const loadedAt = useInsightsStore(s => s.loadedAt)
  const load = useInsightsStore(s => s.load)

  useFocusEffect(useCallback(() => { load() }, [load]))
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') load() })
    return () => sub.remove()
  }, [load])

  const noHealth = loadedAt > 0 && !Object.values(data).some(hasData)
  const variant = (f: Finding): Variant => (feed.accent.includes(f.key) ? 'accent' : 'plain')
  const card = (f: Finding, v: Variant) => (
    <InsightCard key={f.key} f={f} w={words.get(f.key)!} variant={v} onPress={() => router.push(insightHref(f))} />
  )

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading && loadedAt > 0} onRefresh={() => load(true)} tintColor={colors.textSecondary} />}
      >
        <Text style={s.title}>Insights</Text>
        <Text style={s.sub}>What your data says this week</Text>

        {!feed.hero && loadedAt > 0 && (
          <Text style={s.empty}>Insights appear once you have a few weeks of runs and Apple Health data.</Text>
        )}
        {feed.hero && card(feed.hero, 'hero')}
        {feed.running.length > 0 && <View style={s.group}>{feed.running.map(f => card(f, variant(f)))}</View>}
        {feed.health.length > 0 && <View style={s.group}>{feed.health.map(f => card(f, variant(f)))}</View>}

        {noHealth && (
          <TouchableOpacity style={s.allow} onPress={() => Linking.openSettings()} activeOpacity={0.7}>
            <Text style={s.allowText}>Allow Apple Health to see health insights ›</Text>
          </TouchableOpacity>
        )}
        {loadedAt === 0 && <ActivityIndicator color={colors.textSecondary} style={{ marginVertical: 30 }} />}
      </ScrollView>
    </SafeAreaView>
  )
}

function InsightCard({ f, w, variant, onPress }: { f: Finding; w: Worded; variant: Variant; onPress: () => void }) {
  const hero = variant === 'hero', accent = variant === 'accent'
  const strong = hero ? colors.ink : accent ? colors.lime : colors.textFaint   // eyebrow, evidence, sparkline
  return (
    <TouchableOpacity style={[s.card, hero && s.hero, accent && s.accent]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.eyebrow, { color: strong }]}>{w.eyebrow}</Text>
      <Text style={[s.headline, hero && s.heroHeadline, { color: hero ? colors.ink : colors.textPrimary }]}>{w.headline}</Text>
      {!!w.meaning && <Text style={[s.meaning, { color: hero ? colors.ink : colors.textSecondary }]}>{w.meaning}</Text>}
      {!!w.guideline && <Text style={[s.guideline, { color: hero ? colors.ink : colors.textFaint }]}>{w.guideline}</Text>}
      <View style={s.foot}>
        <Text style={[s.evidence, { color: strong }]} numberOfLines={1}>{f.evidence}</Text>
        <View style={s.spark}>
          {f.series.length > 1 && <Sparkline points={f.series} kind={f.seriesKind} color={strong} height={24} />}
        </View>
        <Text style={[s.chev, { color: strong }]}>›</Text>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bgApp },
  content:  { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 },
  title:    { fontFamily: fonts.body, fontSize: 26, lineHeight: 30, fontWeight: '700', color: colors.textPrimary },
  sub:      { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, marginTop: 4, marginBottom: 18 },
  empty:    { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginVertical: 60, paddingHorizontal: 20 },
  group:    { marginTop: 14 },
  card:     { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 16,
              paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, marginBottom: 10 },
  hero:     { backgroundColor: colors.lime, borderColor: colors.lime, paddingTop: 16, paddingBottom: 14 },
  accent:   { borderColor: colors.lime },
  eyebrow:  { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 },
  headline: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, fontWeight: '600', marginTop: 5 },
  heroHeadline: { fontSize: 18, lineHeight: 24 },
  meaning:  { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 5 },
  guideline:{ fontFamily: fonts.body, fontSize: 11, lineHeight: 15, marginTop: 4, fontStyle: 'italic' },
  foot:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  evidence: { fontFamily: fonts.mono, fontSize: 12 },
  spark:    { flex: 1 },
  chev:     { fontSize: 18, lineHeight: 20 },
  allow:    { paddingVertical: 14, alignItems: 'center' },
  allowText:{ fontFamily: fonts.body, fontSize: 13, color: colors.lime },
})
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`router.push` takes a string here, like `health.tsx`; typed routes are off.)

- [ ] **Step 3: Checkpoint (no git)**

Tell Bar: rewrote `app/(tabs)/insights.tsx`.

---

### Task 7: Running insight screen

**Files:**
- Create: `app/insight-run/[key].tsx`
- Modify: `app/_layout.tsx` (after line 47, `<Stack.Screen name="insight/[key]" />`)

- [ ] **Step 1: Register the route**

In `app/_layout.tsx`, below `<Stack.Screen name="insight/[key]" />` add:
```tsx
          <Stack.Screen name="insight-run/[key]" />
```

- [ ] **Step 2: Create the screen**

`app/insight-run/[key].tsx`:
```tsx
// Running insight detail (RA-45): the series behind one running insight, how it is worked out, and the runs it uses.
// Shared by every running card (and the load + HRV card). Text = the same daily wording as the card.
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TrendChart } from '../../src/components/Chart'
import { RunCard } from '../../src/components/RunCard'
import type { InsightKey } from '../../src/insights/rules'
import { fmtNum } from '../../src/insights/summary'
import { useFeed } from '../../src/insights/useFeed'
import { useRunStore } from '../../src/store/useRunStore'
import { fmtDistance, fmtPace } from '../../src/utils/format'
import { colors, fonts } from '../../src/utils/tokens'

const FORMAT: Partial<Record<InsightKey, (v: number) => string>> = {
  efficiency: v => fmtPace(v, 'km'),
  z2Share: v => `${Math.round(v)}%`,
  longest: v => fmtDistance(v, 'km'),
}

export default function RunInsight() {
  const { key } = useLocalSearchParams<{ key: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { feed, words } = useFeed()
  const runs = useRunStore(s => s.runs)
  const f = [feed.hero, ...feed.running].find(x => x?.key === key && x.side === 'running')
  if (!f) return <Redirect href="/insights" />
  const w = words.get(f.key)!
  const ids = new Set(f.runIds ?? [])
  const based = runs.filter(r => ids.has(r.id))   // store order = newest first

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      <View style={s.back}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.iconText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.eyebrow}>{w.eyebrow}</Text>
      </View>

      <Text style={s.headline}>{w.headline}</Text>
      {!!w.meaning && <Text style={s.meaning}>{w.meaning}</Text>}
      {!!w.guideline && <Text style={s.guideline}>{w.guideline}</Text>}

      {f.series.length > 0 && (
        <View style={s.chartBox}>
          <TrendChart points={f.series} kind={f.seriesKind} color={colors.accent} format={FORMAT[f.key] ?? (v => fmtNum(v, 0))} />
        </View>
      )}
      {!!f.method && <Text style={s.method}>How this is worked out: {f.method}</Text>}

      {based.length > 0 && <Text style={s.section}>RUNS IT'S BASED ON</Text>}
      {based.map(r => <RunCard key={r.id} run={r} unit="km" />)}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bgApp },
  content:  { paddingHorizontal: 18, paddingBottom: 40 },
  back:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  iconBtn:  { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, lineHeight: 24, color: colors.textPrimary },
  eyebrow:  { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: colors.textFaint },
  headline: { fontFamily: fonts.body, fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.textPrimary },
  meaning:  { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 6 },
  guideline:{ fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 4, fontStyle: 'italic' },
  chartBox: { backgroundColor: colors.bgChart, borderRadius: 16, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8, marginTop: 18 },
  method:   { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 12 },
  section:  { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, color: colors.textDim, marginTop: 22, marginBottom: 8 },
})
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `<Redirect href="/insights" />` is rejected, use `href="/(tabs)/insights"`.

- [ ] **Step 4: Checkpoint (no git)**

Tell Bar: new `app/insight-run/[key].tsx`; changed `app/_layout.tsx`.

---

### Task 8: Docs

**Files:**
- Modify: `CLAUDE.md`, `architecture.md`, `FRONTEND_SPEC.md`, `docs/HANDOFF.md`, `docs/superpowers/specs/2026-11-27-tab-layout-design.md` (no change needed — it already points RA-45 forward)

- [ ] **Step 1: CLAUDE.md**

Replace the Insights stack line (line 22) with:
```markdown
- **Insights** — `src/insights/` is pure: RA-29 metric catalogue + summary maths (`node src/insights/summary.check.ts`), RA-45 rules → rank → phrases (`node src/insights/rules.check.ts`, `node src/insights/phrases.check.ts`); `src/facts/` = numbers from runs (`node src/facts/facts.check.ts`, RA-15 reuses it). The HealthKit reader is `src/healthkit/insights.ts`, in-memory cache in `useInsightsStore`; the feed hook is `src/insights/useFeed.ts`. Insight text only comes from the phrase table in `phrases.ts` (no AI yet; `BANNED` words are checked).
```
In the Conventions line about Insights (line 60), replace "lime marks the most important card(s) on a screen (any tab); lavender is the second highlight." with:
```markdown
lime fill marks the single most important card on a screen (any tab); a lime outline marks the next level (Insights group leaders); lavender is the second highlight.
```

- [ ] **Step 2: architecture.md**

- In the file tree: change `insights.tsx ← Coming soon (RA-45 Smart Insights later)` to `insights.tsx ← RA-45 Smart Insights feed`; add `insight-run/[key].tsx ← RA-45 running insight detail` under `insight/[key].tsx`; extend the `insights/` line with `RA-45: rules.ts, rank.ts, phrases.ts, useFeed.ts`; add `facts/ ← RA-45 pure: runFacts + windows/buckets (node src/facts/facts.check.ts); RA-15 features`.
- Add a section after the Insights (RA-29) section:
```markdown
## Smart Insights (RA-45)

- **Flow:** runs (SQLite) + Health (`useInsightsStore`, 91 days + 365 days of steps) → `src/facts/` → `src/insights/rules.ts` (13 rules → Findings, `null` = too little data) → `rank.ts` (2 linked cards, hero, groups, lime outlines) → `phrases.ts` (daily edition) → `useFeed()`. Computed in memory; nothing stored.
- **Wording (option A):** slot sentences + whole sentences from a fixed table, shuffled by hash(date + insight); openings unique per feed; guideline lines fixed (R2, H3). `BANNED` whole words are rejected by the check.
- **Later (B):** an LLM (paid cloud or free on-device, e.g. llama.cpp) may replace `word()` only, fed the same Findings, guidelines in its prompt, output checked against `BANNED`, falling back to option A.
- **RA-15:** a small on-device classifier on `runFacts()` features, not an LLM.
```

- [ ] **Step 3: FRONTEND_SPEC.md**

Add a section "Insights (RA-45)" after the Health/Insights (RA-29) section:
```markdown
## Insights (RA-45)

- **Tab:** title "Insights" (26/700), subtitle "What your data says this week" (13, `textDim`). Feed: hero → running group → health group, groups 14 px apart, cards 10 px apart, no headers.
- **Card:** `bgSurface`, 1 px `borderDefault`, radius 16, padding 14 / 12 / 10. Eyebrow 10/600 letter-spacing 0.6 · headline 15/600 · meaning 12 `textSecondary` · guideline 11 italic `textFaint` · foot row: evidence (JetBrains Mono 12) + sparkline (24 high, flex) + ›.
- **Hero (one per screen):** `lime` fill and border, all text `ink`, headline 18/24, padding top 16.
- **Accent (first card of each group, only when notable):** `lime` border, eyebrow + evidence + sparkline in `lime`.
- **Empty:** "Insights appear once you have a few weeks of runs and Apple Health data." **No Health:** lime link row "Allow Apple Health to see health insights ›" → iOS Settings.
- **Running insight (`insight-run/[key]`):** back button + eyebrow, headline 20/700, meaning, guideline, `TrendChart` (lavender) in a `bgChart` box, "How this is worked out: …" (12 `textFaint`), "RUNS IT'S BASED ON" + `RunCard` rows.
```
Also update the lime rule wherever FRONTEND_SPEC states it (search "lime"): lime fill = the single most important card; lime outline = next level.

- [ ] **Step 4: HANDOFF.md**

Replace the "Current task: RA-45" paragraph with the implementation state: tasks done, checks passing, deviations from this plan, and "next: Bar's device test (Task 9)".

- [ ] **Step 5: Run every self-check and tsc**

Run:
```bash
node src/facts/facts.check.ts && node src/insights/rules.check.ts && node src/insights/phrases.check.ts && node src/insights/summary.check.ts && npx tsc --noEmit
```
Expected: four "all passed" lines, no tsc errors.

- [ ] **Step 6: Checkpoint (no git)**

Tell Bar: changed `CLAUDE.md`, `architecture.md`, `FRONTEND_SPEC.md`, `docs/HANDOFF.md`.

---

### Task 9: Jira draft + Bar's device test

- [ ] **Step 1: Draft the RA-45 rewrite and show it to Bar** (do not edit Jira before he approves). Changes vs today's ticket: one feed instead of two sections; voice B (fact + what it usually means, guideline only where widely accepted) replaces "facts only"; layout A (one lime hero + lime outlines) replaces "lime cards only"; weekly overview dropped (Dashboard has it); the 13 insights by name; wording option A now, B later; RA-15 note.

- [ ] **Step 2: Bar's device test** (JS only, no new dev build: `npx expo start --dev-client`)
1. Insights tab: cards appear; exactly one lime card; at most two lime-outlined cards; running cards before health cards.
2. Read every card: no odd grammar, numbers match the Runs / Health tabs roughly.
3. Tap a running card → the detail screen shows the same headline, a chart, "How this is worked out", the runs; tap a run → Run detail.
4. Tap a health card → its Health detail screen.
5. Pull to refresh → no errors.
6. Next day: the same insights read differently; same day: reopening keeps the text.
7. (Optional) iOS Settings → Health → Chronodrom → turn data off → running cards only + the Allow row.

- [ ] **Step 3: Checkpoint**

All files ready for Bar to commit (he splits commits: facts + rules, phrases, store + screens, docs).
