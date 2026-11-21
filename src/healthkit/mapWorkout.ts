// Pure: one HealthKit workout + its samples → Run. No React Native imports (node self-check runs it).
import type { Run, Segment, Split } from '../types/index.ts'
import { zoneBounds } from '../utils/zones.ts'

export interface Q { unit: string; quantity: number }
export interface Sample { start: Date; end: Date; value: number }
export interface WorkoutEvent { type: number; start: Date; end: Date }
export interface WorkoutInput {
  uuid: string
  start: Date
  end: Date
  duration: Q
  totalDistance?: Q
  totalEnergyBurned?: Q                                // active calories
  events?: WorkoutEvent[]                              // pauses + Apple's split segments
  activities?: { start: Date; end: Date; durationSec: number }[]  // custom-workout steps (no names in HealthKit API)
  hrSummary?: { avg: number; min: number; max: number } // Apple's own workout HR statistics, if available
  metadata: { HKElevationAscended?: Q; HKWeatherTemperature?: Q; HKWeatherHumidity?: Q; HKTimeZone?: string }
}

// HKWorkoutEventType values
const PAUSE = 1, RESUME = 2, MOTION_PAUSED = 5, MOTION_RESUMED = 6, SEGMENT = 7

const HR_GAP_CAP = 10  // s: a longer gap between HR samples (pause, lost contact) counts as 10 s
const LAST_HR_SEC = 5  // s: weight of the final HR sample

const M_PER: Record<string, number> = { m: 1, meters: 1, cm: 0.01, km: 1000, ft: 0.3048, mi: 1609.344, yd: 0.9144 }
const SEC_PER: Record<string, number> = { s: 1, ms: 0.001, min: 60, hr: 3600, h: 3600 }
const KCAL_PER: Record<string, number> = { kcal: 1, Cal: 1, cal: 0.001, kJ: 0.239006, J: 0.000239006 }
export const meters = (q: Q) => q.quantity * (M_PER[q.unit] ?? 1)
export const seconds = (q: Q) => q.quantity * (SEC_PER[q.unit] ?? 1)
const round2 = (n: number) => Math.round(n * 100) / 100
const ms = (d: Date) => d.getTime()

/** 'YYYY-MM-DD' in the run's own time zone (HKTimeZone), else the phone's. */
function localDay(d: Date, timeZone?: string) {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
    } catch { /* unknown zone → phone's zone */ }
  }
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function meanHr(hr: Sample[], from: number, to: number): number | null {
  const v = hr.filter(s => ms(s.start) >= from && ms(s.start) < to).map(s => s.value)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

/** Time-weighted HR stats + seconds per zone. Each sample counts until the next one (capped). */
function hrStats(hr: Sample[], hrMax: number) {
  if (hr.length === 0) return null
  const b = zoneBounds(hrMax)
  const zones: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  let sum = 0, weight = 0
  hr.forEach((s, i) => {
    const next = hr[i + 1]
    const w = next ? Math.min((ms(next.start) - ms(s.start)) / 1000, HR_GAP_CAP) : LAST_HR_SEC
    sum += s.value * w; weight += w
    let z = 0
    for (let k = 1; k < 5; k++) if (s.value >= b[k]) z = k
    zones[z] += w
  })
  const values = hr.map(s => s.value)
  return {
    avg: weight ? Math.round(sum / weight) : null,
    min: Math.round(Math.min(...values)),
    max: Math.round(Math.max(...values)),
    zones: zones.map(Math.round) as [number, number, number, number, number],
  }
}

/** Paused time ranges (pause/resume, auto-pause). A pause with no resume runs to the end. */
function pauses(events: WorkoutEvent[], end: number): [number, number][] {
  const out: [number, number][] = []
  let from: number | null = null
  for (const e of [...events].sort((a, b) => ms(a.start) - ms(b.start))) {
    if ((e.type === PAUSE || e.type === MOTION_PAUSED) && from == null) from = ms(e.start)
    else if ((e.type === RESUME || e.type === MOTION_RESUMED) && from != null) { out.push([from, ms(e.start)]); from = null }
  }
  if (from != null) out.push([from, end])
  return out
}

const pausedIn = (p: [number, number][], from: number, to: number) =>
  p.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0)

