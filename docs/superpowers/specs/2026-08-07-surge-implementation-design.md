# Chronodrom — Implementation Design

**Date:** 2026-08-07  
**Status:** Approved

---

## What We're Building

An iOS-first running tracker app that:
1. Reads past runs from Apple HealthKit (no real-time GPS tracking in Phase 1)
2. Lets the user manually classify each run by type (Long Run, Tempo, Intervals, Recovery, Race…)
3. Lets the user filter, sort, and compare runs
4. Later: auto-suggests run type via a Python ML backend, integrates Strava, shows GPS route on map, supports Android

Development machine: Windows. No Mac. Builds via EAS cloud service.

---

## Phase 1 — MVP (iOS, HealthKit, local-only)

### Tech Stack

| Concern | Decision | Reason |
|---|---|---|
| Framework | Expo ~54, managed workflow | EAS cloud builds work from Windows; managed = no native code to maintain |
| Navigation | expo-router (file-based) | File = screen; same library used in prior indoor-navigation project |
| State | Zustand | Lightweight global store; handles shared filter/selection state cleanly |
| Local DB | expo-sqlite | Built-in Expo module; no native build required |
| HealthKit | @kingstinct/react-native-healthkit | TypeScript-first, Expo config plugin, actively maintained |
| Charts | react-native-svg | Spec already defines SVG math (genSeries, path builder); sufficient for area/line charts |
| Fonts | expo-font | Load Inter (body) + JetBrains Mono (metrics) from Google Fonts |
| Platform | iOS only | Android deferred to Phase 3 |

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

### File Structure

```
app/
  _layout.tsx                  ← root layout: font loading, auth gate, drawer
  index.tsx                    ← redirects to (tabs)/dashboard
  login.tsx                    ← auth screen (outside tabs)
  (tabs)/
    _layout.tsx                ← bottom tab bar (Dashboard · Runs · Compare · Settings)
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
  components/
    RunCard.tsx                ← reusable run row (used in Dashboard + Runs)
    FilterBar.tsx              ← type chips + date presets
    TypeChip.tsx               ← single chip, active/inactive styles
    MetricCard.tsx             ← stat card (value + label)
    Chart.tsx                  ← reusable SVG area chart (pace / HR / elevation)
    TypePicker.tsx             ← bottom sheet for reclassifying a run
    Drawer.tsx                 ← hamburger side drawer
  store/
    useRunStore.ts             ← runs list, active filters, sort order
    useRunTypeStore.ts         ← run types (id, name, hue)
    useUserStore.ts            ← name, email, unit preference (km/mi)
  db/
    schema.ts                  ← CREATE TABLE for Run and RunType
    queries.ts                 ← all SQLite helper functions
  healthkit/
    permissions.ts             ← request HealthKit read permissions
    sync.ts                    ← fetch workouts → map to Run → insert (dedup by healthkit_uuid)
  types/
    index.ts                   ← Run, RunType, User, ConnectedApp interfaces
  utils/
    format.ts                  ← fmtDuration, fmtPace, fmtDate, fmtDateFull
    chart.ts                   ← genSeries (deterministic LCG), SVG path builder
    filters.ts                 ← applyFilters, sortRuns
```

### Data Model

```ts
interface RunType {
  id: string       // e.g. 'long', 'tempo'
  name: string     // e.g. 'Long Run'
  hue: number      // oklch hue for color generation
}

interface Run {
  id: string
  healthkitUuid: string   // prevents duplicate imports
  typeId: string | null   // null until user classifies
  date: string            // ISO date 'YYYY-MM-DD'
  distanceKm: number
  timeSec: number
  avgHr: number | null
  maxHr: number | null
  elevGain: number | null
  cadence: number | null
  source: 'apple_health' | 'strava' | 'garmin'  // Phase 1 only produces 'apple_health'
  notes: string | null
}

interface User {
  name: string
  email: string
  unit: 'km' | 'mi'
}
```

SQLite stores Run (classification + notes) and RunType. HealthKit is the source of truth for all metrics — never write back to it.

### Data Flow

