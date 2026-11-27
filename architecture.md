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
scripts/
  gen-shoe-catalogue.mjs       ← RA-8: builds migrations/2026-11-24-shoe-catalogue.sql from the spec appendix (`node scripts/gen-shoe-catalogue.mjs`)
app/
  _layout.tsx                  ← root layout: splash hold + auth gate (Stack.Protected)
  index.tsx                    ← picks the screen after login: login → health-access (prompt not shown, not skipped) → personal-info (profile incomplete) → dashboard
  health-access.tsx            ← "Connect Apple Health" → iOS prompt → first import with progress → back to index (or back to Settings)
  personal-info.tsx            ← RA-11 form after onboarding; RA-10 edit from the More profile card (?mode=edit)
  hr-zones.tsx                 ← RA-9 zone method picker after personal info; More → Heart-rate zones (?mode=edit)
  shoes/                       ← RA-8: index (My shoes, ?retired=1), edit (Add / Edit shoe), past-runs (assign runs after adding), [id] (shoe page)
  login.tsx                    ← email/password, Apple, Google
  signup.tsx                   ← first + last name, email, password → "check your email"
  forgot-password.tsx          ← request reset link
  reset-password.tsx           ← deep-link target: set new password
  auth-callback.tsx            ← deep-link target: email confirmation
  (tabs)/
    _layout.tsx                ← bottom tab bar (Insights, Health, Dashboard, Runs, More); opens on Dashboard
    insights.tsx               ← Coming soon (RA-45 Smart Insights later)
    health.tsx                 ← Apple Health trend cards (RA-29)
    dashboard.tsx              ← Dashboard (running only)
    runs.tsx                   ← Runs tab (screen title "All runs")
    more.tsx                   ← profile card + settings rows
  insight/[key].tsx           ← RA-29 metric detail (Month / 3 months / Year / All)
  insights-edit.tsx            ← RA-29 hide / reorder metrics (saved in profiles.insights_layout)
  run/
    [id].tsx                   ← Run Detail screen (+ compare sheet)
  compare/
    result.tsx                 ← Comparison screen (?a=<runId>&b=<runId>)

src/
  components/                  ← RunCard, RunPickerList (shared month-grouped list pieces + run picker), CompareView, Chart, SplitsTable, SegmentsTable, ShoeCard (logo, name, meter), ShoeLogo (brand logo / initials + ColorDot), ListPicker (modal list with "Other…")
  api/                         ← supabase.ts (client), auth.ts, authErrors.ts, sync.ts (push/pull rows), shoes.ts (catalogue fetch, 8 s timeout; logo URL) — the ONLY code that talks to Supabase
  store/                       ← useAuthStore (also drives the data lifecycle), useRunStore, useRunTypeStore, useProfileStore, useInsightsStore, useShoeStore (Zustand)
  shoes/                       ← RA-8 pure: shoes.ts (distance, percent / level, stats, colours, default fill, past-runs maths, `shoeProblem`; `node src/shoes/shoes.check.ts`); alerts.ts (`checkShoeAlerts`, `editShoe` — uses Alert + stores, not pure)
  db/                          ← schema.ts (SQLite tables), queries.ts (reads/writes + outbox), merge.ts (pure, `node src/db/sync.check.ts`), sync.ts (syncNow)
  insights/                    ← RA-29 pure: metrics.ts (catalogue, groups), summary.ts (buckets, compare, sleep nights, card text, layout; `node src/insights/summary.check.ts`)
  healthkit/                   ← native.ts (lazy module load), permissions.ts, importRuns.ts, insights.ts (live Insights reader), bodyData.ts (personal-info prefill); pure: mapWorkout.ts, dedupe.ts (`node src/healthkit/import.check.ts`)
  types/                       ← index.ts (Run, RunType, User interfaces)
  utils/                       ← format.ts, chart.ts, stats.ts, zones.ts (pure zone math, `node src/utils/zones.check.ts`), compare.ts (metrics + per-row "better" rule), profile.ts (pure profile + HRmax logic, `node src/utils/profile.check.ts`)
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
  weather, hrHist, hrCurve    // hrHist = seconds at each bpm (RA-9); hrCurve = HR chart line, 80 × [min, max] bpm; see src/types/index.ts
  edits?: RunEdits            // manual edits; the other fields already include them
  shoeId: string | null       // shoes.id (RA-8); null = no shoe
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

