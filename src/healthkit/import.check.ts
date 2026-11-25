// Run: node src/healthkit/import.check.ts
import { mapWorkout, needsType, type Sample, type WorkoutInput } from './mapWorkout.ts'
import { pickNew } from './dedupe.ts'
import { zoneStarts, zoneTimes } from '../utils/zones.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}

const t0 = new Date(2026, 10, 1, 7, 0, 0)            // 1 Nov 2026 07:00 local
const at = (sec: number) => new Date(t0.getTime() + sec * 1000)

// 2.5 km in 5 distance samples of 500 m, each 150 s → 5:00/km, no pauses
const dist: Sample[] = [0, 1, 2, 3, 4].map(i => ({ start: at(i * 150), end: at(i * 150 + 150), value: 500 }))
// HR every 5 s: 140 bpm for the first 300 s (km 1), 160 after
const hr: Sample[] = Array.from({ length: 150 }, (_, i) => ({ start: at(i * 5), end: at(i * 5), value: i * 5 < 300 ? 140 : 160 }))
const steps: Sample[] = [{ start: at(0), end: at(750), value: 2125 }]  // 2125 steps / 12.5 min = 170 spm

const w: WorkoutInput = {
  uuid: 'AAAA-1', start: t0, end: at(750),
  duration: { unit: 's', quantity: 750 },
  totalDistance: { unit: 'm', quantity: 2500 },
  metadata: {
    HKElevationAscended: { unit: 'cm', quantity: 1250 },
    HKWeatherTemperature: { unit: 'degF', quantity: 68 },
    HKWeatherHumidity: { unit: '%', quantity: 55 },
  },
}

const run = mapWorkout(w, hr, dist, steps)
eq(run.id, 'aaaa-1', 'id = workout uuid')
eq(run.healthkitUuid, 'aaaa-1', 'healthkitUuid = workout uuid')
eq(mapWorkout({ ...w, uuid: 'E3B0C442-ABCD' }, [], [], []).id, 'e3b0c442-abcd', 'uuid lowercased (Postgres returns lowercase)')
eq(mapWorkout({ ...w, totalDistance: { unit: 'meters', quantity: 2500 } }, [], [], []).distanceKm, 2.5, "unit 'meters'")
eq(run.date, '2026-11-01', 'local day')
eq(run.startedAt, t0.toISOString(), 'startedAt ISO')
eq(run.distanceKm, 2.5, 'distance km')
eq(run.timeSec, 750, 'time sec')
eq(run.name, 'Run: 2.5km', 'default name')
eq(run.source, 'apple_health', 'source')
eq([run.typeId, run.notes, run.segments], [null, null, null], 'unclassified, no notes, no steps → no segments')
eq(run.splits, [
  { km: 1, timeSec: 300, avgHr: 140 },
  { km: 2, timeSec: 300, avgHr: 160 },
  { km: 2.5, timeSec: 150, avgHr: 160 },
], 'splits incl. partial')
eq([run.minHr, run.maxHr], [140, 160], 'min/max HR')
eq(run.avgHr, 152, 'time-weighted avg HR (300 s @140 + 450 s @160)')
eq(run.cadence, 170, 'cadence')
eq(run.elevGain, 12, 'elevation cm → m, truncated like Fitness')
eq(run.calories, null, 'no energy → null calories')
eq(run.weather, { tempC: 20, humidity: 55 }, 'weather °F → °C')
// HR every 5 s: 60 samples at 140 (300 s) + 90 at 160 (450 s, the last one weighs LAST_HR_SEC = 5)
eq(run.hrHist, { '140': 300, '160': 450 }, 'seconds at each bpm')
eq(zoneTimes(run.hrHist, zoneStarts(null, 190)), [0, 0, 300, 450, 0], 'zones at HRmax 190: 140 = Z3, 160 = Z4')
// The Watch keeps recording HR while paused; Fitness's zone times leave that out (they add up to the active time).
const pausedHr = mapWorkout({ ...w, events: [{ type: 1, start: at(300), end: at(300) }, { type: 2, start: at(400), end: at(400) }] }, hr, dist, [])
eq(pausedHr.hrHist, { '140': 300, '160': 350 }, 'HR during a pause (300–400 s) is not counted')
// Watch HR is often fractional. 156.6 is below a zone that starts at 157, as in Fitness, so bpm is floored, not rounded.
const fracHr: Sample[] = [{ start: at(0), end: at(0), value: 156.6 }, { start: at(5), end: at(5), value: 156.6 }]
const frac = mapWorkout(w, fracHr, dist, [])
eq(frac.hrHist, { '156': 10 }, 'fractional bpm floored')
eq(zoneTimes(frac.hrHist, [135, 157, 171, 182]), [0, 10, 0, 0, 0], '156.6 bpm stays in Z2 when Z3 starts at 157 (Fitness)')

