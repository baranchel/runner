# RA-3 Apple Connectivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the user's running workouts from Apple HealthKit (read-only) into the RA-34 data layer, with a permission screen after login, a first full-history import, and incremental imports on app open / foreground / pull-to-refresh.

**Architecture:** Pure mapping + dedupe logic in `src/healthkit/mapWorkout.ts` / `dedupe.ts` (node-checkable, no RN imports). A thin native adapter (`importRuns.ts`, `permissions.ts`, `bodyData.ts`) lazy-loads `@kingstinct/react-native-healthkit` so Expo Go doesn't crash. Rows are saved with `writeChange('runs','insert',…)` (insert-if-missing), then `syncNow()`.

**Tech Stack:** Expo 58, expo-router, expo-sqlite, Zustand, Supabase, `@kingstinct/react-native-healthkit@16` (Nitro modules).

Spec: `docs/superpowers/specs/2026-11-20-healthkit-design.md`.

**Rules for every task (from `CLAUDE.md`):** never run git commands — at each "Commit" step, stop and list the changed files + suggested message for Bar. Self-checks run with plain `node <file>.ts` (Node type-stripping, imports need the `.ts` extension, type-only imports are fine).

## Library facts (v16.2.0, verified from the published source)

- `requestAuthorization({ toRead: [...] }): Promise<boolean>`
- `getRequestStatusForAuthorization({ toRead }): Promise<AuthorizationRequestStatus>` — enum `unknown=0, shouldRequest=1, unnecessary=2`
- `isHealthDataAvailable(): boolean`
- `queryWorkoutSamplesWithAnchor({ filter: { workoutActivityType }, limit: 0, anchor? })` → `{ workouts, deletedSamples, newAnchor }`. `limit <= 0` = all.
- Workout: `uuid`, `startDate: Date`, `endDate: Date`, `duration: { unit, quantity }`, `totalDistance?: { unit, quantity }`, `sourceRevision: { source: { name, bundleIdentifier }, productType? }`, `metadata.HKElevationAscended? / HKWeatherTemperature? / HKWeatherHumidity?` (each `{ unit, quantity }`, units read at runtime).
- `queryQuantitySamples(id, { filter: { date: { startDate, endDate } }, limit: 0, ascending: true, unit })` → samples `{ quantity, unit, startDate, endDate, sourceRevision }`.
- `getDateOfBirthAsync(): Promise<Date | undefined>`, `getBiologicalSexAsync(): Promise<BiologicalSex>` (`notSet=0, female=1, male=2, other=3`), `getMostRecentQuantitySample(id, unit)`.
- Units: HR `'count/min'` (pass explicitly; canonical is count/s), distance `'m'`, steps `'count'`, height `'m'`, mass `'kg'`, resting HR `'count/min'`, VO2max `'ml/(kg*min)'`.
- `WorkoutActivityType.running` (= 37), exported from the package root.
- Config plugin `"@kingstinct/react-native-healthkit"` with `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` (`false` = skip), `background` (`false` = off).

If a signature doesn't match at `tsc` time, read `node_modules/@kingstinct/react-native-healthkit/src/` and adapt the adapter only — never the pure files.

## File map

| File | Change |
|---|---|
| `package.json`, `app.json` | add healthkit + nitro-modules, config plugin |
| `supabase/migrations/2026-11-20-started-at.sql` | new: `started_at` column |
| `supabase/schema.sql` | add `started_at` |
| `src/db/schema.ts` | SQLite v2: `started_at` |
| `src/db/queries.ts` | `started_at` in COLS, `ORDER BY date DESC, started_at DESC` |
| `src/types/index.ts` | `Run.startedAt` |
| `src/db/merge.ts` | map `started_at`; remove seed code |
| `src/db/sync.check.ts` | startedAt round-trip; remove seed checks |
| `src/healthkit/mapWorkout.ts` | new, pure |
| `src/healthkit/dedupe.ts` | new, pure |
| `src/healthkit/import.check.ts` | new self-check |
| `src/healthkit/native.ts` | new, lazy loader |
| `src/healthkit/permissions.ts` | new |
| `src/healthkit/bodyData.ts` | new (not called in RA-3) |
| `src/healthkit/importRuns.ts` | new |
| `src/store/useRunStore.ts` | remove `seedSampleRuns` |
| `src/mockData.ts` | delete |
| `src/store/useAuthStore.ts` | import after sync on login / foreground |
| `app/health-access.tsx` | new screen |
| `app/index.tsx`, `app/_layout.tsx` | route to health-access |
| `app/(tabs)/settings.tsx` | Apple Health row, drop seed button |
| `app/(tabs)/runs.tsx` | pull-to-refresh |
| `architecture.md`, `CLAUDE.md`, `docs/HANDOFF.md` | docs |

---

### Task 1: Install the package and configure the dev build

**Files:** Modify `package.json` (via install), `app.json`

- [ ] **Step 1: Install**

Run: `npx expo install @kingstinct/react-native-healthkit react-native-nitro-modules`
Expected: both added to `dependencies`, no peer errors (`react-native-nitro-modules` must be `>=0.35`).

