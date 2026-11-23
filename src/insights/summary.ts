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
      // a night that isn't today's must not pass for "last night": show its date instead of the average
      const meta = n.date !== today ? fmtDate(n.date) : avg == null ? '' : `avg ${fmtHMM(avg * 3600)} over 30 days`
      return { value: fmtHMM(n.asleep), unit: 'h', meta }
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
export const isHidden = (layout: InsightsLayout | null, key: string): boolean => layout?.hidden?.includes(key) ?? false

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
