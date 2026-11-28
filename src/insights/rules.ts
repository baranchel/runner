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
    method: `Median pace of runs of 2 km or more whose average HR was in your Z2 (${starts[0]}–${starts[1] - 1} bpm), last 30 days vs 60 to 89 days ago.`,
  }
}

function z2Share({ today, runs }: Inputs): Finding | null {
  const hr = runs.filter(f => f.zones && sum(f.zones) > 0)
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
  const usual = median(counts.slice(-9, -1).map(p => p.value)) ?? 0
  const target = Math.max(1, Math.round(usual))
  const thisWeek = counts.at(-1)!.value >= target ? 1 : 0               // this week counts once it gets there
  let n = thisWeek
  for (let i = counts.length - 2; i >= 0 && counts[i].value >= target; i--) n++
  const isStreak = n >= 3
  if (!isStreak && usual === 0) return null                             // lapsed: "your usual week" would be a lie
  const from = isStreak ? counts[counts.length - (thisWeek ? 0 : 1) - n].date : counts[counts.length - 8].date
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
    series: ser, seriesKind: 'line',
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
    if (k === -1) return { high, since: blocks.length === 11 ? `${monthName(today)} last year` : 'you started tracking' }
    if (k >= 2) return { high, since: sinceMonth(blocks[k].end, today) }
  }
  return null
}

function steps({ today, health, steps365 }: Inputs): Finding | null {
  const p = health.steps?.points ?? []
  const now = inWindow(p, today, 1, 30), prev = inWindow(p, today, 31, 30)   // ends yesterday: today is still counting
  if (now.length < 20 || prev.length < 20) return null
  const a = mean(prev.map(x => x.value))!, b = mean(now.map(x => x.value))!, c = pct(b, a)
  const rec = steps365 && change(c, 10).score >= 1 ? stepsRecord(steps365, today, b) : null   // a record needs a real change
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