/** Apple's own per-km splits: the Watch stores km and mile splits as two chains of segment events
 *  starting at the workout start. The km chain has ceil(km) links. Time excludes pauses (as in Fitness). */
function appleSplits(w: WorkoutInput, distanceKm: number, hr: Sample[]): Split[] | null {
  const segs = (w.events ?? []).filter(e => e.type === SEGMENT)
  if (segs.length === 0 || distanceKm <= 0) return null
  const want = Math.ceil(distanceKm - 0.005)
  for (const first of segs.filter(e => ms(e.start) === ms(w.start))) {
    const chain = [first]
    let next: WorkoutEvent | undefined
    while ((next = segs.find(e => ms(e.start) === ms(chain[chain.length - 1].end))) && chain.length <= want) chain.push(next)
    if (chain.length !== want) continue
    const p = pauses(w.events ?? [], ms(w.end))
    return chain.map((e, i) => ({
      km: i < chain.length - 1 ? i + 1 : round2(distanceKm),
      timeSec: Math.round((ms(e.end) - ms(e.start) - pausedIn(p, ms(e.start), ms(e.end))) / 1000),
      avgHr: meanHr(hr, ms(e.start), ms(e.end)),
    }))
  }
  return null
}

/** Fallback splits from distance samples (m). Time = sum of sample durations, so pauses don't count. */
function sampleSplits(dist: Sample[], hr: Sample[]): Split[] {
  const out: Split[] = []
  if (dist.length === 0) return out
  let cum = 0, active = 0, lastActive = 0, lastWall = ms(dist[0].start), nextKm = 1
  for (const s of dist) {
    const dur = (ms(s.end) - ms(s.start)) / 1000
    while (s.value > 0 && cum + s.value >= nextKm * 1000) {
      const f = (nextKm * 1000 - cum) / s.value
      const tActive = active + f * dur
      const wall = ms(s.start) + f * dur * 1000
      out.push({ km: nextKm, timeSec: Math.round(tActive - lastActive), avgHr: meanHr(hr, lastWall, wall) })
      lastActive = tActive; lastWall = wall; nextKm++
    }
    cum += s.value; active += dur
  }
  if (cum / 1000 - (nextKm - 1) >= 0.05) {
    const end = ms(dist[dist.length - 1].end) + 1
    out.push({ km: round2(cum / 1000), timeSec: Math.round(active - lastActive), avgHr: meanHr(hr, lastWall, end) })
  }
  return out
}

/** Meters of distance samples inside [from, to); a sample crossing an edge counts by its overlap. */
function distIn(dist: Sample[], from: number, to: number) {
  return dist.reduce((sum, s) => {
    const a = ms(s.start), b = ms(s.end)
    if (b <= a) return sum + (a >= from && a < to ? s.value : 0)
    return sum + s.value * Math.max(0, Math.min(b, to) - Math.max(a, from)) / (b - a)
  }, 0)
}

const STEP_GAP = 30  // s/km: paces closer than this are one group (all "work")

/** Custom-workout steps → segments. HealthKit gives no step names, so they're "Step N" (+ "Open" for the
 *  time after the last step). Type only drives the colour: the faster pace group = rep, slower = rest. */
