# RA-34 Manage DB — Design

Date: 2026-11-18 · Branch: `feature/manage-db` · Jira: RA-34

## Goal

Store every user's runs, run types and profile in Supabase Postgres, keep a local copy on the phone so the app works offline, and switch all screens from mock data to the real data.

Acceptance criteria (from RA-34):
- Cloud DB stores profile, run types, a full copy of every run (summary, splits, segments, zones, weather), type assignments, notes and manual edits.
- Each user reads/writes only their own data, enforced by Row Level Security.
- Importing runs adds new ones and skips existing ones (by HealthKit UUID); it never overwrites edits, types or notes.
- Logging in on a new device shows the full history from the cloud, before any Apple Health sync.
- Screens read from the database, not mock data.
- The app opens and shows saved runs with no internet; offline changes sync when the connection is back.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Runs on this branch (before RA-3 HealthKit) | `__DEV__`-only "Load sample runs" button in Settings writes `mockData.ts` runs into the user's account | Tests the real write + sync path; RA-3 replaces it with HealthKit sync |
| Run types | Per-user rows, 7 defaults created for every account | Manage Types (later), shoes (RA-8) and classifier (RA-15) need real rows; avoids migrating `type_id` later |
| Offline storage | SQLite mirror + outbox (`pending_ops`) | No size limit (AsyncStorage on Android caps at 6 MB), matches `architecture.md`, SQL available for later features. Rejected: persisted Zustand blob (rewrite whole blob per edit, Android limit), PowerSync/WatermelonDB (new native deps, paid tiers) |
| Manual edits | `edits` jsonb column on `runs` (replaces the planned `run_overrides` table) | Same override idea, one fewer table to sync |
| Conflicts | Last write wins per field | One person's own data; rare in practice |
| Apple Health run id | `runs.id` = HealthKit workout UUID | Two devices importing the same workout offline produce the same row, not duplicates |

Default run types (hue = oklch hue, evenly spaced, adjustable later):

| Name | Hue |
|---|---|
| Race | 20 |
| Tempo | 70 |
| Hills | 120 |
| Easy | 170 |
| Long | 220 |
| Fartlek | 270 |
| Interval | 320 |

## 1. Data

### Supabase (cloud) — `supabase/schema.sql`

Committed to the repo; Bar runs it once in the Supabase SQL editor.

```sql
profiles (
  user_id    uuid primary key references auth.users on delete cascade,
  unit       text not null default 'km' check (unit in ('km','mi')),
  updated_at timestamptz not null default now()
)

run_types (
  id         uuid primary key,
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  hue        int  not null,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now()
)

runs (
  id             uuid primary key,            -- = HealthKit workout UUID for Apple Health runs
  user_id        uuid not null references auth.users on delete cascade,
  healthkit_uuid text,                        -- unique (user_id, healthkit_uuid)
  type_id        uuid references run_types,   -- null = unclassified
  name           text not null,
  date           date not null,
  distance_km    real not null,
  time_sec       int  not null,
  avg_hr int, max_hr int, min_hr int, elev_gain int, cadence int,
  source         text not null,               -- 'apple_health' | 'strava' | 'garmin'
  notes          text,
  splits         jsonb not null,
  segments       jsonb,
  zones          jsonb,
  weather        jsonb,
  edits          jsonb not null default '{}', -- manual edits, e.g. {"distanceKm":10.02,"avgHr":151}
  updated_at     timestamptz not null default now()
)
```

