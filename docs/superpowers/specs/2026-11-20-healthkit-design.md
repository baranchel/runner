# RA-3 Apple Connectivity — Design (2026-11-20)

Branch `feature/healthkit`. Jira RA-3. Reads running workouts (and, as a helper for RA-11, body data) from Apple HealthKit and saves them through the RA-34 data layer. HealthKit is **read-only**.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | RA-3 imports runs. Body data gets only a `readBodyData()` helper (not called yet); RA-11 uses it. All read permissions are asked in **one** prompt now. | iOS shows each permission prompt once; RA-11 decides the profile columns. |
| 2 | Keep `runs.date` (`'YYYY-MM-DD'`, local day). Add `started_at` (full start time). | Screens untouched; `started_at` breaks same-day ties and lets Run Detail show the time. |
| 3 | Compute everything at import (splits, HR min/avg/max, cadence, zones, elevation, weather) and store it. First import shows progress. | Matches "full copy of every run" (HANDOFF decision 3); one code path. |
| 4 | `segments` stays `null` in RA-3 → follow-up ticket. | Apple stores intervals differently per watchOS version / app. |
| 5 | Duplicates (same run written by Watch + Strava etc.): skip a workout whose time range overlaps an already-saved or same-batch run; Apple Watch copy wins. | Different UUIDs per copy, so UUID dedupe misses them. |
| 6 | "Which source wins" user choice → **RA-12 My Devices** (note to add to that ticket after Bar approves wording). | One choice instead of a prompt per duplicate. |
| 7 | Runs deleted in Apple Health stay in Chronodrom. | Not in the story; the user may have added type/notes. |

## Files

`src/healthkit/`
- `permissions.ts` — `requestHealthAccess()`: one `requestAuthorization` for workouts, heart rate, running distance, step count, date of birth, biological sex, height, body mass, resting HR, VO2max. `needsHealthPrompt()`: iOS request status (`shouldRequest`) → no app-side flag; per-install by nature, so a new phone shows the screen again.
- `mapWorkout.ts` — pure: `(workout, hrSamples, distanceSamples, stepSamples, hrMax) → Run`.
  - `id` = `healthkitUuid` = workout UUID; `source: 'apple_health'`; `typeId: null`; `notes: null`; `segments: null`.
  - `date` = local `YYYY-MM-DD` of start; `startedAt` = ISO start.
  - `distanceKm`, `timeSec` from the workout totals.
  - `avgHr` (time-weighted), `minHr`, `maxHr` from HR samples; all `null` if none.
  - `splits`: cumulative distance samples → time per km; last partial split (e.g. 5.5); avg HR per split (null if none).
  - `cadence`: total steps ÷ minutes (null if no steps).
  - `zones`: seconds per zone 1–5 using the `zones.ts` bounds with `MOCK_HR_MAX` (RA-21 recalculates later).
  - `elevGain` from `HKElevationAscended` metadata (m); `weather` from `HKWeatherTemperature` / `HKWeatherHumidity` metadata (null if missing).
  - `name` = `Run: <distanceKm, 1 decimal>km` (unclassified; the `<TypeName>:` form from `types/index.ts` applies once a type is picked — renaming on classify is not part of RA-3).
- `dedupe.ts` — pure: `pickNew(candidates, existing)` drops UUIDs already saved and time-overlapping runs; among overlapping candidates the Apple Watch source wins, else the first.
- `importRuns.ts` — `importNewRuns(onProgress?)`:
  1. Anchored workout query (running only) from the anchor in `sync_state` (`healthkit_anchor`); none → full history.
  2. Skip `distance < 0.1 km` or `duration < 60 s`.
  3. `pickNew` against runs in SQLite.
  4. Per workout: query HR / distance / step samples in its time range → `mapWorkout` → `writeChange('runs', 'insert', runToRow(run))`. Every 20 runs: `useRunStore.getState().load()` + `onProgress(done, total)`.
  5. After all: save the new anchor, `load()`, `syncNow()`.
  - Single-flight: a call while one runs returns the same promise.
- `bodyData.ts` — `readBodyData()` → `{ dob, sex, heightCm, weightKg, restingHr, vo2max }`, each nullable. Not called in RA-3.
- `import.check.ts` — `node` self-check (see Tests).

Screens / wiring
- `app/health-access.tsx` — explains why ("Your runs and body data from Apple Health, read-only — we never write to it"), **Connect** (→ `requestHealthAccess()` → first import with progress "Importing N / M runs" → Dashboard) and **Not now** (→ Dashboard). Styled per `FRONTEND_SPEC.md`.
- `app/_layout.tsx` / `app/index.tsx` — logged in + `needsHealthPrompt()` → `health-access`; RA-11 later inserts its form between it and the Dashboard.
- App open + return to foreground (AppState `active`) → `importNewRuns()` silently.
- `app/(tabs)/runs.tsx` — pull-to-refresh → `importNewRuns()`.
- `app/(tabs)/settings.tsx` — "Apple Health" row: how to enable access (iOS Settings → Health → Data Access & Devices → Chronodrom). No connected/not-connected status (iOS doesn't reveal read access). **Remove** the dev "Load sample runs" button.
- `useRunStore` — remove `seedSampleRuns`; `src/db/merge.ts` — remove `seedRows`; drop the `MOCK_RUNS` import from the store (check whether `mockData.ts` is still used elsewhere; delete it if not).
- `app.json` — `@kingstinct/react-native-healthkit` config plugin, `NSHealthShareUsageDescription`, HealthKit entitlement. **New EAS dev build required.**

DB
- Supabase: `alter table public.runs add column started_at timestamptz;` (nullable; sample rows have none). Update `supabase/schema.sql`.
- SQLite: schema `VERSION = 2`, `if (v < 2) ALTER TABLE runs ADD COLUMN started_at TEXT`.
- `Run.startedAt: string | null`; `rowToRun` / `runToRow` map it; list sorts use `date` then `startedAt` desc.

## Edge cases

- **Denied = no data** (iOS hides read denial): import saves nothing, app works as today.
- **Interrupted first import:** anchor saved only at the end; next run re-reads, saved UUIDs skipped. No loss, no doubles.
- **Offline:** import is local; rows wait in the outbox, `syncNow()` sends later.
- **Logout:** `clearAll()` wipes `sync_state` incl. anchor → next login re-reads history; existing runs skipped by UUID / overlap.
- **Edits / type / notes:** insert-if-missing never touches existing rows.
- **No HR samples:** HR fields and zones `null`.

## Tests

- `node src/healthkit/import.check.ts`: mapping a fake workout gives expected splits (incl. partial), time-weighted avg HR, min/max, cadence, zones; no-HR workout → nulls; dedupe drops saved UUIDs, keeps the Watch copy when times overlap, keeps non-overlapping runs.
- `npx tsc --noEmit` clean; `node src/db/sync.check.ts` still passes.
- iPhone (new dev build): permission prompt; first import of real history with progress; reopen imports nothing new; new run appears after pull-to-refresh; editing an imported run survives a re-import; "Not now" path works; Watch + Strava duplicate shows once; airplane-mode import then sync when online.

## Out of scope

Segments (follow-up ticket), background sync, writing to Health, deletes from Health, source-preference choice (RA-12), body data in the profile (RA-11), real HR max / zones (RA-9 / RA-21).
