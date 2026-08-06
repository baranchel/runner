# Run Tracker App — Implementation Guide

## What We're Building
An iOS-first mobile app that:
1. Reads your past runs from Apple HealthKit (no real-time GPS tracking)
2. Lets you manually classify each run by type (Long Run, Tempo, Intervals, Recovery, Race...)
3. Lets you filter and compare runs

Development machine: Windows. No Mac. Build for iOS via EAS cloud build service.

---

## Architecture Overview

```
iPhone
  └── Apple HealthKit  ←──── source of truth for raw run metrics
        │
        ▼
  React Native App (Expo)
        │
        ├── react-native-health  ←── HealthKit bridge (native, not Expo Go)
        ├── expo-sqlite           ←── stores your classifications locally
        └── React Navigation      ←── screen routing

(Phase 2, later)
  FastAPI (Python) backend ←── for cross-device sync and auto-classification
  PostgreSQL
```

**Why not Expo Go?**
Expo Go is a sandbox app — it cannot access HealthKit because that requires native iOS permissions compiled into the app. You need a real development build via EAS Build (Expo's cloud service). This produces an `.ipa` file you install on your iPhone.

**Why TypeScript?**
HealthKit returns complex nested objects. TypeScript lets you define the shape of a `Run` once and get autocomplete + compile-time errors everywhere else. It is a superset of JS — you can write plain JS inside TS files by simply not annotating types.

**Why FastAPI (Python) later — not Node.js?**
Node.js is easier (same language), but Python is the right tool for the auto-suggest feature you want later (`scikit-learn` for clustering run types). Since the frontend/backend boundary is clean REST calls, maintaining two languages is fine. Also: you explicitly want to learn Python.

---

## Data Model

```
RunType
  id          TEXT (uuid)
  name        TEXT          -- "Long Run", "Tempo", "Intervals", "Recovery", "Race"
  color       TEXT          -- hex color for UI labels

Run
  id              TEXT (uuid)
  healthkit_uuid  TEXT      -- prevents duplicate imports
  date            TEXT      -- ISO 8601
  distance_km     REAL
  duration_s      INTEGER   -- seconds
  avg_pace_s_km   INTEGER   -- seconds per km
  avg_hr          INTEGER   -- bpm (nullable)
  max_hr          INTEGER   -- bpm (nullable)
  elevation_m     REAL      -- nullable
  calories        INTEGER   -- nullable
  run_type_id     TEXT      -- FK → RunType (nullable until user classifies)
  notes           TEXT      -- nullable
```

HealthKit is the source of truth for metrics. SQLite stores only the classification and user notes. Never write metrics back to HealthKit.

---

## Screens

| Screen | Purpose |
|--------|---------|
| Dashboard | Recent 5 runs, weekly km total, filter chips by type |
| Run List | Full history, filterable by type / distance / date / pace |
| Run Detail | All metrics for one run, classify button, notes field |
| Compare | Pick two runs, side-by-side metric table |
| Manage Types | Add / rename / delete run types with color picker |

---

## Step-by-Step Implementation

### Step 0 — Environment Setup
1. Install Node.js (LTS), npm, and `expo-cli` on Windows
2. Create Expo project: `npx create-expo-app RunTracker --template`
3. Install EAS CLI: `npm install -g eas-cli`
4. Create a free account at expo.dev
5. Link project: `eas init`
6. Create Apple Developer account (free tier for device testing is fine)
7. Register your iPhone as a test device in Apple Developer portal

### Step 1 — Native Build Setup (HealthKit requires this)
1. Add `react-native-health` package
2. Add HealthKit entitlements to `app.json`:
   ```json
   "ios": {
     "entitlements": {
       "com.apple.developer.healthkit": true
     },
     "infoPlist": {
       "NSHealthShareUsageDescription": "To read your running workouts"
     }
   }
   ```
3. Create `eas.json` with a development profile
4. Run `eas build --profile development --platform ios`
5. Install the resulting `.ipa` on your iPhone via the EAS link

### Step 2 — Local Database (SQLite)
1. Install `expo-sqlite`
2. Create `src/db/schema.ts` — defines `RunType` and `Run` tables
3. Create `src/db/queries.ts` — helper functions:
   - `insertRunType(name, color)`
   - `getAllRunTypes()`
   - `insertRun(healthkitRun)`
   - `getRunById(id)`
   - `getAllRuns(filters?)`
   - `updateRunType(runId, typeId)`
   - `updateRunNotes(runId, notes)`
4. Seed default run types: Long Run, Tempo, Intervals, Recovery, Race

### Step 3 — HealthKit Integration
1. Create `src/hooks/useHealthKit.ts`
2. On app start: request HealthKit read permissions for workouts, distance, heart rate, calories, elevation
3. Query all `HKWorkoutActivityType.running` workouts
4. For each workout: map HealthKit fields → your `Run` schema
5. Check `healthkit_uuid` to avoid re-inserting duplicates
6. Insert new runs into SQLite

### Step 4 — Run List Screen
1. Load all runs from SQLite (most recent first)
2. Show each run as a card: date, distance, duration, avg pace, run type badge (or "Unclassified")
3. Add filter bar at top: chips for each RunType + "All"
4. Tap a run → navigate to Run Detail

### Step 5 — Run Detail Screen
1. Show all metrics for the selected run
2. "Classify" button → bottom sheet with list of RunType options
3. On select: update `run_type_id` in SQLite, refresh the card
4. Text input for notes
5. Show HealthKit source data (not editable)

### Step 6 — Dashboard Screen
1. Show last 5 runs as compact cards
2. Weekly total: km this week, number of runs
3. Type distribution: mini bar or label counts ("3 tempo, 1 long run this month")

### Step 7 — Compare Screen
1. "Pick run A" and "Pick run B" selectors (opens run list in select mode)
2. Side-by-side table: distance / duration / avg pace / avg HR / elevation / type / date
3. Highlight better value in green (e.g., faster pace)

### Step 8 — Manage Types Screen
1. List all RunTypes with their color
2. Add new type: name + color picker
3. Edit / delete existing types
4. Deleting a type → unclassifies all runs that had that type (set to null)

---

## Phase 2 — Backend (when ready)

### FastAPI Backend
```
backend/
  main.py
  models/
    run.py         -- Pydantic schemas
    run_type.py
  routes/
    runs.py        -- GET /runs, PATCH /runs/{id}
    run_types.py   -- CRUD for types
  db.py            -- SQLAlchemy + PostgreSQL
```

1. POST `/sync` — app sends local runs to server
2. GET `/runs` — server returns full history
3. Auto-suggest endpoint later: POST `/runs/{id}/suggest-type` → returns predicted type based on pace/distance/HR patterns

### Migration path
- Add an `is_synced` column to local SQLite
- On app open: push unsynced runs to backend, mark as synced
- No hard dependency: app works offline, syncs when connected

---

## File Structure

```
RunTracker/
  src/
    screens/
      Dashboard.tsx
      RunList.tsx
      RunDetail.tsx
      Compare.tsx
      ManageTypes.tsx
    components/
      RunCard.tsx
      FilterBar.tsx
      MetricBadge.tsx
      TypePicker.tsx
    hooks/
      useHealthKit.ts
      useRuns.ts
      useRunTypes.ts
    db/
      schema.ts
      queries.ts
    types/
      index.ts       -- Run, RunType, HealthKitWorkout interfaces
  app.json
  eas.json
  tsconfig.json
```

---

## Verification Checklist (per step)
- **Step 1**: Dev build installs on iPhone, app opens without crash
- **Step 2**: Can insert and query a RunType via a test button
- **Step 3**: Past running workouts appear in console log after HealthKit permission granted
- **Step 4**: Run list populates from HealthKit data, filter chips work
- **Step 5**: Classifying a run persists after killing and reopening the app
- **Step 6**: Dashboard stats match what you count manually in the list
- **Step 7**: Comparing two runs shows correct metric delta highlights
- **Step 8**: Deleting a run type sets affected runs to Unclassified