function stepSegments(w: WorkoutInput, dist: Sample[], hr: Sample[]): Segment[] | null {
  const acts = [...(w.activities ?? [])].sort((a, b) => ms(a.start) - ms(b.start))
  if (acts.length < 2) return null  // one activity = an ordinary run
  const p = pauses(w.events ?? [], ms(w.end))
  const rows = acts.map((a, i) => ({ label: `Step ${i + 1}`, from: ms(a.start), to: ms(a.end), timeSec: Math.round(a.durationSec) }))
  const lastEnd = ms(acts[acts.length - 1].end)
  const openSec = Math.round((ms(w.end) - lastEnd - pausedIn(p, lastEnd, ms(w.end))) / 1000)
  if (openSec >= 1) rows.push({ label: 'Open', from: lastEnd, to: ms(w.end), timeSec: openSec })

  const segs = rows.map(r => ({
    label: r.label, timeSec: r.timeSec,
    distanceKm: Math.round(distIn(dist, r.from, r.to)) / 1000,
    avgHr: meanHr(hr, r.from, r.to),
  }))
  // Split the steps' paces at the biggest jump: everything at or below it is the fast group.
  const paces = segs.filter(s => s.label !== 'Open' && s.distanceKm > 0).map(s => s.timeSec / s.distanceKm).sort((a, b) => a - b)
  let cut = Infinity, gap = STEP_GAP
  for (let i = 1; i < paces.length; i++) if (paces[i] - paces[i - 1] > gap) { gap = paces[i] - paces[i - 1]; cut = paces[i - 1] }
  return segs.map(s => {
    const pace = s.distanceKm > 0 ? s.timeSec / s.distanceKm : Infinity
    const type: Segment['type'] = s.label === 'Open' || pace > cut ? 'rest' : cut === Infinity ? 'main' : 'rep'
    return { type, ...s }
  })
}

// Fitness truncates whole numbers (14.65 m → 14 m, 19.6° → 19°, 1:04:06.7 → 1:04:06); we do the same.
function weather(m: WorkoutInput['metadata']): Run['weather'] {
  const t = m.HKWeatherTemperature, h = m.HKWeatherHumidity
  if (!t || !h) return null
  const c = /F/i.test(t.unit) ? (t.quantity - 32) * 5 / 9 : t.quantity
  const pct = h.quantity <= 1 ? h.quantity * 100 : h.quantity  // HealthKit may give 0–1 or 0–100
  return { tempC: Math.trunc(c), humidity: Math.round(pct) }
}

/** hr in bpm, dist in meters, steps in count; all sorted by start, all from this workout's time range. */
export function mapWorkout(w: WorkoutInput, hr: Sample[], dist: Sample[], steps: Sample[], hrMax: number): Run {
  const distM = w.totalDistance ? meters(w.totalDistance) : dist.reduce((a, s) => a + s.value, 0)
  const distanceKm = round2(distM / 1000)
  const timeSec = Math.floor(seconds(w.duration))
  const stats = hrStats(hr, hrMax)
  const sum = w.hrSummary
  const stepTotal = steps.reduce((a, s) => a + s.value, 0)
  const elev = w.metadata.HKElevationAscended
  const kcal = w.totalEnergyBurned ? w.totalEnergyBurned.quantity * (KCAL_PER[w.totalEnergyBurned.unit] ?? 1) : null
  return {
    id: w.uuid.toLowerCase(),             // HealthKit gives uppercase; Postgres uuids come back lowercase
    healthkitUuid: w.uuid.toLowerCase(),
    typeId: null,
    name: `Run: ${distanceKm.toFixed(1)}km`,
    date: localDay(w.start, w.metadata.HKTimeZone),
    startedAt: w.start.toISOString(),
    distanceKm,
    timeSec,
    avgHr: sum ? Math.round(sum.avg) : stats?.avg ?? null,
    maxHr: sum ? Math.round(sum.max) : stats?.max ?? null,
    minHr: sum ? Math.round(sum.min) : stats?.min ?? null,
    elevGain: elev ? Math.floor(meters(elev)) : null,
    cadence: stepTotal > 0 && timeSec > 0 ? Math.round(stepTotal / (timeSec / 60)) : null,
    calories: kcal != null ? Math.floor(kcal) : null,
    source: 'apple_health',
    notes: null,
    segments: stepSegments(w, dist, hr),
    splits: appleSplits(w, distanceKm, hr) ?? sampleSplits(dist, hr),
    weather: weather(w.metadata),
    zones: stats?.zones ?? null,
  }
}
