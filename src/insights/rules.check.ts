// Run: node src/insights/rules.check.ts
import type { RunFacts } from '../facts/facts.ts'
import type { Starts } from '../utils/zones.ts'
import { buildFeed, link } from './rank.ts'
import { RULES, VALUE_KEYS, type Direction, type Finding, type InsightKey, type Inputs } from './rules.ts'
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

eq(RULES.z2Share(inp({ runs: [...z2Runs, ...[2, 3, 4].map(n => f(d(n), { zones: [0, 0, 0, 0, 0] }))] }))!.values.to, '80%', 'z2Share: empty histograms are ignored')

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
eq(RULES.streak(inp({ runs: [f('2026-06-10'), f(d(27)), f(d(1))] })), null, 'streak: usual week is 0 runs → hidden')
const mon = (k: number) => addDays('2026-11-23', -7 * k)
const st2 = RULES.streak(inp({ runs: [2, 4, 6, 8].map(k => f(addDays(mon(k), 1))) }))!
eq([st2.direction, st2.values.perWeek], ['steady', '1 run'], 'streak: a run every other week, none lately → steady')
const lapsed = RULES.streak(inp({ runs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap(k => [f(mon(k)), f(addDays(mon(k), 2))]) }))!
eq([lapsed.direction, lapsed.values.weeks, lapsed.runIds!.length], ['streak', '10', 20], 'streak: 10 weeks of 2, none this week → 20 runs')

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
const few = RULES.steps(inp({ health: { steps: up9 }, steps365: pts(90, 31, 7000) }))!
eq([few.direction, few.values.since], ['record', 'you started tracking'], 'steps: 3 blocks all beaten → since tracking began')
eq(RULES.steps(inp({ health: { steps: md([...pts(30, 31, 8000), ...pts(30, 1, 8400)]) }, steps365: [...pts(330, 31, 8000), ...pts(30, 1, 8400)] }))!.direction,
  'steady', 'steps: +5% is no record')
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

console.log('rules.check: all passed')
