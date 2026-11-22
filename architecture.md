# Chronodrom — Architecture

## What We're Building

An iOS-first running tracker that reads past workouts from Apple HealthKit, lets you classify runs by type, and lets you filter and compare them. No real-time GPS tracking.

Development machine: Windows, no Mac. Builds via EAS cloud service.

---

## Phase 1 — MVP (current)

### Stack

| Concern | Decision |
|---|---|
| Framework | Expo ~54, managed workflow |
| Navigation | expo-router (file-based routing) |
| State | Zustand |
| Local DB | expo-sqlite (local cache / offline) |
| Backend (Phase 2) | Supabase — Auth + Postgres, called only from `src/api/` |
| HealthKit | @kingstinct/react-native-healthkit |
| Charts | react-native-svg |
| Fonts | expo-font (Inter + JetBrains Mono) |
| Platform | iOS only |

### Architecture Diagram

```
iPhone
  └── Apple HealthKit  ←── source of truth for all run metrics
        │
        ▼
  @kingstinct/react-native-healthkit
        │  maps HKWorkout → Run, deduplicates
        ▼
  expo-sqlite (local)  ←── phone's offline copy of runs + run types, plus the outbox (pending_ops)
        │      ▲
        │      └── syncNow() ⇄ Supabase Postgres (source of truth, RLS per user)
        ▼
  Zustand stores       ←── in-memory state (runs with edits applied, run types)
        │
        ▼
  expo-router screens  ←── read from stores, write back on user action
```

### Dependencies

```
expo-router
expo-sqlite
expo-font
expo-splash-screen
expo-status-bar
react-native-svg
react-native-safe-area-context
react-native-screens
react-native-gesture-handler
react-native-reanimated
@kingstinct/react-native-healthkit
zustand
@supabase/supabase-js
@react-native-async-storage/async-storage   ← Supabase session storage
expo-apple-authentication
@react-native-google-signin/google-signin
expo-dev-client
expo-crypto                                  ← WebCrypto shim for Supabase PKCE (src/api/supabase.ts) + Apple nonce
ws (dev)                                     ← v8 for Expo's tunnel (@expo/ws-tunnel); RN/Metro keep their own v7
```

### Development Workflow

1. **Expo Go** — build all screens with mock data (no native build needed)
2. **EAS dev build** — set up 2026-11-18 (`eas.json`, iPhone registered). Needed for native Google/Apple sign-in and HealthKit. Rebuild only when native packages or `app.json` change; run with `npx expo start --dev-client`. Cloud builds read env vars from EAS (`eas env:create`), not `.env`.
3. **EAS production build** — `eas build --profile production --platform ios` → TestFlight / App Store (add the env vars for `--environment production` first)

**Auth email links (confirm, reset):** Supabase only redirects to addresses in its Redirect URLs (`chronodrom://**`, `exp://**`, `exps://**`) and **rejects any address whose host is an IP**. So in Expo Go they only work with `npx expo start --tunnel` (`exps://…on.expo.app`). In the dev build they use `chronodrom://`. Email is sent through custom SMTP (Gmail app password for dev; the built-in mailer is rate-limited and only delivers to team members, so production needs a real provider with its own domain).

### File Structure

