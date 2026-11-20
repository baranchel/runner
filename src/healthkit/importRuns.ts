// HealthKit → local DB. Read-only on the Health side. Rows are insert-if-missing,
// so a re-import never touches the user's type, notes or edits.
import { runToRow } from '../db/merge'
import { getEpoch, getMeta, setMeta, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import { useRunStore } from '../store/useRunStore'
import { MOCK_HR_MAX } from '../utils/zones'
import { pickNew, type Candidate } from './dedupe'
import { mapWorkout, meters, seconds, type Q, type Sample } from './mapWorkout'
import { hk } from './native'
import { needsHealthPrompt } from './permissions'

const ANCHOR = 'healthkit_anchor'
const PROGRESS_EVERY = 20
const MIN_KM = 0.1, MIN_SEC = 60  // accidental starts

type Progress = (done: number, total: number) => void
const listeners = new Set<Progress>()
let running: { epoch: number; promise: Promise<number> } | null = null

/** Syncs, then imports running workouts added to Health since last time. Returns how many were saved.
 *  Single-flight per login: a call while one runs gets the same promise (and its progress). */
export function importNewRuns(onProgress?: Progress): Promise<number> {
  if (onProgress) listeners.add(onProgress)
  // After a logout the old import stops at its next epoch check; this login gets its own.
  if (!running || running.epoch !== getEpoch()) {
    const mine = {
      epoch: getEpoch(),
      promise: run(getEpoch())
        .catch(e => { console.warn('[healthkit] import failed', e); return 0 })
        .finally(() => { if (running === mine) running = null }),
    }
    running = mine
  }
  const p = running.promise
  if (onProgress) p.finally(() => listeners.delete(onProgress))
  return p
}

async function run(epoch: number): Promise<number> {
  // Pull first, so runs already in the cloud (possibly stored under another app's copy) are known.
  await syncNow()
  const m = await hk()
  if (!m || (await needsHealthPrompt())) return 0  // not asked yet: an anchor saved now would skip history
  const stale = () => getEpoch() !== epoch  // logged out meanwhile: write nothing into the next user's data

  const anchor = getMeta(ANCHOR) ?? undefined
  const res = await m.queryWorkoutSamplesWithAnchor({
    filter: { workoutActivityType: m.WorkoutActivityType.running }, limit: 0, anchor,
  })
  if (stale()) return 0

  // HealthKit UUIDs are uppercase; Postgres returns uuids lowercase → compare and store lowercase.
  const workouts = res.workouts.filter(w =>
    (w.totalDistance ? meters(w.totalDistance) / 1000 >= MIN_KM : true) && seconds(w.duration) >= MIN_SEC)
  const byUuid = new Map(workouts.map(w => [w.uuid.toLowerCase(), w]))
  const cands: Candidate[] = workouts.map(w => ({
    uuid: w.uuid.toLowerCase(), start: w.startDate.getTime(), end: w.endDate.getTime(),
    isWatch: w.sourceRevision.productType?.startsWith('Watch') ?? false,
  }))
  const saved = useRunStore.getState().runs.map(r => ({
    id: r.id.toLowerCase(),
    start: r.startedAt ? Date.parse(r.startedAt) : null,
    end: r.startedAt ? Date.parse(r.startedAt) + r.timeSec * 1000 : null,
  }))
  const todo = pickNew(cands, saved)
  const progress = (done: number) => listeners.forEach(cb => cb(done, todo.length))

  for (let i = 0; i < todo.length; i++) {
    const w = byUuid.get(todo[i].uuid)!
    const range = { filter: { date: { startDate: w.startDate, endDate: w.endDate } }, limit: 0, ascending: true }
    const src = w.sourceRevision.source.bundleIdentifier
    const [hr, dist, steps, hrStat] = await Promise.all([
      m.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', { ...range, unit: 'count/min' }),
      m.queryQuantitySamples('HKQuantityTypeIdentifierDistanceWalkingRunning', { ...range, unit: 'm' }),
      m.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', { ...range, unit: 'count' }),
      // Apple's own HR summary for the workout (what Fitness shows); undefined for apps that don't record it
      w.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min').catch(() => undefined),
    ])
    if (stale()) return 0
    // iPhone and Watch both log distance/steps for the same run → keep only the workout's own source.
    // ponytail: a third-party workout whose app wrote no samples gets no splits/cadence; RA-12 may refine.
    const own = <T extends { sourceRevision: { source: { bundleIdentifier: string } } }>(ss: readonly T[]) =>
      ss.filter(s => s.sourceRevision.source.bundleIdentifier === src)
    const mapped = mapWorkout(
      {
        uuid: w.uuid, start: w.startDate, end: w.endDate, duration: w.duration, totalDistance: w.totalDistance,
        totalEnergyBurned: w.totalEnergyBurned,
        events: (w.events ?? []).map(e => ({ type: e.type, start: e.startDate, end: e.endDate })),
        activities: (w.activities ?? []).map(a => ({ start: a.startDate, end: a.endDate, durationSec: a.duration })),
        hrSummary: hrStat?.averageQuantity && hrStat.minimumQuantity && hrStat.maximumQuantity
          ? { avg: hrStat.averageQuantity.quantity, min: hrStat.minimumQuantity.quantity, max: hrStat.maximumQuantity.quantity }
          : undefined,
        metadata: {
          HKTimeZone: typeof w.metadata?.HKTimeZone === 'string' ? w.metadata.HKTimeZone : undefined,
          HKElevationAscended: quantity(w.metadata?.HKElevationAscended),
          HKWeatherTemperature: quantity(w.metadata?.HKWeatherTemperature),
          HKWeatherHumidity: quantity(w.metadata?.HKWeatherHumidity),
        },
      },
      toSamples(hr), toSamples(own(dist)), toSamples(own(steps)), MOCK_HR_MAX,
    )
    writeChange('runs', 'insert', { ...runToRow(mapped) })
    if ((i + 1) % PROGRESS_EVERY === 0) progress(i + 1)
  }
  progress(todo.length)

  // Save the anchor only once something has ever been imported: if access was refused, the query
  // returns nothing, and an anchor saved then would hide the whole history after access is turned on.
  // ponytail: Watch samples that sync after the workout are missed (anchor moves on); RA-21 re-reads HR.
  if (anchor || res.workouts.length > 0) setMeta(ANCHOR, res.newAnchor)
  if (todo.length > 0) { useRunStore.getState().load(); syncNow() }
  return todo.length
}

// Metadata is an untyped map on the native side: accept only a real { unit, quantity } (else no value, not NaN).
const quantity = (v: unknown): Q | undefined =>
  typeof v === 'object' && v !== null && typeof (v as Q).quantity === 'number' && typeof (v as Q).unit === 'string'
    ? (v as Q) : undefined

const toSamples = (ss: readonly { startDate: Date; endDate: Date; quantity: number }[]): Sample[] =>
  ss.map(s => ({ start: s.startDate, end: s.endDate, value: s.quantity }))