`profiles` (one row per user, created by the signup trigger): `unit`, `first_name`, `last_name`, `dob`, `sex` (`female` / `male` / `undisclosed` = "Prefer not to say"), `height_cm`, `weight_kg`, `resting_hr`, `vo2max`, `hr_max`, `hr_max_manual`, `zone_method` / `lthr` / `zone_bounds` (RA-9, see HR zones), `insights_layout` (RA-29: `{hidden, order}` jsonb). Metric only until RA-6.

- **Form** (`app/personal-info.tsx`): required first name, last name, DOB (red `*`); the rest optional. Prefill per field: saved value → Apple Health (`readBodyData`) → sign-in name (`signInInfo`: `first_name`/`last_name` from signup or Apple, else the old `name` / Google `full_name` split at the first space).
- **Shown** whenever `isComplete(profile)` is false (first name + last name + DOB). On a phone with no local profile row, `index` waits for one sync first, so a profile filled on another device skips the form.
- **HRmax:** saved `hr_max` is either the user's own value (`hr_max_manual = true`) or the highest `max_hr` of all runs (never the 220 − age estimate). After each import a higher run raises it unless manual (`nextAutoHrMax`). Zones use `effectiveHrMax` = saved → highest from runs → 220 − age → 190.

### HR zones (RA-9)

- **Stored per run:** `hr_hist` = seconds at each bpm (floored: zone starts are whole bpm, so 156.6 stays below 157 as in Fitness), built at import with the same time weighting as avg HR, paused time excluded (~0.5–1 KB/run). Zone totals are **never stored**, so changing the zones re-shows every past run instantly, offline and on every device, with no Apple Health re-read.
- **Profile:** `zone_method` (`hrmax` | `hrr` | `lthr` | `manual`; null = not chosen yet → onboarding shows the picker, zones use `hrmax` meanwhile), `lthr`, `zone_bounds` (Manual: 4 bpm where Z2–Z5 start).
- **Methods** (`src/utils/zones.ts`, integer percents, whole bpm): % Max 60/70/80/90 % × HRmax · Reserve rest + 60/70/80/90 % × (HRmax − rest) · LTHR 85/90/95/100 % × LTHR · Manual as typed (40–230, increasing). A method whose value is missing falls back to % Max. A bpm exactly on a start belongs to the upper zone.
- **One source:** `useZoneStarts()` (`src/store/useProfileStore.ts`) → `zoneTimes(run.hrHist, starts)` / `zoneRangeLabel` / `computePrimaryZone`. Used by the run's Heart Rate screen, Run Detail's Primary zone and Compare.
- **Onboarding:** Health + first import → Personal info → HR zones → Dashboard (`app/index.tsx`). The import runs first so the picker previews zones at HRmax from real runs.
- **Picker** (`app/hr-zones.tsx`): 4 vertical columns on one bpm axis; card = explanation + ranges (Manual: "starts at" −/+ fields, "Start from" chips); confirm pop-up with the ranges before saving.

### Manual Run Edits

The Run Detail **Edit** button fixes bad HealthKit readings (name, distance, time, avg/min/max HR, elevation). Pace is never stored — always `timeSec / distanceKm`.

- Edits live in `runs.edits` (jsonb, e.g. `{"distanceKm":10.02,"avgHr":151}`); HealthKit values stay untouched in their own columns.
- Displayed run = HealthKit values + `edits` on top (`rowToRun` in `src/db/merge.ts`).
- Saving a value equal to the HealthKit value removes that edit (`diffEdits`). Revert = `edits = {}` (no UI yet).
- HealthKit imports insert-if-missing, so they never touch `edits`, `type_id`, `needs_type` or `notes` (tripwire in `src/db/sync.check.ts`).
- Splits, segments, the HR histogram and charts stay on the recorded HealthKit data (not rescaled by edits).