// HR curve: 80 slices of 750 / 80 = 9.375 s. Slice 31 ends at 300 s (last 140), slice 32 starts at 300 s (160).
eq(run.hrCurve?.length, 80, '80 curve slices')
eq([run.hrCurve![0], run.hrCurve![31], run.hrCurve![32], run.hrCurve![79]], [[140, 140], [140, 140], [160, 160], [160, 160]], 'curve follows the HR')
// 160 s run → 2 s slices: one slice holds 150 and 130.4 → [130, 150]; the empty slices after it copy it.
const short = mapWorkout({ ...w, duration: { unit: 's', quantity: 160 } }, [{ start: at(0), end: at(0), value: 150 }, { start: at(1), end: at(1), value: 130.4 }], dist, [])
eq([short.hrCurve![0], short.hrCurve![79]], [[130, 150], [130, 150]], 'min/max per slice, empty slices filled')
// HR recorded during a pause (300–400 s, at 200 bpm) stays off the curve; after it, 400 s wall = 300 s active.
const pauseSpike = hr.map(s => (s.start >= at(300) && s.start < at(400) ? { ...s, value: 200 } : s))
const pc = mapWorkout({ ...w, events: [{ type: 1, start: at(300), end: at(300) }, { type: 2, start: at(400), end: at(400) }] }, pauseSpike, dist, []).hrCurve!
eq([Math.max(...pc.map(b => b[1])), pc[32]], [160, [160, 160]], 'paused HR left out, time axis is active time')
eq(mapWorkout(w, [], dist, []).hrCurve, null, 'no HR → no curve')

// ─── Real Apple Watch run (Bar, 17 Nov 2026, interval workout with a 30 s pause) ──────────────
// Expected split times are what the Fitness app shows for this run.
const T = (s: string) => new Date(`2026-11-17T${s}Z`)
const seg = (a: string, b: string) => ({ type: 7, start: T(a), end: T(b) })
const km = ['16:25:57.330', '16:33:57.133', '16:41:15.880', '16:48:30.982', '16:54:21.984', '16:59:47.930',
  '17:05:34.123', '17:11:03.951', '17:18:38.383', '17:28:30.189', '17:30:34.113']
const mi = ['16:25:57.330', '16:38:33.028', '16:49:43.628', '16:58:53.885', '17:07:56.491', '17:19:03.809', '17:30:34.113']
const real = mapWorkout({
  uuid: 'F2A34FD9-DE69-4033-9F6D-9DA9A82FD9C7', start: T('16:25:57.330'), end: T('17:30:34.113'),
  duration: { unit: 's', quantity: 3846.6868139505386 },
  totalDistance: { unit: 'meters', quantity: 9074.991358288127 },
  totalEnergyBurned: { unit: 'kcal', quantity: 796.9082991013513 },
  hrSummary: { avg: 158.4, min: 94, max: 188 },
  events: [
    ...km.slice(1).map((e, i) => seg(km[i], e)), ...mi.slice(1).map((e, i) => seg(mi[i], e)),
    { type: 1, start: T('16:43:47.183'), end: T('16:43:47.183') }, { type: 2, start: T('16:44:17.280'), end: T('16:44:17.280') },
    { type: 1, start: T('17:30:34.113'), end: T('17:30:34.113') },
  ],
  metadata: {
    HKTimeZone: 'Asia/Jerusalem',
    HKElevationAscended: { unit: 'm', quantity: 14.65 },
    HKWeatherTemperature: { unit: 'degC', quantity: 19.62826919555431 },
    HKWeatherHumidity: { unit: '%', quantity: 80 },
  },
}, [], [], [])
eq(real.splits.map(s => s.timeSec), [480, 439, 405, 351, 326, 346, 330, 454, 592, 124], 'Apple km splits, pause excluded (Fitness: 8:00 7:19 6:45 5:51 5:26 5:46 5:30 7:34 9:52 2:04)')
eq(real.splits.map(s => s.km), [1, 2, 3, 4, 5, 6, 7, 8, 9, 9.07], 'split km labels, last partial')
eq([real.distanceKm, real.timeSec, real.calories, real.elevGain, real.avgHr], [9.07, 3846, 796, 14, 158], 'Fitness: 9.07 km, 1:04:06, 796 cal, 14 m, 158 bpm')
eq(real.weather, { tempC: 19, humidity: 80 }, 'Fitness: 19°, 80%')
eq(real.date, '2026-11-17', "date in the run's time zone")
eq(mapWorkout({ ...w, start: T('22:30:00.000'), metadata: { HKTimeZone: 'Asia/Jerusalem' } }, [], [], []).date,
  '2026-11-18', '22:30 UTC = 00:30 next day in Jerusalem')