- [ ] **Step 2: Add the config plugin** — in `app.json` `plugins`, after `"expo-apple-authentication"`:

```json
      [
        "@kingstinct/react-native-healthkit",
        {
          "NSHealthShareUsageDescription": "Chronodrom reads your runs, heart rate and body data from Apple Health to build your run history. It never writes to Apple Health.",
          "NSHealthUpdateUsageDescription": false,
          "background": false
        }
      ],
```

- [ ] **Step 3: Verify config**

Run: `npx expo config --type introspect | Select-String -Pattern "healthkit|NSHealthShare"`
Expected: `com.apple.developer.healthkit` entitlement and `NSHealthShareUsageDescription` present.

- [ ] **Step 4: Tell Bar to start the dev build now** (it takes a while and runs in the cloud while later tasks are coded):

```powershell
eas build --profile development --platform ios
```

- [ ] **Step 5: Commit** — files: `package.json`, `package-lock.json`, `app.json`. Message: `feat(healthkit): add HealthKit package and config plugin`

---

### Task 2: `started_at` column

**Files:** Create `supabase/migrations/2026-11-20-started-at.sql`; modify `supabase/schema.sql`, `src/db/schema.ts`, `src/db/queries.ts`, `src/types/index.ts`, `src/db/merge.ts`, `src/db/sync.check.ts`

- [ ] **Step 1: Failing check** — in `src/db/sync.check.ts`, add `startedAt: '2026-11-01T05:00:00.000Z',` to the `raw` run object (after `date`), and after the line `eq(rowToRun(runToRow(raw)).distanceKm, 10, 'no edits changes nothing')` add:

```ts
eq(runToRow(raw).started_at, '2026-11-01T05:00:00.000Z', 'startedAt → started_at')
eq(rowToRun(runToRow(raw)).startedAt, '2026-11-01T05:00:00.000Z', 'started_at → startedAt')
eq(rowToRun({ ...runToRow(raw), started_at: undefined as unknown as null }).startedAt, null, 'missing started_at → null')
```

- [ ] **Step 2: Run** `node src/db/sync.check.ts` — Expected: FAIL (`startedAt → started_at: expected "2026-…", got undefined`).

- [ ] **Step 3: Type** — `src/types/index.ts`, in `Run` after `date`:

```ts
  startedAt: string | null  // ISO start time; null for runs saved before RA-3
```

- [ ] **Step 4: Row mapping** — `src/db/merge.ts`: in `RunRow` after `date: string` add `started_at: string | null`. In `rowToRun` change `date: r.date,` to `date: r.date, startedAt: r.started_at ?? null,`. In `runToRow` change `date: r.date,` to `date: r.date, started_at: r.startedAt,`.

- [ ] **Step 5: Run** `node src/db/sync.check.ts` — Expected: PASS. Don't run `tsc` in this task: `src/mockData.ts` has no `startedAt` and is deleted in Task 3, where tsc is run.

- [ ] **Step 6: SQLite v2** — `src/db/schema.ts`: change `const VERSION = 1` to `const VERSION = 2`, add `started_at TEXT,` after `date TEXT NOT NULL,` inside the v1 `CREATE TABLE runs`, and after the `if (v < 1) {…}` block add:

```ts
if (v >= 1 && v < 2) {
  db.execSync(`ALTER TABLE runs ADD COLUMN started_at TEXT; PRAGMA user_version = ${VERSION};`)
}
```