```
supabase/
  schema.sql                   ← cloud tables, RLS, triggers (run by hand in the Supabase SQL Editor)
  migrations/                  ← one-off changes to an existing cloud DB (run by hand, e.g. 2026-11-20-started-at.sql)
app/
  _layout.tsx                  ← root layout: splash hold + auth gate (Stack.Protected)
  index.tsx                    ← picks the screen after login: login → health-access (prompt not shown, not skipped) → personal-info (profile incomplete) → dashboard
  health-access.tsx            ← "Connect Apple Health" → iOS prompt → first import with progress → back to index (or back to Settings)
  personal-info.tsx            ← RA-11 form after onboarding; RA-10 edit from Settings (?mode=edit)
  login.tsx                    ← email/password, Apple, Google
  signup.tsx                   ← first + last name, email, password → "check your email"
  forgot-password.tsx          ← request reset link
  reset-password.tsx           ← deep-link target: set new password
  auth-callback.tsx            ← deep-link target: email confirmation
  (tabs)/
    _layout.tsx                ← bottom tab bar (Insights, Running, All runs, Compare, You)
    insights.tsx               ← placeholder until Figma "Data & insights" is built
    dashboard.tsx              ← "Running" tab
    runs.tsx                   ← "All runs" tab
    compare.tsx
    settings.tsx
  run/
    [id].tsx                   ← Run Detail screen (+ compare sheet)
  compare/
    result.tsx                 ← Comparison screen (?a=<runId>&b=<runId>)

src/
  components/                  ← RunCard, RunPickerList (shared month-grouped list pieces + run picker), CompareView, Chart, SplitsTable, SegmentsTable
  api/                         ← supabase.ts (client), auth.ts, authErrors.ts, sync.ts (push/pull rows) — the ONLY code that talks to Supabase
  store/                       ← useAuthStore (also drives the data lifecycle), useRunStore, useRunTypeStore, useProfileStore (Zustand)
  db/                          ← schema.ts (SQLite tables), queries.ts (reads/writes + outbox), merge.ts (pure, `node src/db/sync.check.ts`), sync.ts (syncNow)
  healthkit/                   ← native.ts (lazy module load), permissions.ts, importRuns.ts, bodyData.ts (personal-info prefill); pure: mapWorkout.ts, dedupe.ts (`node src/healthkit/import.check.ts`)
  types/                       ← index.ts (Run, RunType, User interfaces)
  utils/                       ← format.ts, chart.ts, stats.ts, zones.ts, compare.ts (metrics + per-row "better" rule), profile.ts (pure profile + HRmax logic, `node src/utils/profile.check.ts`)
```

### Data Model

```ts
interface RunType {
  id: string       // uuid; one row per type per user (run_types table)
  name: string     // defaults: Race 20 · Tempo 70 · Hills 120 · Easy 170 · Long 220 · Fartlek 270 · Interval 320 (name · hue)
  hue: number      // oklch hue used for color generation
}

interface Segment {
  type: 'warmup' | 'rep' | 'rest' | 'main' | 'cooldown'
  label: string        // e.g. 'Rep 3', 'Tempo', 'Cooldown'
  distanceKm: number
  timeSec: number
  avgHr: number | null
}

interface Split {
  km: number           // 1, 2, … or partial endpoint e.g. 5.5
  timeSec: number      // time for that km segment
  avgHr: number | null
}

interface Run {
  id: string              // uuid; for Apple Health runs = the HealthKit workout UUID (dedup key)
  healthkitUuid: string
  typeId: string | null   // run_types.id; null until classified
  name: string            // default "<TypeName>: <Distance>km", user-editable
  date: string            // 'YYYY-MM-DD', local day of the start
  startedAt: string | null // ISO start time (RA-3); breaks same-day sort ties; null for older rows
  distanceKm: number
  timeSec: number
  avgHr: number | null
  maxHr: number | null
  minHr: number | null
  elevGain: number | null
  cadence: number | null
  source: 'apple_health' | 'strava' | 'garmin'  // Phase 1 only produces 'apple_health'
  notes: string | null
  segments: Segment[] | null  // null for unstructured runs (easy/long); warmup→reps→cooldown for tempo/interval
  splits: Split[]             // per-km splits, always present
  weather, zones              // see src/types/index.ts
  edits?: RunEdits            // manual edits; the other fields already include them
}
```