// ─── custom-workout steps (activities) → segments ──────────────────────────
const stepDist: Sample[] = [
  { start: at(0), end: at(300), value: 1000 },   // 5:00/km
  { start: at(300), end: at(600), value: 500 },  // 10:00/km
  { start: at(600), end: at(750), value: 500 },  // 5:00/km
]
const act = (a: number, b: number) => ({ start: at(a), end: at(b), durationSec: b - a })
const stepped = mapWorkout({ ...w, end: at(800), activities: [act(0, 300), act(300, 600), act(600, 750)] }, hr, stepDist, [])
eq(stepped.segments, [
  { type: 'rep',  label: 'Step 1', timeSec: 300, distanceKm: 1,   avgHr: 140 },
  { type: 'rest', label: 'Step 2', timeSec: 300, distanceKm: 0.5, avgHr: 160 },
  { type: 'rep',  label: 'Step 3', timeSec: 150, distanceKm: 0.5, avgHr: 160 },
  { type: 'rest', label: 'Open',   timeSec: 50,  distanceKm: 0,   avgHr: null },
], 'steps: fast = rep, slow = rest, leftover time = Open')
eq(mapWorkout({ ...w, activities: [act(0, 750)] }, hr, stepDist, []).segments, null, 'one activity = no segments')
eq(mapWorkout({ ...w, activities: [act(0, 300), act(300, 750)] }, hr, dist, []).segments!.map(s => s.type),
  ['main', 'main'], 'steps at the same pace: no rep/rest split')

// a pause: gap between samples is not counted in split time
const paused: Sample[] = [{ start: at(0), end: at(300), value: 1000 }, { start: at(600), end: at(900), value: 1000 }]
eq(mapWorkout({ ...w, totalDistance: { unit: 'm', quantity: 2000 } }, [], paused, []).splits.map(s => s.timeSec),
  [300, 300], 'pause excluded from split time')

// no HR, no steps, no metadata → nulls
const bare = mapWorkout({ ...w, metadata: {} }, [], dist, [])
eq([bare.avgHr, bare.minHr, bare.maxHr, bare.hrHist, bare.cadence, bare.elevGain, bare.weather],
  [null, null, null, null, null, null, null], 'missing data → null')
eq(bare.splits[0].avgHr, null, 'split without HR → null')

// humidity given as a fraction (0–1) → percent
eq(mapWorkout({ ...w, metadata: { HKWeatherTemperature: { unit: 'degC', quantity: 18 }, HKWeatherHumidity: { unit: '%', quantity: 0.4 } } },
  [], dist, []).weather, { tempC: 18, humidity: 40 }, 'fraction humidity')

// no totalDistance → sum of distance samples; km in miles unit
eq(mapWorkout({ ...w, totalDistance: undefined }, [], dist, []).distanceKm, 2.5, 'distance from samples')
eq(mapWorkout({ ...w, totalDistance: { unit: 'mi', quantity: 1 } }, [], [], []).distanceKm, 1.61, 'miles → km')
eq(mapWorkout({ ...w, duration: { unit: 'min', quantity: 12.5 } }, [], [], []).timeSec, 750, 'minutes → sec')

// ─── dedupe ─────────────────────────────────────────────────────────────────
const H = 3600_000
const c = (uuid: string, startH: number, endH: number, isWatch = false) => ({ uuid, start: startH * H, end: endH * H, isWatch })
eq(pickNew([c('a', 0, 1)], [{ id: 'a', start: null, end: null }]).map(x => x.uuid), [], 'already saved uuid skipped')
eq(pickNew([c('a', 0, 1)], [{ id: 'z', start: 0.5 * H, end: 1.5 * H }]).map(x => x.uuid), [], 'overlaps a saved run')
eq(pickNew([c('strava', 0, 1), c('watch', 0.01, 1.01, true)], []).map(x => x.uuid), ['watch'], 'Watch copy wins')
eq(pickNew([c('a', 0, 1), c('b', 0.2, 1.2)], []).map(x => x.uuid), ['a'], 'first of two non-Watch copies wins')
eq(pickNew([c('b', 2, 3), c('a', 0, 1)], []).map(x => x.uuid), ['a', 'b'], 'non-overlapping kept, oldest first')
eq(pickNew([c('a', 0, 1)], [{ id: 'old', start: null, end: null }]).map(x => x.uuid), ['a'], 'saved run without start time ignored for overlap')

// RA-39: only runs that started after the account was created need a type answer
const signup = '2026-11-08T10:00:00.000Z'
eq(needsType('2026-11-09T06:00:00.000Z', signup), true, 'after signup → asks')
eq(needsType('2026-11-01T06:00:00.000Z', signup), false, 'before signup → never asks')
eq(needsType(signup, signup), false, 'same instant → no')
eq(needsType(null, signup), false, 'no start time → no')
eq(needsType('2026-11-09T06:00:00.000Z', null), false, 'no account time → no')
eq(needsType('2026-11-08T10:00:00.124Z', '2026-11-08T10:00:00.123456Z'), true, 'Supabase microseconds format')
eq(run.needsType, false, 'mapWorkout leaves it to the import')

console.log('import.check OK')