- **RLS** on all three tables: select/insert/update/delete only where `user_id = auth.uid()`.
- **`updated_at` trigger** on all three tables sets `now()` on every insert/update (server clock, not the phone's).
- **New-user trigger** on `auth.users` insert: creates the `profiles` row and the 7 default `run_types`.
- `on delete cascade` means the existing `delete_account()` removes all of a user's data.

### Phone (SQLite)

Same three tables (jsonb → TEXT holding JSON, timestamps → TEXT ISO), plus the outbox:

```sql
pending_ops (
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  tbl     TEXT NOT NULL,      -- 'runs' | 'run_types' | 'profiles'
  row_id  TEXT NOT NULL,
  kind    TEXT NOT NULL,      -- 'insert' | 'update'
  patch   TEXT NOT NULL,      -- JSON: full row for insert, changed fields for update
  failed  INTEGER NOT NULL DEFAULT 0
)
```

Plus a one-row `sync_state` (`last_pulled_at`). Schema version tracked with `PRAGMA user_version`.

### Edits

- HealthKit values stay in their own columns, never changed by edits.
- Displayed run = HealthKit fields with `edits` applied on top (`applyEdits(run)`).
- Editable fields: `name`, `distanceKm`, `timeSec`, `avgHr`, `minHr`, `maxHr`, `elevGain` (the Edit Run modal's fields). Pace is never stored.
- Splits, segments, zones and charts stay on the recorded data.
- Revert = set `edits` to `{}` (no UI yet).

## 2. Sync

**Write:** every user change runs one SQLite transaction: update the local row + insert a `pending_ops` row. The store updates immediately; then `syncNow()` starts in the background.

**Push (phone → cloud):** send `pending_ops` in `seq` order.
- `insert` → upsert full row, ignoring duplicates on `id` (an already-imported run is skipped, so it never overwrites type/notes/edits).
- `update` → update only the fields in `patch`.
- Success → delete the op.
- Network failure → stop; retry next sync. Nothing is lost.
- Server rejects the op (4xx: constraint, RLS) → set `failed = 1`, log it, continue with the next op. Failed ops are kept, never silently deleted, and skipped on later pushes.

**Pull (cloud → phone):**
- No `last_pulled_at` (first login on this device) → fetch all rows of the 3 tables.
- Otherwise fetch rows with `updated_at > last_pulled_at`.
- Write each pulled row into SQLite, **except** rows that still have unsent (non-failed) ops, so the local unsent change wins.
- Store `last_pulled_at` = max `updated_at` received (server clock), then reload stores.

**When:** `syncNow()` = push, then pull. Runs on login, when the app returns to the foreground (`AppState` → `active`), and after each local change. A module-level flag prevents two syncs at once (a request during a sync sets "run again after"). No connectivity check and no new package: a failed request means offline.

**Log out:** try one `syncNow()`; if non-failed ops remain, warn "You have unsynced changes that will be lost" with Cancel / Log out anyway. On log out: `clearAll()` (all tables, including outbox and `sync_state`) and reset stores, so the next user on this phone sees nothing of the previous one.

**Accepted limitations:**
- Last write wins per field. `edits` is a single field: editing distance on one device and HR on another while both are offline keeps only the later device's `edits`. Fix later with a Postgres jsonb merge function if it ever matters.
- A brand-new device needs internet for the first login (auth + first pull).

## 3. Code structure

```
supabase/
  schema.sql            ← tables, RLS, triggers (run once in SQL editor)
src/
  api/
    sync.ts             ← pushOp(op), pullSince(ts) — the only network code for data
  db/
    schema.ts           ← open DB, create tables, user_version
    queries.ts          ← loadAll(), writeChange(), applyPulled(), clearAll(), pending ops helpers
    sync.ts             ← syncNow(): push then pull, single-flight
    merge.ts            ← pure: applyEdits(), filterPulled(), seed mapping
    sync.check.ts       ← node self-check for merge.ts
    seed.ts             ← __DEV__ "Load sample runs"
  store/
    useRunStore.ts      ← runs (edits applied), setType, setNotes, editRun
    useRunTypeStore.ts  ← types, typeMap
    useUserStore.ts     ← unit
```

- Boundary rule kept: only `src/api/` imports Supabase. `src/db/sync.ts` calls `src/api/sync.ts`.
- `Run` type gains `edits: Partial<Pick<Run, 'name'|'distanceKm'|'timeSec'|'avgHr'|'minHr'|'maxHr'|'elevGain'>>`.
- **Lifecycle** (next to the auth gate in `app/_layout.tsx`): session appears → open DB, load stores, `syncNow()`; foreground → `syncNow()`; session ends → `clearAll()` + reset stores.
- **Screens:** `dashboard.tsx`, `runs.tsx`, `compare/result.tsx`, `run/[id].tsx`, `run/[id]/splits.tsx`, `segments.tsx`, `zones.tsx`, `RunCard.tsx`, `RunPickerList.tsx` read from the stores instead of `MOCK_RUNS` / `MOCK_RUN_TYPES`. The `ponytail:` in-place mutation in `run/[id].tsx` becomes `editRun()`. Screens show an empty state when there are no runs.
- **Seed:** takes `MOCK_RUNS`, gives each a fixed UUID derived from its mock id (same on every press and every device), maps mock type ids to the user's type rows by name (`easy`→Easy, `long`→Long, `tempo`→Tempo, `interval`→Interval), and saves them as `insert` ops through `writeChange`. Pressing it twice creates no duplicates. `mockData.ts` is then used only by the seed.
- Docs: update `architecture.md` (data model, `edits` instead of `run_overrides`, file tree, sync) and `CLAUDE.md` (Data Rules: overrides live in `runs.edits`; remove the `manage-types.tsx` line that doesn't exist yet).

**Out of scope:** unit toggle (RA-6), "Revert to original" button, Manage Types screen, HealthKit import (RA-3), raw HR/GPS streams (Phase 3).

## 4. Testing

**Self-check** — `node src/db/sync.check.ts`:
- `applyEdits`: edited fields win, the rest keep HealthKit values, `{}` changes nothing.
- `filterPulled`: rows with unsent ops are skipped, failed ops don't block a row.
- Seed mapping: mock type ids map to the right type rows; seed UUIDs are stable across calls.

**Device test script** (dev build or Expo Go):
1. Seed → runs appear on Dashboard, All runs, Run Detail; Supabase Table Editor shows them under the user.
2. Airplane mode: set a type, write a note, edit a distance; kill and reopen offline → all three changes still there.
3. Back online, foreground the app → outbox empties; Supabase shows the three changes.
4. Log out, log in → full history returns from the cloud without seeding ("new device").
5. Offline change, then log out → unsynced-changes warning.
6. Second account → sees no runs and has its own 7 default types. Unauthenticated API call to `runs` returns no rows.
7. Delete the second account → its rows are gone from all tables.