```
iPhone HealthKit
    │
    ▼
src/healthkit/sync.ts       ← runs once on app open (requires EAS dev build)
    │  maps HKWorkout → Run, deduplicates by healthkitUuid
    ▼
expo-sqlite (local DB)      ← persists classifications and notes
    │
    ▼
Zustand stores              ← loaded into memory on app start
    │  useRunStore, useRunTypeStore, useUserStore
    ▼
Screen components           ← read state, dispatch actions (filter, classify, add notes)
    │
    ▼
expo-sqlite                 ← written immediately on any change
```

### Development Workflow

| Phase | Tool | When |
|---|---|---|
| UI iteration | Expo Go | Building all screens with mock data |
| HealthKit wiring | EAS dev build | One-time `eas build --profile development --platform ios`, install on iPhone, then live reload over Wi-Fi continues |
| Shipping | EAS production build | `eas build --profile production --platform ios` → TestFlight / App Store |

Only need to trigger a new EAS build when adding a new native package. Normal code edits reload instantly.

### Screens

| Screen | Route | Notes |
|---|---|---|
| Auth | `/login` | Login + signup, outside tab navigation |
| Dashboard | `/(tabs)/dashboard` | Weekly stats, type filter chips, recent 4 runs |
| Run List | `/(tabs)/runs` | Full history, multi-select filters, sort |
| Run Detail | `/run/[id]` | Metrics grid, 3 SVG charts, splits, reclassify |
| Compare | `/(tabs)/compare` | Pick 2 runs, side-by-side table with winner highlighting |
| Settings | `/(tabs)/settings` | Units toggle, nav to sub-screens, logout |
| Manage Types | `/settings/manage-types` | Add/edit/delete run types with color swatches |
| Connected Apps | `/settings/connected-apps` | Strava, Apple Health, Garmin, Coros rows |

---

## Phase 2 — Backend + Strava (after MVP)

### FastAPI Python Backend

Hosted on Railway or Render (free tier). The app calls it over REST — no Python runs on the phone.

```
backend/
  main.py
  models/
    run.py          ← Pydantic schemas
    run_type.py
  routes/
    runs.py         ← GET /runs, PATCH /runs/{id}
    run_types.py    ← CRUD
    suggest.py      ← POST /suggest-type (scikit-learn classifier)
  db.py             ← SQLAlchemy + PostgreSQL
```

Key endpoints:
- `POST /suggest-type` — receives `{ distanceKm, timeSec, avgHr }`, returns predicted `typeId`
- `POST /sync` — app pushes unsynced runs for cross-device backup
- `GET /runs` — fetch full history from server

Migration path: add `isSynced: boolean` to local SQLite Run. On app open, push unsynced runs to backend, mark synced. App works fully offline; syncs when connected.

### Strava Integration

1. Register a free Strava developer app at developers.strava.com → get `client_id` + `client_secret`
2. OAuth flow: user taps "Connect" on Connected Apps screen → opens Strava auth in browser → token returned
3. Fetch activities: `GET https://www.strava.com/api/v3/athlete/activities`
4. Map Strava activity fields → Run schema, insert with `source: 'strava'`

Garmin and Coros: both sync to Apple Health automatically. No Garmin/Coros API needed — reading from HealthKit covers them.

---

## Phase 3 — Android + Map (future)

### Android

| iOS (Phase 1) | Android replacement |
|---|---|
| @kingstinct/react-native-healthkit | Health Connect library |
| Apple Maps (free, no key) | Google Maps (requires Google Maps API key) |

Expo and expo-router already support Android — no structural changes needed.

### GPS Route Map

- Data source: `HKWorkoutRoute` in HealthKit (sequence of lat/lng points)
- Display: `react-native-maps` on Run Detail screen
- iOS: Apple Maps, no API key
- Android: Google Maps API key required (free tier available)

Map is Phase 3 because it adds complexity to Run Detail and requires a new EAS build, but the data is already available in HealthKit.

---

## What Is Not In Scope

- Real-time GPS tracking (HealthKit is the source; no live tracking)
- Writing data back to HealthKit
- Web app (mobile native only)
- Push notifications
- Social/sharing features