### Run types (RA-39)

- **Set the type:** every change goes through `useRunStore.setType(ids, typeId)` → `writeChange('runs', 'update', { id, type_id, needs_type: false })` per run → `load()` → `syncNow()` (offline-safe, never renames). One function for one run or many.
- **Picker:** `pickRunType(title, current, onPick)` in `src/components/RunPickerList.tsx`, the native `ActionSheetIOS` (same `pick()` as the All runs filters): Unclassified + the user's types, `✓` on `current` (`undefined` = no ✓, bulk). RA-15's **Change** button reuses it.
- **Where:** Run Detail type pill (type colour, "Unclassified ▾" grey); Dashboard New run card; All runs **Select** mode (no limit, separate from Compare's 2-run mode) with Select all / Deselect all and **Set type** on the selected runs the current filter shows. The type filter has an **Unclassified** option (`UNCLASSIFIED` sentinel; `null` = all types).
- **New runs must be answered:** `runs.needs_type` (bool, default false). The import sets it when the run started after the Supabase account was created (`needsType(startedAt, session.user.created_at)` in `src/healthkit/mapWorkout.ts`), so pre-signup history never asks and a run made while logged out still asks after the next login. While any run has it, a lime card tops the Dashboard (oldest first, "1 of N", **Choose type**; 2+ → **Set all N ›** opens All runs in Select mode with those runs checked, via the `bulk` route param). Any `setType` clears it.

### Sync (RA-34)

- **Write:** `writeChange(tbl, 'insert' | 'update', row)` updates the local row and adds a `pending_ops` row in one SQLite transaction; the store reloads, then `syncNow()` runs in the background.
- **Push:** ops oldest-first. Insert = upsert ignoring duplicates (runs on `user_id,id`), update = only the patched fields. Network/401/408/429/5xx → stop, retry next sync. Other errors, or an update matching no row → op marked `failed` (kept, skipped).
- **Pull:** per table, rows with server `updated_at` ≥ last pull − 60 s (keyset paging, 1000/page). Rows with unsent *updates* are skipped (local wins); a pending insert for a row the cloud already has is dropped in favour of the cloud row.
- **When:** login, app foreground, after each change. Single-flight; never throws.
- **Logout:** More (Log out) pushes first and warns if changes are unsent; an explicit logout or account deletion then runs `clearAll()` (an epoch counter stops a sync that was still running). A forced sign-out (e.g. rejected refresh token) only empties the stores, so unsent edits survive and push when the same user logs back in. Local data has an `owner`; a different user logging in starts clean.
- **Limits:** last write wins per field; `edits` merges as one field.
- **Tables:** `profiles` → `shoes` → `run_types` → `runs` (parents first: `runs.shoe_id` and `run_types.default_shoe_id` point at `shoes`). `profiles` is keyed by `user_id` in the cloud and by `id` (= user id) locally; `cloudKey` / `fromCloud` in `src/db/merge.ts` map between them. SQLite schema v9.

### Shoes (RA-8)

Spec: `docs/superpowers/specs/2026-11-23-shoes-design.md`. Plan: `docs/superpowers/plans/2026-11-24-shoes.md`.
- **Per user (synced):** `shoes` (`id`, `brand`, `model`, `name`, `color`, `in_use_from`, `limit_km`, `extra_km`, `retired`, `alert_level` 0/90/100, `card_dismissed` 0/90/100, `updated_at`; RLS own rows). `runs.shoe_id` (one shoe per run) and `run_types.default_shoe_id` (at most one default per type), both nullable, `on delete set null`. SQLite v9 adds the table and both columns (checks the real column, like v8).
- **Catalogue (shared, read-only):** `shoe_brands` (`name`, `sort`) and `shoe_models` (`brand_id`, `name`, `recommended_km`): 21 brands, 284 models, no version numbers in names. `select` for `authenticated`, no write policies (SQL Editor only). Seed `supabase/migrations/2026-11-24-shoe-catalogue.sql` is generated by `scripts/gen-shoe-catalogue.mjs` from the spec appendix. The app fetches it only when Add shoe opens (`src/api/shoes.ts`, 8 s timeout); offline or on error brand and model are typed. Not stored in SQLite.
- **Logos:** public Storage bucket `brand-logos`, file = brand name lowercase, non-alphanumerics → `-` (`nike.png`, `new-balance.png`). `ShoeLogo` loads it with `Image`; a missing file shows the brand's initials.
- **Computed, never stored:** shoe distance = sum of its runs' `distanceKm` (edits applied) + `extra_km`; percent; level (90 / 100); run count, average pace, last used (`src/shoes/shoes.ts`).
- **Default shoe:** `setType` fills `shoe_id` from the type's default only on runs with no shoe (and only if the default is active). It writes the shoe as its own outbox op, next to the type op. Changing one run's shoe never changes the default. Retire clears the default on every type that points to the shoe.
- **Alerts:** a shoe whose level rises above `alert_level` shows one pop-up (90 %: OK · 100 %: Retire / Close), then `alert_level` is saved, so it is not repeated on another phone. `card_dismissed` does the same for the Dashboard card. `checkShoeAlerts()` runs after a run gets a shoe, after `setType`, after the past-runs step and after a shoe is saved.
- **`editShoe(id, patch)`** (`src/shoes/alerts.ts`) is the one save path for editing an existing shoe: a new limit or extra km lowers the remembered alert levels (so alerts can fire again), then the check runs.
- **Invalid writes:** the store refuses a bad shoe (`shoeProblem` in `shoes.ts`: empty brand / model / in-use-from, limit ≤ 0, extra km < 0), so a bad op never enters the outbox (it would be marked `failed` for good).
- **HealthKit import:** inserts leave `shoe_id` out when it is null, so a re-import never touches a run's shoe.
- **Past runs:** a new shoe with an "in use from" before today offers the shoe-less runs since then (all ticked); Done assigns them and saves `extra_km = typed distance − ticked runs` (never below 0).
- **Not built:** shoe photos, deleting a shoe (Edit covers mistakes), filtering runs by shoe, km / mi.

### Insights (RA-29)

The Insights tab shows 25 Apple Health metrics in 6 groups (heart, fitness, running form, sleep, body, activity). Spec: `docs/superpowers/specs/2026-11-23-health-data-design.md`.
- **Read live, nothing stored.** `src/healthkit/insights.ts` reads HealthKit; `useInsightsStore` caches the last 91 days in memory (re-read on focus/foreground at most every 10 min, pull-to-refresh forces it). The detail screen reads its own period (Month / 3 months / Year / All) directly.
- **Only the layout is stored:** `profiles.insights_layout` (`{hidden, order}`), changed on the Edit screen through `writeChange` + `syncNow`.
- A metric with no data is hidden on the tab (and marked "No data in Health" in Edit). Denied permission looks the same as no data, so the tab shows "Allow Apple Health access…".
- Pure maths (buckets, 30-vs-prior-30 compare, sleep nights, card text) lives in `src/insights/summary.ts`.

### HealthKit import (RA-3)

- **Permission:** one read-only prompt for workouts, HR, distance, steps and body data (DOB, sex, height, weight, resting HR, VO2max). `needsHealthPrompt()` asks iOS whether it is still to come (per install). iOS never reveals a refused *read*, so refused = no data. "Not now" is stored as `health_skipped` in `sync_state`; Settings offers Connect while iOS can still prompt.
- **When:** after the Health screen's Connect, then on login / app foreground (after `syncNow()`, so cloud runs are known) and on pull-to-refresh in All runs. Single-flight; never throws; does nothing until the prompt has been shown.
- **What:** anchored workout query (running only, anchor `healthkit_anchor` in `sync_state`). Workouts < 0.1 km or < 60 s are skipped. Every detail (splits, HR min/avg/max, HR histogram, HR curve, cadence, elevation, weather) is computed once at import by `mapWorkout` and stored; `segments` stay null (follow-up ticket).
- **Duplicates:** same UUID already saved → skip. Same run written by several apps (Watch + Strava) → overlapping time range = duplicate; the Apple Watch copy wins, else the earliest (`pickNew`). User source choice → RA-12.
- **Sources:** distance and step samples are taken only from the workout's own source (iPhone and Watch both log them); HR from all sources.
- **Anchor rule:** saved at the end of a successful import, and only if an anchor already existed or the query returned workouts. An interrupted import re-reads and skips what was saved. An anchor saved while access was refused would otherwise hide the whole history once access is turned on.
- **Expo Go:** the native module is imported lazily (`src/healthkit/native.ts`), so Expo Go runs without it: no Health screen, import is a no-op.
- **Zones** are not stored: the import saves `hr_hist` (seconds per bpm), and zones are computed on screen (see HR zones).
- **HR chart:** the import saves `hr_curve`: the run's active time cut into 80 slices, [min, max] bpm per slice (~1 KB). HR during pauses is left out, so the x axis is active time like the splits; an empty slice copies the one before. `HrRangeBarsChart` draws it on Run Detail and the Heart Rate screen. No HR → null → no chart (never a generated line).
- **Matches Fitness:** splits = Apple's own km segment events (type 7) minus pauses (fallback: rebuilt from distance samples); HR avg/min/max = the workout's HR statistic; calories = `totalEnergyBurned` (active kcal); time/elevation/temperature/calories truncated like Fitness; `date` in the run's `HKTimeZone`.
- **Intervals:** custom-workout steps = workout `activities` → `segments` "Step N" (+ "Open"), coloured rep/rest by pace group. HealthKit's API here has no step names.
- **Re-import:** mapping changes don't touch runs already saved (insert-if-missing). During development, delete cloud runs and log out/in to re-import.

---

## Phase 2 — Backend + Strava (started 2026-11-08)

**Decision (2026-11-08): Supabase for auth + cloud DB; FastAPI only for ML.** Supabase gives auth (email, Google, Apple), hosted Postgres and per-user Row Level Security without writing a server, so cross-device sync works immediately. Data is plain Postgres → portable if we move to a custom backend later. The lock-in is auth (user accounts).

- **Supabase** (project `cbbalftydzsfbqategub`, region Frankfurt, free tier)
  - **Auth** — email+password (confirmation required), native Google, native Sign in with Apple (App Store 4.8 requires Apple when Google is offered), in-app account deletion (App Store 5.1.1). Spec: `docs/superpowers/specs/2026-11-08-user-auth-design.md`.
  - **Postgres** — full copy of every run (summary, splits, segments, HR histogram, weather) + profile, run types, classifications, notes, overrides. All tables reference `auth.users(id) ON DELETE CASCADE` and use RLS. Run summaries kept forever (~1–2 KB/run); raw HR/GPS streams not stored (only the 80-slice HR curve). Offline: app works on locally cached data and syncs when back online.
- **Boundary rule:** all Supabase calls live in `src/api/`. Screens and stores never import `@supabase/supabase-js`, so swapping to FastAPI later only rewrites `src/api/`.
- **FastAPI (Python)** — only for `POST /suggest-type` (scikit-learn ML classifier), added next to Supabase later.
- **Strava OAuth** — register developer app, fetch `GET /athlete/activities`, map to Run schema (needs a server-side secret → Supabase Edge Function or FastAPI)
- **Garmin / Coros** — no API needed; both write to Apple Health automatically

**Foundation order:** RA-18 auth (`feature/user-auth`) → RA-34 DB (`feature/manage-db`) → RA-3 HealthKit (`feature/healthkit`) → RA-11 personal info (`feature/add-personal-info`) → RA-9 HR zones (`feature/hr-zones`).

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
