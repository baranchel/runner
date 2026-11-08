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
  expo-sqlite (local)  ←── stores run type classifications + notes + manual edit overrides
        │
        ▼
  Zustand stores       ←── in-memory state (runs, types, filters, user prefs)
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
```

### Development Workflow

1. **Expo Go** — build all screens with mock data (no native build needed)
2. **EAS dev build** — one-time `eas build --profile development --platform ios` when wiring real HealthKit data; install `.ipa` on iPhone, then live reload over Wi-Fi continues
3. **EAS production build** — `eas build --profile production --platform ios` → TestFlight / App Store

### File Structure

```
app/
  _layout.tsx                  ← root layout: font loading, auth gate
  index.tsx                    ← redirects to (tabs)/dashboard
  login.tsx                    ← auth screen
  (tabs)/
    _layout.tsx                ← bottom tab bar
    dashboard.tsx
    runs.tsx
    compare.tsx
    settings.tsx
  run/
    [id].tsx                   ← Run Detail screen
  settings/
    manage-types.tsx
    connected-apps.tsx

src/
  components/                  ← RunCard, FilterBar, TypeChip, MetricCard, Chart, TypePicker, Drawer
  store/                       ← useRunStore, useRunTypeStore, useUserStore (Zustand)
  db/                          ← schema.ts, queries.ts (expo-sqlite)
  healthkit/                   ← permissions.ts, sync.ts
  types/                       ← index.ts (Run, RunType, User interfaces)
  utils/                       ← format.ts, chart.ts, filters.ts, stats.ts
```

### Data Model

```ts
interface RunType {
  id: string       // e.g. 'long', 'tempo'
  name: string     // e.g. 'Long Run'
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
  id: string
  healthkitUuid: string   // deduplication key
  typeId: string | null   // null until classified
  name: string            // default "<TypeName>: <Distance>km", user-editable
  date: string            // 'YYYY-MM-DD'
  distanceKm: number
  timeSec: number
  avgHr: number | null
  maxHr: number | null
  elevGain: number | null
  cadence: number | null
  source: 'apple_health' | 'strava' | 'garmin'  // Phase 1 only produces 'apple_health'
  notes: string | null
  segments: Segment[] | null  // null for unstructured runs (easy/long); warmup→reps→cooldown for tempo/interval
  splits: Split[]             // per-km splits, always present
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

SQLite stores Run + RunType. HealthKit is read-only — never written back to.

### Manual Run Edits (planned — build with the DB layer)

The Run Detail **Edit** button lets the user fix bad HealthKit readings (name, distance, time, avg/min/max HR, elevation). Pace is never stored — always `timeSec / distanceKm`. Currently (pre-DB) edits mutate the mock run in memory and are lost on restart.

Because HealthKit is read-only, edits are stored as **overrides** layered on top of the HealthKit data:

```sql
CREATE TABLE run_overrides (
  healthkit_uuid TEXT PRIMARY KEY,   -- same key used for dedup
  name TEXT, distance_km REAL, time_sec INTEGER,
  avg_hr INTEGER, min_hr INTEGER, max_hr INTEGER, elev_gain INTEGER
);  -- NULL column = use the HealthKit value
```

- **Load:** HealthKit run → apply non-null override columns → store.
- **Save:** upsert only the edited fields into `run_overrides`, then update `useRunStore`.
- **Re-sync:** HealthKit sync never touches `run_overrides`, so edits survive.
- **Revert to original:** delete the row.
- Splits, segments, zones and charts stay on the recorded HealthKit data (not rescaled by edits).
- When done: remove the in-place mutation in `app/run/[id].tsx` (marked `ponytail:`).

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