(A fresh install creates the column in v1's CREATE and jumps to 2; an existing v1 phone runs the ALTER.)

- [ ] **Step 7: Queries** — `src/db/queries.ts`: in `COLS.runs` add `'started_at'` after `'date'`; change `loadRuns` SQL to `'SELECT * FROM runs ORDER BY date DESC, started_at DESC'`. (Screens sort by `date` with JS's stable sort, so same-day runs keep this order — no screen changes.)

- [ ] **Step 8: Cloud** — create `supabase/migrations/2026-11-20-started-at.sql`:

```sql
-- RA-3: full start time of a run (date stays the local day). Run once in Supabase → SQL Editor.
alter table public.runs add column started_at timestamptz;
```

and in `supabase/schema.sql` add after `date           date not null,`:

```sql
  started_at     timestamptz,                    -- full start time (RA-3); null for older rows
```

- [ ] **Step 9: Ask Bar** to run the migration SQL in the Supabase SQL Editor. Until then pushes containing `started_at` are rejected (`markOpFailed`), so this must be done before device testing.

- [ ] **Step 10: Commit** — files above. Message: `feat(db): add runs.started_at`

---

### Task 3: Remove the dev seed

**Files:** Modify `src/store/useRunStore.ts`, `src/db/merge.ts`, `src/db/sync.check.ts`, `app/(tabs)/settings.tsx`; delete `src/mockData.ts`

- [ ] **Step 1:** `src/db/merge.ts` — delete everything from `// ─── Dev seed ───` to the end of the file (`MOCK_TYPE_NAMES`, `seedUuid`, `seedRows`). Change the import line to `import type { Run, RunEdits } from '../types/index.ts'`. Change the `runToRow` comment to `/** Run (without edits) → row. Used for HealthKit imports. */`.

- [ ] **Step 2:** `src/db/sync.check.ts` — remove `seedRows, seedUuid` from the merge import, remove the `MOCK_RUNS` import, `RunType` from the types import, and delete the `// seed: …` block (from `eq(seedUuid(` through the last seed `eq(…)` line, including the `types` array). Keep the final OK print line if there is one.

- [ ] **Step 3:** `src/store/useRunStore.ts` — replace the whole file with:

```ts
import { create } from 'zustand'
import { diffEdits, rowToRun } from '../db/merge'
import { getRunRow, loadRuns, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import type { Run, RunEdits } from '../types'

type State = {
  runs: Run[]  // newest first, edits already applied
  load: () => void
  reset: () => void
  editRun: (id: string, patch: RunEdits) => void
}

export const useRunStore = create<State>((set, get) => ({
  runs: [],
  load: () => set({ runs: loadRuns().map(rowToRun) }),
  reset: () => set({ runs: [] }),

  editRun: (id, patch) => {
    const row = getRunRow(id)
    if (!row) return
    const edits = diffEdits(rowToRun({ ...row, edits: {} }), row.edits, patch)
    writeChange('runs', 'update', { id, edits })
    get().load()
    syncNow()
  },
}))
```

- [ ] **Step 4:** `app/(tabs)/settings.tsx` — delete `const seedSampleRuns = …`, the `seed` function, the `{__DEV__ && (…)}` button block, and the `useRunStore` import.

- [ ] **Step 5:** Delete `src/mockData.ts`. Then Grep `mockData|MOCK_RUNS|seedRows|seedSampleRuns` in `app/` and `src/` — Expected: no matches.

- [ ] **Step 6: Verify** — `node src/db/sync.check.ts` PASS; `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit** — message: `chore: remove dev sample-run seed`

---

### Task 4: Pure mapping + dedupe (TDD)

**Files:** Create `src/healthkit/mapWorkout.ts`, `src/healthkit/dedupe.ts`, `src/healthkit/import.check.ts`

- [ ] **Step 1: Write the failing check** — `src/healthkit/import.check.ts`:

```ts
// Run: node src/healthkit/import.check.ts
import { mapWorkout, type Sample, type WorkoutInput } from './mapWorkout.ts'
import { pickNew } from './dedupe.ts'

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

const run = mapWorkout(w, hr, dist, steps, 190)
eq(run.id, 'AAAA-1', 'id = workout uuid')
eq(run.healthkitUuid, 'AAAA-1', 'healthkitUuid = workout uuid')
eq(run.date, '2026-11-01', 'local day')
eq(run.startedAt, t0.toISOString(), 'startedAt ISO')
eq(run.distanceKm, 2.5, 'distance km')
eq(run.timeSec, 750, 'time sec')
eq(run.name, 'Run: 2.5km', 'default name')
eq(run.source, 'apple_health', 'source')
eq([run.typeId, run.notes, run.segments], [null, null, null], 'unclassified, no notes, no segments')
eq(run.splits, [
  { km: 1, timeSec: 300, avgHr: 140 },
  { km: 2, timeSec: 300, avgHr: 160 },
  { km: 2.5, timeSec: 150, avgHr: 160 },
], 'splits incl. partial')
eq([run.minHr, run.maxHr], [140, 160], 'min/max HR')
eq(run.avgHr, 152, 'time-weighted avg HR (300 s @140 + 450 s @160)')
eq(run.cadence, 170, 'cadence')
eq(run.elevGain, 13, 'elevation cm → m, rounded')
eq(run.weather, { tempC: 20, humidity: 55 }, 'weather °F → °C')
// zone bounds at 190: Z2 ≥114, Z3 ≥133, Z4 ≥152 → 140 bpm = Z3, 160 bpm = Z4
eq(run.zones, [0, 0, 300, 450, 0], 'seconds per zone')

// a pause: gap between samples is not counted in split time
const paused: Sample[] = [{ start: at(0), end: at(300), value: 1000 }, { start: at(600), end: at(900), value: 1000 }]
eq(mapWorkout({ ...w, totalDistance: { unit: 'm', quantity: 2000 } }, [], paused, [], 190).splits.map(s => s.timeSec),
  [300, 300], 'pause excluded from split time')

// no HR, no steps, no metadata → nulls
const bare = mapWorkout({ ...w, metadata: {} }, [], dist, [], 190)
eq([bare.avgHr, bare.minHr, bare.maxHr, bare.zones, bare.cadence, bare.elevGain, bare.weather],
  [null, null, null, null, null, null, null], 'missing data → null')
eq(bare.splits[0].avgHr, null, 'split without HR → null')

// humidity given as a fraction (0–1) → percent
eq(mapWorkout({ ...w, metadata: { HKWeatherTemperature: { unit: 'degC', quantity: 18 }, HKWeatherHumidity: { unit: '%', quantity: 0.4 } } },
  [], dist, [], 190).weather, { tempC: 18, humidity: 40 }, 'fraction humidity')

// no totalDistance → sum of distance samples; km in miles unit
eq(mapWorkout({ ...w, totalDistance: undefined }, [], dist, [], 190).distanceKm, 2.5, 'distance from samples')
eq(mapWorkout({ ...w, totalDistance: { unit: 'mi', quantity: 1 } }, [], [], [], 190).distanceKm, 1.61, 'miles → km')
eq(mapWorkout({ ...w, duration: { unit: 'min', quantity: 12.5 } }, [], [], [], 190).timeSec, 750, 'minutes → sec')

// ─── dedupe ─────────────────────────────────────────────────────────────────
const H = 3600_000
const c = (uuid: string, startH: number, endH: number, isWatch = false) => ({ uuid, start: startH * H, end: endH * H, isWatch })
eq(pickNew([c('a', 0, 1)], [{ id: 'a', start: null, end: null }]).map(x => x.uuid), [], 'already saved uuid skipped')
eq(pickNew([c('a', 0, 1)], [{ id: 'z', start: 0.5 * H, end: 1.5 * H }]).map(x => x.uuid), [], 'overlaps a saved run')
eq(pickNew([c('strava', 0, 1), c('watch', 0.01, 1.01, true)], []).map(x => x.uuid), ['watch'], 'Watch copy wins')
eq(pickNew([c('a', 0, 1), c('b', 0.2, 1.2)], []).map(x => x.uuid), ['a'], 'first of two non-Watch copies wins')
eq(pickNew([c('b', 2, 3), c('a', 0, 1)], []).map(x => x.uuid), ['a', 'b'], 'non-overlapping kept, oldest first')
eq(pickNew([c('a', 0, 1)], [{ id: 'old', start: null, end: null }]).map(x => x.uuid), ['a'], 'saved run without start time ignored for overlap')

console.log('import.check OK')
```

- [ ] **Step 2: Run** `node src/healthkit/import.check.ts` — Expected: FAIL, `Cannot find module …/mapWorkout.ts`.

- [ ] **Step 3: Implement** `src/healthkit/mapWorkout.ts`:

```ts
// Pure: one HealthKit workout + its samples → Run. No React Native imports (node self-check runs it).
import type { Run, Split } from '../types/index.ts'
import { zoneBounds } from '../utils/zones.ts'

export interface Q { unit: string; quantity: number }
export interface Sample { start: Date; end: Date; value: number }
export interface WorkoutInput {
  uuid: string
  start: Date
  end: Date
  duration: Q
  totalDistance?: Q
  metadata: { HKElevationAscended?: Q; HKWeatherTemperature?: Q; HKWeatherHumidity?: Q }
}

const HR_GAP_CAP = 10  // s: a longer gap between HR samples (pause, lost contact) counts as 10 s
const LAST_HR_SEC = 5  // s: weight of the final HR sample

const M_PER: Record<string, number> = { m: 1, cm: 0.01, km: 1000, ft: 0.3048, mi: 1609.344, yd: 0.9144 }
const SEC_PER: Record<string, number> = { s: 1, ms: 0.001, min: 60, hr: 3600, h: 3600 }
export const meters = (q: Q) => q.quantity * (M_PER[q.unit] ?? 1)
export const seconds = (q: Q) => q.quantity * (SEC_PER[q.unit] ?? 1)
const round2 = (n: number) => Math.round(n * 100) / 100
const ms = (d: Date) => d.getTime()

function localDay(d: Date) {
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

/** Per-km splits from distance samples (m). Time = sum of sample durations, so pauses don't count. */
function splits(dist: Sample[], hr: Sample[]): Split[] {
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

function weather(m: WorkoutInput['metadata']): Run['weather'] {
  const t = m.HKWeatherTemperature, h = m.HKWeatherHumidity
  if (!t || !h) return null
  const c = /F/i.test(t.unit) ? (t.quantity - 32) * 5 / 9 : t.quantity
  const pct = h.quantity <= 1 ? h.quantity * 100 : h.quantity  // HealthKit may give 0–1 or 0–100
  return { tempC: Math.round(c), humidity: Math.round(pct) }
}

/** hr in bpm, dist in meters, steps in count; all sorted by start, all from this workout's time range. */
export function mapWorkout(w: WorkoutInput, hr: Sample[], dist: Sample[], steps: Sample[], hrMax: number): Run {
  const distM = w.totalDistance ? meters(w.totalDistance) : dist.reduce((a, s) => a + s.value, 0)
  const distanceKm = round2(distM / 1000)
  const timeSec = Math.round(seconds(w.duration))
  const stats = hrStats(hr, hrMax)
  const stepTotal = steps.reduce((a, s) => a + s.value, 0)
  const elev = w.metadata.HKElevationAscended
  return {
    id: w.uuid,
    healthkitUuid: w.uuid,
    typeId: null,
    name: `Run: ${distanceKm.toFixed(1)}km`,
    date: localDay(w.start),
    startedAt: w.start.toISOString(),
    distanceKm,
    timeSec,
    avgHr: stats?.avg ?? null,
    maxHr: stats?.max ?? null,
    minHr: stats?.min ?? null,
    elevGain: elev ? Math.round(meters(elev)) : null,
    cadence: stepTotal > 0 && timeSec > 0 ? Math.round(stepTotal / (timeSec / 60)) : null,
    source: 'apple_health',
    notes: null,
    segments: null,
    splits: splits(dist, hr),
    weather: weather(w.metadata),
    zones: stats?.zones ?? null,
  }
}
```

Check the expected values: avg HR = (60 samples × 5 s × 140 + 90 × 5 × 160 − last sample's 5 s weight is still 5) → (300·140 + 450·160) / 750 = 152. Zones: 140 ≥ 133 (Z3, index 2) → 300 s; 160 ≥ 152 (Z4, index 3) → 450 s. Split 1 ends at wall 300 s → HR samples 0–295 s (all 140); split 2 at 600 s → 300–595 (160); partial 600–750 (160).

- [ ] **Step 4: Implement** `src/healthkit/dedupe.ts`:

```ts
// Pure: which HealthKit workouts to import. The same run can sit in Health several times
// (Apple Watch + Strava/Nike copy, each with its own UUID), so overlapping time ranges = duplicates.
export interface Candidate { uuid: string; start: number; end: number; isWatch: boolean }  // ms
export interface Saved { id: string; start: number | null; end: number | null }

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start < b.end && b.start < a.end

/** New workouts to import, oldest first: not saved yet, not overlapping a saved run; among overlapping
 *  candidates the Apple Watch copy wins, else the earliest. (Source choice by the user → RA-12.) */
export function pickNew(cands: Candidate[], saved: Saved[]): Candidate[] {
  const ids = new Set(saved.map(s => s.id))
  const ranges = saved.filter((s): s is Saved & { start: number; end: number } => s.start != null && s.end != null)
  const fresh = cands.filter(c => !ids.has(c.uuid) && !ranges.some(r => overlaps(c, r)))
  const byPriority = [...fresh].sort((a, b) => Number(b.isWatch) - Number(a.isWatch) || a.start - b.start)
  const kept: Candidate[] = []
  for (const c of byPriority) if (!kept.some(k => overlaps(c, k))) kept.push(c)
  return kept.sort((a, b) => a.start - b.start)
}
```

- [ ] **Step 5: Run** `node src/healthkit/import.check.ts` — Expected: `import.check OK`. Then `npx tsc --noEmit` clean.

(`zones.ts` imports `type { Run } from '../types'` without `.ts` — type-only, erased by Node, so the check still runs. If Node complains, change that import to `'../types/index.ts'`.)

- [ ] **Step 6: Commit** — message: `feat(healthkit): map workouts to runs and dedupe copies`

---

### Task 5: Native adapter — loader, permissions, body data

**Files:** Create `src/healthkit/native.ts`, `src/healthkit/permissions.ts`, `src/healthkit/bodyData.ts`

- [ ] **Step 1:** `src/healthkit/native.ts`:

```ts
// Loaded lazily: the native module doesn't exist in Expo Go, and a top-level import would crash it.
type HK = typeof import('@kingstinct/react-native-healthkit')
let mod: Promise<HK | null> | null = null

/** The HealthKit module, or null (Expo Go, or a device without Health such as an iPad). */
export function hk(): Promise<HK | null> {
  mod ??= import('@kingstinct/react-native-healthkit')
    .then(m => (m.isHealthDataAvailable() ? m : null))
    .catch(() => null)
  return mod
}
```

- [ ] **Step 2:** `src/healthkit/permissions.ts`:

```ts
import { getMeta, setMeta } from '../db/queries'
import { hk } from './native'

// One prompt for everything RA-3 and RA-11 read. iOS shows it once per install.
const READ = [
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
] as const

/** True while iOS has not shown the prompt yet (iOS remembers per install, so no flag of ours). */
export async function needsHealthPrompt(): Promise<boolean> {
  const m = await hk()
  if (!m) return false
  return (await m.getRequestStatusForAuthorization({ toRead: READ })) === m.AuthorizationRequestStatus.shouldRequest
}

/** Shows the iOS prompt. iOS never says what was allowed: a "no" simply returns no data later. */
export async function requestHealthAccess(): Promise<void> {
  const m = await hk()
  if (m) await m.requestAuthorization({ toRead: READ })
}

// "Not now" on the Health screen: don't show it again on every launch (Settings → Connect brings it back).
// Lives in sync_state, so logout clears it — fine, the next login asks once more.
export const healthSkipped = () => getMeta('health_skipped') === '1'
export const skipHealth = () => setMeta('health_skipped', '1')
```

If `AuthorizationRequestStatus` isn't exported on the module root at tsc time, import it from `'@kingstinct/react-native-healthkit/types'` instead (it's a runtime enum: `shouldRequest = 1`).

- [ ] **Step 3:** `src/healthkit/bodyData.ts`:

```ts
import { hk } from './native'

export interface BodyData {
  dob: string | null          // 'YYYY-MM-DD'
  sex: 'female' | 'male' | 'other' | null
  heightCm: number | null
  weightKg: number | null
  restingHr: number | null
  vo2max: number | null
}

const EMPTY: BodyData = { dob: null, sex: null, heightCm: null, weightKg: null, restingHr: null, vo2max: null }

/** Prefill for the RA-11 personal-info form. Every field null when Health has nothing (or access was refused). */
export async function readBodyData(): Promise<BodyData> {
  const m = await hk()
  if (!m) return EMPTY
  const latest = (id: Parameters<typeof m.getMostRecentQuantitySample>[0], unit: string) =>
    m.getMostRecentQuantitySample(id, unit as never).then(s => s?.quantity ?? null).catch(() => null)
  const [dob, sex, height, weight, restingHr, vo2max] = await Promise.all([
    m.getDateOfBirthAsync().catch(() => undefined),
    m.getBiologicalSexAsync().catch(() => m.BiologicalSex.notSet),
    latest('HKQuantityTypeIdentifierHeight', 'm'),
    latest('HKQuantityTypeIdentifierBodyMass', 'kg'),
    latest('HKQuantityTypeIdentifierRestingHeartRate', 'count/min'),
    latest('HKQuantityTypeIdentifierVO2Max', 'ml/(kg*min)'),
  ])
  const sexName = { [m.BiologicalSex.female]: 'female', [m.BiologicalSex.male]: 'male', [m.BiologicalSex.other]: 'other' } as const
  return {
    dob: dob ? dob.toISOString().slice(0, 10) : null,
    sex: sexName[sex as keyof typeof sexName] ?? null,
    heightCm: height != null ? Math.round(height * 100) : null,
    weightKg: weight != null ? Math.round(weight * 10) / 10 : null,
    restingHr: restingHr != null ? Math.round(restingHr) : null,
    vo2max: vo2max != null ? Math.round(vo2max * 10) / 10 : null,
  }
}
```

(`dob` from HealthKit is midnight UTC of the birthday, so `toISOString().slice(0,10)` gives the right day.)

- [ ] **Step 4: Verify** `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit** — message: `feat(healthkit): permissions and body data reader`

---

### Task 6: `importNewRuns()`

**Files:** Create `src/healthkit/importRuns.ts`

- [ ] **Step 1:** `src/healthkit/importRuns.ts`:

```ts
// HealthKit → local DB. Read-only on the Health side. Rows are insert-if-missing,
// so a re-import never touches the user's type, notes or edits.
import { runToRow } from '../db/merge'
import { getMeta, setMeta, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import { useRunStore } from '../store/useRunStore'
import { MOCK_HR_MAX } from '../utils/zones'
import { pickNew, type Candidate } from './dedupe'
import { mapWorkout, meters, seconds, type Sample } from './mapWorkout'
import { hk } from './native'
import { needsHealthPrompt } from './permissions'

const ANCHOR = 'healthkit_anchor'
const BATCH = 20
const MIN_KM = 0.1, MIN_SEC = 60  // accidental starts

let running: Promise<number> | null = null

/** Imports running workouts added to Health since last time. Returns how many were saved.
 *  Single-flight: a call while one runs gets the same promise. */
export function importNewRuns(onProgress?: (done: number, total: number) => void): Promise<number> {
  running ??= run(onProgress)
    .catch(e => { console.warn('[healthkit] import failed', e); return 0 })
    .finally(() => { running = null })
  return running
}

async function run(onProgress?: (done: number, total: number) => void): Promise<number> {
  const m = await hk()
  if (!m || (await needsHealthPrompt())) return 0  // not asked yet: an anchor saved now would skip history

  const anchor = getMeta(ANCHOR) ?? undefined
  const res = await m.queryWorkoutSamplesWithAnchor({
    filter: { workoutActivityType: m.WorkoutActivityType.running }, limit: 0, anchor,
  })

  const workouts = res.workouts.filter(w =>
    (w.totalDistance ? meters(w.totalDistance) / 1000 >= MIN_KM : true) && seconds(w.duration) >= MIN_SEC)
  const byUuid = new Map(workouts.map(w => [w.uuid, w]))
  const cands: Candidate[] = workouts.map(w => ({
    uuid: w.uuid, start: w.startDate.getTime(), end: w.endDate.getTime(),
    isWatch: w.sourceRevision.productType?.startsWith('Watch') ?? false,
  }))
  const saved = useRunStore.getState().runs.map(r => ({
    id: r.id,
    start: r.startedAt ? Date.parse(r.startedAt) : null,
    end: r.startedAt ? Date.parse(r.startedAt) + r.timeSec * 1000 : null,
  }))
  const todo = pickNew(cands, saved)

  for (let i = 0; i < todo.length; i++) {
    const w = byUuid.get(todo[i].uuid)!
    const range = { filter: { date: { startDate: w.startDate, endDate: w.endDate } }, limit: 0, ascending: true }
    const src = w.sourceRevision.source.bundleIdentifier
    const [hr, dist, steps] = await Promise.all([
      m.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', { ...range, unit: 'count/min' }),
      m.queryQuantitySamples('HKQuantityTypeIdentifierDistanceWalkingRunning', { ...range, unit: 'm' }),
      m.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', { ...range, unit: 'count' }),
    ])
    // iPhone and Watch both log distance/steps for the same run → keep only the workout's own source.
    // ponytail: a third-party workout whose app wrote no samples gets no splits/cadence; RA-12 may refine.
    const own = (ss: typeof dist) => ss.filter(s => s.sourceRevision.source.bundleIdentifier === src)
    const run = mapWorkout(
      {
        uuid: w.uuid, start: w.startDate, end: w.endDate, duration: w.duration, totalDistance: w.totalDistance,
        metadata: {
          HKElevationAscended: w.metadata?.HKElevationAscended as never,
          HKWeatherTemperature: w.metadata?.HKWeatherTemperature as never,
          HKWeatherHumidity: w.metadata?.HKWeatherHumidity as never,
        },
      },
      toSamples(hr), toSamples(own(dist)), toSamples(own(steps)), MOCK_HR_MAX,
    )
    writeChange('runs', 'insert', { ...runToRow(run) })
    if ((i + 1) % BATCH === 0) { useRunStore.getState().load(); onProgress?.(i + 1, todo.length) }
  }
  onProgress?.(todo.length, todo.length)

  // Save the anchor only once something has ever been imported: if access was refused, the query
  // returns nothing, and an anchor saved then would hide the whole history after access is turned on.
  if (anchor || res.workouts.length > 0) setMeta(ANCHOR, res.newAnchor)
  if (todo.length > 0) { useRunStore.getState().load(); syncNow() }
  return todo.length
}

const toSamples = (ss: readonly { startDate: Date; endDate: Date; quantity: number }[]): Sample[] =>
  ss.map(s => ({ start: s.startDate, end: s.endDate, value: s.quantity }))
```

Notes for the implementer:
- `pickNew` checks against `useRunStore` runs, which are loaded from SQLite after login, so the caller must run after `load()` (Task 7 calls it after `syncNow()`).
- If tsc rejects `w.metadata?.HKElevationAscended` typing, the `as never` casts are the escape hatch; don't widen `mapWorkout`'s types.
- Interrupted import: the anchor is saved only at the end, so the next run re-reads everything and `pickNew` skips what was saved.

- [ ] **Step 2: Verify** `npx tsc --noEmit` clean; `node src/healthkit/import.check.ts` still OK.

- [ ] **Step 3: Commit** — message: `feat(healthkit): incremental workout import`

---

### Task 7: Screens and triggers

**Files:** Create `app/health-access.tsx`; modify `app/_layout.tsx`, `app/index.tsx`, `src/store/useAuthStore.ts`, `app/(tabs)/runs.tsx`, `app/(tabs)/settings.tsx`

- [ ] **Step 1:** `app/health-access.tsx`:

```tsx
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { importNewRuns } from '../src/healthkit/importRuns'
import { requestHealthAccess, skipHealth } from '../src/healthkit/permissions'
import { buttons, colors, fonts } from '../src/utils/tokens'

// After login: why we need Apple Health → iOS prompt → first import → Dashboard.
// (RA-11's personal-info form will slot in before the Dashboard.)
export default function HealthAccess() {
  const router = useRouter()
  const [progress, setProgress] = useState<string | null>(null)

  const connect = async () => {
    if (progress) return
    setProgress('Waiting for Apple Health…')
    await requestHealthAccess()
    setProgress('Importing your runs…')
    await importNewRuns((done, total) => setProgress(`Importing ${done} / ${total} runs`))
    router.replace('/(tabs)/dashboard')
  }

  const later = () => { skipHealth(); router.replace('/(tabs)/dashboard') }

  return (
    <View style={s.container}>
      <Text style={s.title}>Connect Apple Health</Text>
      <Text style={s.body}>
        Chronodrom builds your run history from Apple Health: your runs, heart rate, splits and body data.
        It only reads — it never writes to Apple Health.
      </Text>
      <TouchableOpacity style={[buttons.primary, s.cta]} onPress={connect} activeOpacity={0.82}>
        <Text style={buttons.primaryText}>{progress ?? 'Connect'}</Text>
      </TouchableOpacity>
      {!progress && (
        <TouchableOpacity onPress={later} activeOpacity={0.7}>
          <Text style={s.later}>Not now</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: 24, justifyContent: 'center', gap: 18 },
  title:     { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 25, fontWeight: '600' },
  body:      { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  cta:       { marginTop: 12, alignItems: 'center' },
  later:     { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },
})
```

Check `buttons.primary` / `buttons.primaryText` exist in `src/utils/tokens.ts` (they're used in `runs.tsx`). Compare with `FRONTEND_SPEC.md` button rules; adjust padding/size only if the spec says so.

- [ ] **Step 2:** `app/_layout.tsx` — inside the `guard={!loading && !!session}` group, add as the first child: `<Stack.Screen name="health-access" />`.

- [ ] **Step 3:** `app/index.tsx` — replace with:

```tsx
import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/useAuthStore'
import { healthSkipped, needsHealthPrompt } from '../src/healthkit/permissions'

export default function Index() {
  const session = useAuthStore(s => s.session)
  const loading = useAuthStore(s => s.loading)
  const [askHealth, setAskHealth] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session) return
    needsHealthPrompt().then(n => setAskHealth(n && !healthSkipped()))
  }, [session])

  if (loading) return null
  if (!session) return <Redirect href="/login" />
  if (askHealth === null) return null
  return <Redirect href={askHealth ? '/health-access' : '/(tabs)/dashboard'} />
}
```

- [ ] **Step 4:** `src/store/useAuthStore.ts` — add `import { importNewRuns } from '../healthkit/importRuns'`, then:
  - change `const syncSoon = () => setTimeout(syncNow, 0)` to
    ```ts
    // Import after the pull, so runs already in the cloud are known and skipped.
    const syncThenImport = () => syncNow().then(() => importNewRuns())
    const syncSoon = () => setTimeout(syncThenImport, 0)
    ```
  - change the AppState listener body to `if (state === 'active' && currentUser) syncThenImport()`.

  (`importNewRuns` returns 0 while the prompt hasn't been shown, so it's a no-op before the Health screen.)

- [ ] **Step 5:** `app/(tabs)/runs.tsx` — pull-to-refresh on the `SectionList`:
  - add `RefreshControl` to the `react-native` import and `import { importNewRuns } from '../../src/healthkit/importRuns'`, `import { syncNow } from '../../src/db/sync'`.
  - in the component: 
    ```ts
    const [refreshing, setRefreshing] = useState(false)
    const refresh = async () => {
      setRefreshing(true)
      await syncNow()
      await importNewRuns()
      setRefreshing(false)
    }
    ```
  - on `<SectionList` add `refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.textSecondary} />}`.

- [ ] **Step 6:** `app/(tabs)/settings.tsx` — Apple Health row above "Log out":
  - imports: `import { useEffect } from 'react'` (merge into the existing react import), `import { useRouter } from 'expo-router'`, `import { needsHealthPrompt } from '../../src/healthkit/permissions'`.
  - in the component:
    ```ts
    const router = useRouter()
    const [canConnect, setCanConnect] = useState(false)
    useEffect(() => { needsHealthPrompt().then(setCanConnect) }, [])
    ```
  - JSX, before the Log out button:
    ```tsx
    <View style={s.healthBox}>
      <Text style={s.healthTitle}>Apple Health</Text>
      {canConnect ? (
        <TouchableOpacity style={s.btn} onPress={() => router.push('/health-access')} activeOpacity={0.82}>
          <Text style={s.btnText}>Connect Apple Health</Text>
        </TouchableOpacity>
      ) : (
        <Text style={s.body}>
          Runs missing? Open the iPhone Settings app → Health → Data Access & Devices → Chronodrom, and turn on all categories.
          New runs are imported when you open the app or pull down on All runs.
        </Text>
      )}
    </View>
    ```
  - styles: `healthBox: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, gap: 10 },` and `healthTitle: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600' },`.

- [ ] **Step 7: Verify** `npx tsc --noEmit` clean; both self-checks pass. In Expo Go (if Bar wants a quick look): app opens, no Health screen (module missing → `needsHealthPrompt()` false), Settings shows the instructions text.

- [ ] **Step 8: Commit** — message: `feat(healthkit): health access screen, import triggers, pull-to-refresh`

---

### Task 8: Docs

**Files:** Modify `architecture.md`, `CLAUDE.md`, `docs/HANDOFF.md`

- [ ] **Step 1:** `architecture.md` — file tree: add `src/healthkit/` files and `app/health-access.tsx`, remove `src/mockData.ts`; data model: `runs.started_at`; a short "HealthKit import" section: anchor in `sync_state`, insert-if-missing, overlap dedupe (Watch wins), runs only after the pull, saved-anchor rule, Expo Go lazy load.
- [ ] **Step 2:** `CLAUDE.md` — Stack line for healthkit: "lazy-loaded via `src/healthkit/native.ts` (Expo Go has no module); self-check `node src/healthkit/import.check.ts`". Data Rules: dedupe line mentions the overlap check.
- [ ] **Step 3:** `docs/HANDOFF.md` — RA-3 status, open follow-ups: segments ticket, RA-12 source-choice note, RA-21 zones recalculation.
- [ ] **Step 4: Commit** — message: `docs: RA-3 HealthKit import`

---

### Task 9: Device test (Bar, new dev build)

Prereqs: Task 1 build installed, Task 2 migration run in Supabase. `npx expo start --dev-client`.

- [ ] Log out and back in → Health screen → Connect → iOS prompt lists all 10 categories → allow all → "Importing N / M runs" → Dashboard shows real runs.
- [ ] Run Detail of a Watch run: distance, time, HR, splits, cadence, elevation, weather, zones look right vs. the Fitness app.
- [ ] Kill + reopen → nothing re-imported (no duplicates).
- [ ] Record a short run (or wait for the next) → pull down on All runs → it appears.
- [ ] Edit an imported run + set a type → pull to refresh → edit and type kept.
- [ ] A run that's in Health twice (Watch + Strava) shows once.
- [ ] Airplane mode → pull to refresh imports → back online → runs reach Supabase.
- [ ] "Not now" path: delete the app, reinstall the dev build, log in → Health screen → "Not now" → Dashboard works with no runs; killing + reopening does **not** show the Health screen again; Settings shows "Connect Apple Health" → tapping it opens the Health screen → Connect imports.
- [ ] Settings after access was granted (or refused in the iOS prompt) shows the "Runs missing?" instructions, not the Connect button.