interface MonthStats {             // computed at runtime by getMonthStats()
  year: number
  month: number           // 1–12
  cutoffDay: number | null // null = full month; set to today.getDate() for mid-month comparison
  runCount: number
  totalDistanceKm: number
  totalTimeSec: number
  avgPaceSecPerKm: number
  avgHr: number | null
}
```

Dashboard usage:
```ts
const today = new Date()
const aug = getMonthStats(runs, 2026, 8, today.getDate())  // Aug through today
const jul = getMonthStats(runs, 2026, 7, today.getDate())  // Jul through same day-of-month
```

Supabase Postgres is the source of truth (`supabase/schema.sql`: `profiles`, `run_types`, `runs`, RLS own-rows, server-stamped `updated_at`, new-user trigger creates the profile + 7 default types). SQLite holds the phone's copy of `profiles`, `runs` + `run_types` (same snake_case columns) and the outbox. HealthKit is read-only — never written back to.

### Profile (RA-11 / RA-10)

`profiles` (one row per user, created by the signup trigger): `unit`, `first_name`, `last_name`, `dob`, `sex` (`female` / `male` / `undisclosed` = "Prefer not to say"), `height_cm`, `weight_kg`, `resting_hr`, `vo2max`, `hr_max`, `hr_max_manual`. Metric only until RA-6.

- **Form** (`app/personal-info.tsx`): required first name, last name, DOB (red `*`); the rest optional. Prefill per field: saved value → Apple Health (`readBodyData`) → sign-in name (`signInInfo`: `first_name`/`last_name` from signup or Apple, else the old `name` / Google `full_name` split at the first space).
- **Shown** whenever `isComplete(profile)` is false (first name + last name + DOB). On a phone with no local profile row, `index` waits for one sync first, so a profile filled on another device skips the form.
- **HRmax:** saved `hr_max` is either the user's own value (`hr_max_manual = true`) or the highest `max_hr` of all runs (never the 220 − age estimate). After each import a higher run raises it unless manual (`nextAutoHrMax`). Zones use `effectiveHrMax` = saved → highest from runs → 220 − age → 190.
- **Known limit:** zone times are computed at import with the HRmax of that moment; the first full import runs before the form, so old runs keep zones from 190 / 220 − age until RA-21 recalculates them.

### Manual Run Edits

The Run Detail **Edit** button fixes bad HealthKit readings (name, distance, time, avg/min/max HR, elevation). Pace is never stored — always `timeSec / distanceKm`.

- Edits live in `runs.edits` (jsonb, e.g. `{"distanceKm":10.02,"avgHr":151}`); HealthKit values stay untouched in their own columns.
- Displayed run = HealthKit values + `edits` on top (`rowToRun` in `src/db/merge.ts`).
- Saving a value equal to the HealthKit value removes that edit (`diffEdits`). Revert = `edits = {}` (no UI yet).
- HealthKit imports insert-if-missing, so they never touch `edits`, `type_id` or `notes`.
- Splits, segments, zones and charts stay on the recorded HealthKit data (not rescaled by edits).

### Sync (RA-34)

- **Write:** `writeChange(tbl, 'insert' | 'update', row)` updates the local row and adds a `pending_ops` row in one SQLite transaction; the store reloads, then `syncNow()` runs in the background.
- **Push:** ops oldest-first. Insert = upsert ignoring duplicates (runs on `user_id,id`), update = only the patched fields. Network/401/408/429/5xx → stop, retry next sync. Other errors, or an update matching no row → op marked `failed` (kept, skipped).
- **Pull:** per table, rows with server `updated_at` ≥ last pull − 60 s (keyset paging, 1000/page). Rows with unsent *updates* are skipped (local wins); a pending insert for a row the cloud already has is dropped in favour of the cloud row.
- **When:** login, app foreground, after each change. Single-flight; never throws.
- **Logout:** Settings pushes first and warns if changes are unsent; an explicit logout or account deletion then runs `clearAll()` (an epoch counter stops a sync that was still running). A forced sign-out (e.g. rejected refresh token) only empties the stores, so unsent edits survive and push when the same user logs back in. Local data has an `owner`; a different user logging in starts clean.
- **Limits:** last write wins per field; `edits` merges as one field.
- **Tables:** `profiles` → `run_types` → `runs`. `profiles` is keyed by `user_id` in the cloud and by `id` (= user id) locally; `cloudKey` / `fromCloud` in `src/db/merge.ts` map between them. SQLite schema v4.

### HealthKit import (RA-3)

- **Permission:** one read-only prompt for workouts, HR, distance, steps and body data (DOB, sex, height, weight, resting HR, VO2max). `needsHealthPrompt()` asks iOS whether it is still to come (per install). iOS never reveals a refused *read*, so refused = no data. "Not now" is stored as `health_skipped` in `sync_state`; Settings offers Connect while iOS can still prompt.
- **When:** after the Health screen's Connect, then on login / app foreground (after `syncNow()`, so cloud runs are known) and on pull-to-refresh in All runs. Single-flight; never throws; does nothing until the prompt has been shown.
- **What:** anchored workout query (running only, anchor `healthkit_anchor` in `sync_state`). Workouts < 0.1 km or < 60 s are skipped. Every detail (splits, HR min/avg/max, zones, cadence, elevation, weather) is computed once at import by `mapWorkout` and stored; `segments` stay null (follow-up ticket).
- **Duplicates:** same UUID already saved → skip. Same run written by several apps (Watch + Strava) → overlapping time range = duplicate; the Apple Watch copy wins, else the earliest (`pickNew`). User source choice → RA-12.
- **Sources:** distance and step samples are taken only from the workout's own source (iPhone and Watch both log them); HR from all sources.
- **Anchor rule:** saved at the end of a successful import, and only if an anchor already existed or the query returned workouts. An interrupted import re-reads and skips what was saved. An anchor saved while access was refused would otherwise hide the whole history once access is turned on.
- **Expo Go:** the native module is imported lazily (`src/healthkit/native.ts`), so Expo Go runs without it: no Health screen, import is a no-op.
- **Zones** use the profile's `effectiveHrMax` at import time (% of HRmax; methods → RA-9); RA-21 recalculates past runs.
- **Matches Fitness:** splits = Apple's own km segment events (type 7) minus pauses (fallback: rebuilt from distance samples); HR avg/min/max = the workout's HR statistic; calories = `totalEnergyBurned` (active kcal); time/elevation/temperature/calories truncated like Fitness; `date` in the run's `HKTimeZone`.
- **Intervals:** custom-workout steps = workout `activities` → `segments` "Step N" (+ "Open"), coloured rep/rest by pace group. HealthKit's API here has no step names.
- **Re-import:** mapping changes don't touch runs already saved (insert-if-missing). During development, delete cloud runs and log out/in to re-import.

---

## Phase 2 — Backend + Strava (started 2026-11-08)

**Decision (2026-11-08): Supabase for auth + cloud DB; FastAPI only for ML.** Supabase gives auth (email, Google, Apple), hosted Postgres and per-user Row Level Security without writing a server, so cross-device sync works immediately. Data is plain Postgres → portable if we move to a custom backend later. The lock-in is auth (user accounts).

- **Supabase** (project `cbbalftydzsfbqategub`, region Frankfurt, free tier)
  - **Auth** — email+password (confirmation required), native Google, native Sign in with Apple (App Store 4.8 requires Apple when Google is offered), in-app account deletion (App Store 5.1.1). Spec: `docs/superpowers/specs/2026-11-08-user-auth-design.md`.
  - **Postgres** — full copy of every run (summary, splits, segments, zones, weather) + profile, run types, classifications, notes, overrides. All tables reference `auth.users(id) ON DELETE CASCADE` and use RLS. Run summaries kept forever (~1–2 KB/run); raw HR/GPS streams not stored yet. Offline: app works on locally cached data and syncs when back online.
- **Boundary rule:** all Supabase calls live in `src/api/`. Screens and stores never import `@supabase/supabase-js`, so swapping to FastAPI later only rewrites `src/api/`.
- **FastAPI (Python)** — only for `POST /suggest-type` (scikit-learn ML classifier), added next to Supabase later.
- **Strava OAuth** — register developer app, fetch `GET /athlete/activities`, map to Run schema (needs a server-side secret → Supabase Edge Function or FastAPI)
- **Garmin / Coros** — no API needed; both write to Apple Health automatically

**Foundation order:** RA-18 auth (`feature/user-auth`) → RA-34 DB (`feature/manage-db`) → RA-3 HealthKit (`feature/healthkit`) → RA-11 + RA-9 personal info & zones (`feature/add-personal-info`).

**Onboarding flow (target):** Signup → Health permission (RA-3) → Personal info form, prefilled from HealthKit (RA-11) → Dashboard.

---

## Phase 3 — Android + Map (future)

- **Android**: swap `@kingstinct/react-native-healthkit` → Health Connect; Apple Maps → Google Maps (API key required)
- **GPS route map**: `HKWorkoutRoute` from HealthKit → `react-native-maps` on Run Detail screen; iOS uses Apple Maps (free), Android uses Google Maps

---

## What Is Not In Scope

- Real-time GPS tracking
- Writing data back to HealthKit
- Web app
- Push notifications
