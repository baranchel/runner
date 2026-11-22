# Personal Info (RA-11) + Edit Profile (RA-10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A personal-info form (prefilled from Apple Health + sign-in name) shown once after onboarding and editable from Settings, stored in the cloud through the existing sync layer, with the profile's HRmax replacing `MOCK_HR_MAX`.

**Architecture:** `profiles` becomes the third synced table (SQLite copy + outbox, `writeChange` → `syncNow`). The cloud key is `user_id`; the local key is `id` (= user id), and `src/api/sync.ts` maps between them. Pure profile logic (`src/utils/profile.ts`) runs under plain `node` for its self-check. One screen `app/personal-info.tsx` serves onboarding and edit (`?mode=edit`). `app/index.tsx` is the single place that decides Health → personal info → dashboard.

**Tech Stack:** Expo 58 / expo-router, Zustand, expo-sqlite, Supabase, `@react-native-community/datetimepicker` (already installed).

Spec: `docs/superpowers/specs/2026-11-21-personal-info-design.md`

## Rules for every task

- **Never run git commands** (no add/commit/checkout). At the end of each task, stop and list the changed files; Bar commits.
- Type check: `npx tsc --noEmit` → no output, exit 0.
- Self-checks: `node src/utils/profile.check.ts`, `node src/db/sync.check.ts`, `node src/healthkit/import.check.ts` → each prints `…: all passed`.
- Files imported by a `*.check.ts` must not import React Native / Expo, and import other `.ts` files with the `.ts` extension (see `src/db/merge.ts`).

## File map

| File | Change |
|---|---|
| `supabase/migrations/2026-11-21-profile.sql` | new — add profile columns |
| `supabase/schema.sql` | profile columns |
| `src/utils/profile.ts` | new — `ProfileRow`, `Sex`, `isComplete`, `splitName`, `isoDate`, `ageOn`, `parseNum`, `autoHrMax`, `estimateHrMax`, `effectiveHrMax`, `nextAutoHrMax` |
| `src/utils/profile.check.ts` | new — self-check |
| `src/db/schema.ts` | SQLite v4: `profiles` table |
| `src/db/merge.ts` | `cloudKey`, `fromCloud` |
| `src/db/sync.check.ts` | key-mapping checks |
| `src/db/queries.ts` | `'profiles'` table, `loadProfile`, `ensureProfileRow`, `clearAll` |
| `src/db/sync.ts` | `TABLES` gets `'profiles'` |
| `src/api/sync.ts` | push/pull use `cloudKey` / `fromCloud` |
| `src/store/useProfileStore.ts` | new |
| `src/store/useAuthStore.ts` | load/reset the profile store |
| `src/utils/zones.ts` | drop `MOCK_HR_MAX`, `hrMax` required |
| `src/healthkit/importRuns.ts` | effective HRmax for zones, bump auto HRmax after import |
| `src/healthkit/bodyData.ts` | DOB via `isoDate` |
| `app/run/[id]/zones.tsx` | pass effective HRmax |
| `src/api/auth.ts` | `signUp(first, last, …)`, Apple first/last, `signInInfo()` |
| `app/signup.tsx` | First name + Last name fields |
| `app/personal-info.tsx` | new screen |
| `app/index.tsx` | routing: Health → personal info → dashboard |
| `app/health-access.tsx` | finish → `router.replace('/')` |
| `app/_layout.tsx` | register `personal-info` |
| `app/(tabs)/settings.tsx` | "Personal info" button |
| `architecture.md`, `CLAUDE.md`, `docs/HANDOFF.md` | docs |

---

### Task 1: Cloud schema

**Files:**
- Create: `supabase/migrations/2026-11-21-profile.sql`
- Modify: `supabase/schema.sql:7-11`

- [ ] **Step 1: Write the migration**

`supabase/migrations/2026-11-21-profile.sql`:

```sql
-- RA-11: personal info on profiles. Run once in the Supabase SQL Editor.
alter table public.profiles
  add column first_name    text,
  add column last_name     text,
  add column dob           date,
  add column sex           text check (sex in ('female', 'male', 'undisclosed')),
  add column height_cm     double precision,
  add column weight_kg     double precision,
  add column resting_hr    double precision,
  add column vo2max        double precision,
  add column hr_max        double precision,
  add column hr_max_manual boolean not null default false;
```

- [ ] **Step 2: Update `supabase/schema.sql`** — replace the `profiles` table (lines 7–11) with:

```sql
create table public.profiles (
  user_id       uuid primary key default auth.uid() references auth.users on delete cascade,
  unit          text not null default 'km' check (unit in ('km', 'mi')),
  first_name    text,                                   -- RA-11: required by the form, not the DB
  last_name     text,
  dob           date,
  sex           text check (sex in ('female', 'male', 'undisclosed')),  -- undisclosed = "Prefer not to say"
  height_cm     double precision,
  weight_kg     double precision,
  resting_hr    double precision,
  vo2max        double precision,
  hr_max        double precision,                       -- user's value, or highest HR from runs
  hr_max_manual boolean not null default false,         -- true = user typed it; auto-updates stop
  updated_at    timestamptz not null default now()
);
```

- [ ] **Step 3: Stop.** Tell Bar: run `supabase/migrations/2026-11-21-profile.sql` in the Supabase SQL Editor before any new code syncs. Files: the two above.

---

### Task 2: Pure profile logic + self-check

**Files:**
- Create: `src/utils/profile.ts`
- Test: `src/utils/profile.check.ts`

- [ ] **Step 1: Write the failing check** — `src/utils/profile.check.ts`:

```ts
// Run: node src/utils/profile.check.ts
import {
  ageOn, autoHrMax, effectiveHrMax, estimateHrMax, isComplete, isoDate, nextAutoHrMax, parseNum, splitName,
  type ProfileRow,
} from './profile.ts'

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}: expected ${e}, got ${a}`)
}

const base: ProfileRow = {
  id: 'u1', unit: 'km', first_name: 'Bar', last_name: 'Anchel', dob: '1990-06-15', sex: null,
  height_cm: null, weight_kg: null, resting_hr: null, vo2max: null, hr_max: null, hr_max_manual: false,
}
const today = new Date(2026, 10, 21)  // 21 Nov 2026, local

// names
eq(splitName('Bar Anchel'), { first: 'Bar', last: 'Anchel' }, 'two words')
eq(splitName('  Mary Ann  Smith '), { first: 'Mary', last: 'Ann  Smith' }, 'rest is last name')
eq(splitName('Bar'), { first: 'Bar', last: '' }, 'one word')
eq(splitName(''), { first: '', last: '' }, 'empty')

// complete = first + last + dob
eq(isComplete(base), true, 'complete')
eq(isComplete({ ...base, last_name: '  ' }), false, 'blank last name')
eq(isComplete({ ...base, dob: null }), false, 'no dob')
eq(isComplete(null), false, 'no profile')

// dates (local parts, never UTC)
eq(isoDate(new Date(1990, 5, 15, 0, 0)), '1990-06-15', 'local midnight stays the same day')
eq(ageOn('1990-06-15', today), 36, 'birthday passed')
eq(ageOn('1990-12-01', today), 35, 'birthday not yet')

// numbers: '' → null, invalid → undefined, comma decimals OK
eq(parseNum(''), null, 'empty')
eq(parseNum(' 72.5 '), 72.5, 'decimal')
eq(parseNum('72,5'), 72.5, 'comma decimal')
eq(parseNum('abc'), undefined, 'invalid')
eq(parseNum('0'), undefined, 'zero invalid')
eq(parseNum('-3'), undefined, 'negative invalid')

// HRmax
const runs = [{ maxHr: 181.4 }, { maxHr: null }, { maxHr: 176 }]
eq(autoHrMax(runs), 181, 'highest run HR, rounded')
eq(autoHrMax([]), null, 'no runs')
eq(estimateHrMax('1990-06-15', today), 184, '220 - 36')
eq(estimateHrMax(null, today), null, 'no dob → no estimate')
eq(effectiveHrMax({ ...base, hr_max: 195, hr_max_manual: true }, runs, today), 195, 'saved wins')
eq(effectiveHrMax(base, runs, today), 181, 'auto from runs')
eq(effectiveHrMax(base, [], today), 184, 'estimate')
eq(effectiveHrMax(null, [], today), 190, 'last resort')

eq(nextAutoHrMax({ ...base, hr_max: 178 }, runs), 181, 'higher run raises auto')
eq(nextAutoHrMax({ ...base, hr_max: 185 }, runs), null, 'lower run keeps saved')
eq(nextAutoHrMax({ ...base, hr_max: null }, runs), 181, 'first auto value')
eq(nextAutoHrMax({ ...base, hr_max: 170, hr_max_manual: true }, runs), null, 'manual never changes')
eq(nextAutoHrMax(base, []), null, 'no runs, nothing to save')

console.log('profile.check: all passed')
```

- [ ] **Step 2: Run it — expect failure**

Run: `node src/utils/profile.check.ts`
Expected: error `Cannot find module …/profile.ts`.

- [ ] **Step 3: Implement** — `src/utils/profile.ts`:

```ts
// Pure profile logic (RA-11). No React Native imports: `node src/utils/profile.check.ts` runs it.

export type Sex = 'female' | 'male' | 'undisclosed'  // undisclosed = "Prefer not to say"

/** A profile as stored (same snake_case columns locally and in the cloud; local id = user id). */
export interface ProfileRow {
  id: string
  unit: 'km' | 'mi'
  first_name: string | null
  last_name: string | null
  dob: string | null          // 'YYYY-MM-DD'
  sex: Sex | null
  height_cm: number | null
  weight_kg: number | null
  resting_hr: number | null
  vo2max: number | null
  hr_max: number | null       // user's value (manual) or highest HR from runs — never the 220 − age estimate
  hr_max_manual: boolean
  updated_at?: string | null
}

/** The form's required fields are filled. */
export const isComplete = (p: ProfileRow | null): boolean =>
  !!(p && p.first_name?.trim() && p.last_name?.trim() && p.dob)

/** "Mary Ann Smith" → first "Mary", last "Ann Smith" (old accounts and Google store one full name). */
export function splitName(full: string): { first: string; last: string } {
  const t = full.trim()
  const i = t.indexOf(' ')
  return i < 0 ? { first: t, last: '' } : { first: t.slice(0, i), last: t.slice(i + 1).trim() }
}

/** Date → 'YYYY-MM-DD' from local parts (toISOString() is UTC and can be the day before). */
export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function ageOn(dob: string, today: Date): number {
  const [y, m, d] = dob.split('-').map(Number)
  const hadBirthday = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d)
  return today.getFullYear() - y - (hadBirthday ? 0 : 1)
}

/** Form number: '' → null (left empty), not a positive number → undefined (invalid). */
export function parseNum(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Highest max HR across runs, or null when no run has one. */
export function autoHrMax(runs: readonly { maxHr: number | null }[]): number | null {
  let max: number | null = null
  for (const r of runs) if (r.maxHr != null && (max == null || r.maxHr > max)) max = r.maxHr
  return max == null ? null : Math.round(max)
}

export const estimateHrMax = (dob: string | null, today: Date): number | null =>
  dob ? 220 - ageOn(dob, today) : null

/** HRmax used for zones: saved → from runs → 220 − age → 190. */
export const effectiveHrMax = (p: ProfileRow | null, runs: readonly { maxHr: number | null }[], today: Date): number =>
  p?.hr_max ?? autoHrMax(runs) ?? estimateHrMax(p?.dob ?? null, today) ?? 190

/** After an import: the new auto HRmax to save, or null to leave it (manual, or no higher run). */
export function nextAutoHrMax(p: ProfileRow, runs: readonly { maxHr: number | null }[]): number | null {
  if (p.hr_max_manual) return null
  const auto = autoHrMax(runs)
  return auto != null && auto > (p.hr_max ?? 0) ? auto : null
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `node src/utils/profile.check.ts`
Expected: `profile.check: all passed`

- [ ] **Step 5: Stop.** Files: `src/utils/profile.ts`, `src/utils/profile.check.ts`.

---

### Task 3: Sync layer — `profiles` as third table

**Files:**
- Modify: `src/db/merge.ts` (append), `src/db/sync.check.ts`, `src/db/schema.ts`, `src/db/queries.ts`, `src/db/sync.ts:5`, `src/api/sync.ts`

- [ ] **Step 1: Add failing checks** — in `src/db/sync.check.ts`, change the import line to

```ts
import { cloudKey, diffEdits, filterPulled, fromCloud, rowToRun, runToRow } from './merge.ts'
```

and add before the final `console.log`:

```ts
// profiles: cloud key is user_id, local key is id
eq(cloudKey('profiles'), 'user_id', 'profiles keyed by user_id')
eq(cloudKey('runs'), 'id', 'runs keyed by id')
eq(fromCloud('profiles', [{ user_id: 'u1', first_name: 'Bar' }]), [{ user_id: 'u1', first_name: 'Bar', id: 'u1' }], 'user_id → id')
eq(fromCloud('runs', [{ id: 'r1' }]), [{ id: 'r1' }], 'other tables unchanged')
```

- [ ] **Step 2: Run — expect failure**

Run: `node src/db/sync.check.ts`
Expected: SyntaxError / `does not provide an export named 'cloudKey'`.

- [ ] **Step 3: Implement in `src/db/merge.ts`** (append at the end):

```ts
/** Column that identifies a row in the cloud. profiles has no id: one row per user, keyed by user_id. */
export const cloudKey = (tbl: string): 'id' | 'user_id' => (tbl === 'profiles' ? 'user_id' : 'id')

/** Pulled cloud rows → local shape (every local table is keyed by id). */
export const fromCloud = (tbl: string, rows: Record<string, unknown>[]): Record<string, unknown>[] =>
  cloudKey(tbl) === 'id' ? rows : rows.map(r => ({ ...r, id: r.user_id }))
```

- [ ] **Step 4: Run — expect pass**

Run: `node src/db/sync.check.ts`
Expected: `sync.check: all passed`

- [ ] **Step 5: SQLite v4** — in `src/db/schema.ts` change line 6 to `const VERSION = 4  // bump + add an \`if (v < N)\` block to change the schema later` and append after line 34:

```ts
if (v < 4) db.execSync(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY, unit TEXT, first_name TEXT, last_name TEXT, dob TEXT, sex TEXT,
    height_cm REAL, weight_kg REAL, resting_hr REAL, vo2max REAL, hr_max REAL,
    hr_max_manual INTEGER NOT NULL DEFAULT 0, updated_at TEXT
  );
  PRAGMA user_version = ${VERSION};
`)
```

(A fresh install runs the `v < 1` block and then this one; both use `IF NOT EXISTS`.)

- [ ] **Step 6: `src/db/queries.ts`**

Line 6 → `export type Table = 'runs' | 'run_types' | 'profiles'`

Add to the top imports: `import type { ProfileRow } from '../utils/profile'`

Add to `COLS` (after `run_types`):

```ts
  profiles: ['id', 'unit', 'first_name', 'last_name', 'dob', 'sex', 'height_cm', 'weight_kg', 'resting_hr',
    'vo2max', 'hr_max', 'hr_max_manual', 'updated_at'],
```

Add under `// ─── Reads`:

```ts
/** The signed-in user's profile (the phone holds one user's data), or null before the first pull. */
export function loadProfile(): ProfileRow | null {
  const r = db.getFirstSync<Record<string, unknown>>('SELECT * FROM profiles LIMIT 1')
  return r ? ({ ...r, hr_max_manual: r.hr_max_manual === 1 } as unknown as ProfileRow) : null
}
```

Add under `// ─── Writes` (before `writeChange`):

```ts
/** Offline before the first pull there is no local profile row yet; an update needs one. The cloud row always exists (signup trigger). */
export const ensureProfileRow = (userId: string) =>
  db.runSync('INSERT OR IGNORE INTO profiles (id) VALUES (?)', [userId])
```

In `clearAll()` change the SQL to:

```ts
  db.execSync('DELETE FROM runs; DELETE FROM run_types; DELETE FROM profiles; DELETE FROM pending_ops; DELETE FROM sync_state;')
```

- [ ] **Step 7: `src/db/sync.ts` line 5** →

```ts
const TABLES: Table[] = ['profiles', 'run_types', 'runs']  // types before runs: runs point at them
```

- [ ] **Step 8: `src/api/sync.ts`** — add `import { cloudKey, fromCloud } from '../db/merge'` under the supabase import. Replace the `else` branch of `pushOp` (line 17):

```ts
    } else {
      const key = cloudKey(tbl)
      const { id: _id, ...fields } = row  // profiles has no id column in the cloud
      res = await supabase.from(tbl).update(key === 'id' ? row : fields).eq(key, rowId).select(key)
    }
```

In `pullSince`, add `const key = cloudKey(tbl)` as the first line, and change:
- `.order('updated_at').order('id')` → `.order('updated_at').order(key)`
- `` `updated_at.gt."${after.t}",and(updated_at.eq."${after.t}",id.gt.${after.id})` `` → `` `updated_at.gt."${after.t}",and(updated_at.eq."${after.t}",${key}.gt.${after.id})` ``
- `if (data.length < PAGE) return rows` → `if (data.length < PAGE) return fromCloud(tbl, rows)`
- `after = { t: String(last.updated_at), id: String(last.id) }` → `after = { t: String(last.updated_at), id: String(last[key]) }`

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit` → no errors. `node src/db/sync.check.ts` → `sync.check: all passed`.

- [ ] **Step 10: Stop.** Files: `src/db/merge.ts`, `src/db/sync.check.ts`, `src/db/schema.ts`, `src/db/queries.ts`, `src/db/sync.ts`, `src/api/sync.ts`.

---

### Task 4: Profile store

**Files:**
- Create: `src/store/useProfileStore.ts`
- Modify: `src/store/useAuthStore.ts`

- [ ] **Step 1: Create `src/store/useProfileStore.ts`:**

```ts
import { create } from 'zustand'
import { ensureProfileRow, loadProfile, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import { nextAutoHrMax, type ProfileRow } from '../utils/profile'

type Patch = Partial<Omit<ProfileRow, 'id' | 'updated_at'>>

type State = {
  profile: ProfileRow | null
  load: () => void
  reset: () => void
  save: (userId: string, patch: Patch) => void
  /** After an import: raise the auto HRmax if a run went higher (never touches a typed value). */
  bumpAutoHrMax: (runs: readonly { maxHr: number | null }[]) => void
}

export const useProfileStore = create<State>((set, get) => ({
  profile: null,
  load: () => set({ profile: loadProfile() }),
  reset: () => set({ profile: null }),

  save: (userId, patch) => {
    ensureProfileRow(userId)
    writeChange('profiles', 'update', { id: userId, ...patch })
    get().load()
    syncNow()
  },

  bumpAutoHrMax: runs => {
    const p = get().profile
    const next = p ? nextAutoHrMax(p, runs) : null
    if (p && next != null) get().save(p.id, { hr_max: next })
  },
}))
```

- [ ] **Step 2: `src/store/useAuthStore.ts`** — add `import { useProfileStore } from './useProfileStore'`; in `loadStores()` add `useProfileStore.getState().load()` as the first line; in the logged-out branch add `useProfileStore.getState().reset()` after the two existing resets.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Stop.** Files: `src/store/useProfileStore.ts`, `src/store/useAuthStore.ts`.

---

### Task 5: Real HRmax for zones

**Files:**
- Modify: `src/utils/zones.ts:13-27`, `src/healthkit/importRuns.ts`, `src/healthkit/bodyData.ts:31`, `app/run/[id]/zones.tsx`

- [ ] **Step 1: `src/utils/zones.ts`** — delete the `MOCK_HR_MAX` line and make `hrMax` required:

```ts
// lower-bound bpm for each zone (Z1..Z5) at 50/60/70/80/90% of HRmax
export function zoneBounds(hrMax: number): [number, number, number, number, number] {
  return [0.5, 0.6, 0.7, 0.8, 0.9].map(p => Math.round(hrMax * p)) as
    [number, number, number, number, number]
}

// human range per zone: Z1 "<b2", middle "b–(next-1)", Z5 "b5+"
export function zoneRangeLabel(i: number, hrMax: number): string {
```

(the body of `zoneRangeLabel` is unchanged).

- [ ] **Step 2: `src/healthkit/importRuns.ts`**
  - Replace `import { MOCK_HR_MAX } from '../utils/zones'` with:
    ```ts
    import { useProfileStore } from '../store/useProfileStore'
    import { effectiveHrMax } from '../utils/profile'
    ```
  - Right after `const progress = (done: number) => …` (line 67) add:
    ```ts
    // ponytail: zones of this batch use the HRmax from before it; a new higher max applies from the next import (RA-21 re-reads old runs).
    const hrMax = effectiveHrMax(useProfileStore.getState().profile, useRunStore.getState().runs, new Date())
    ```
  - In the `mapWorkout(...)` call replace `MOCK_HR_MAX` with `hrMax`.
  - Replace line 112 with:
    ```ts
    if (todo.length > 0) {
      useRunStore.getState().load()
      useProfileStore.getState().bumpAutoHrMax(useRunStore.getState().runs)
      syncNow()
    }
    ```

- [ ] **Step 3: `src/healthkit/bodyData.ts`** — add `import { isoDate } from '../utils/profile'` and change line 31 to `dob: dob ? isoDate(dob) : null,`.

- [ ] **Step 4: `app/run/[id]/zones.tsx`** — add imports:

```ts
import { useProfileStore } from '../../../src/store/useProfileStore'
import { effectiveHrMax } from '../../../src/utils/profile'
```

after `const run = useRunStore(s => s.runs.find(r => r.id === id))` (line 17) add:

```ts
  const runs = useRunStore(s => s.runs)
  const profile = useProfileStore(s => s.profile)
  const hrMax = effectiveHrMax(profile, runs, new Date())
```

and change `zoneRangeLabel(i)` (line 60) to `zoneRangeLabel(i, hrMax)`.

(These hooks must sit above any early `return` in the component — check where line 17 is relative to `if (!run) return …`, and keep all hooks before it.)

- [ ] **Step 5: Verify** — `npx tsc --noEmit` → no errors (it flags any caller still using one argument). `node src/healthkit/import.check.ts` → `all passed`. `grep -rn MOCK_HR_MAX src app` → nothing.

- [ ] **Step 6: Stop.** Files: the four above.

---

### Task 6: First + last name at sign-up

**Files:**
- Modify: `src/api/auth.ts`, `app/signup.tsx`

- [ ] **Step 1: `src/api/auth.ts`**
  - Add `import { splitName } from '../utils/profile'`.
  - `signUp`:
    ```ts
    export async function signUp(firstName: string, lastName: string, email: string, password: string): Result {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName, last_name: lastName }, emailRedirectTo: linkTo('auth-callback') },
        })
    ```
    (rest unchanged).
  - In `signInWithApple`, replace the name block with:
    ```ts
    // Apple sends the name only on the very first sign-in, so save it now or never.
    const first_name = cred.fullName?.givenName ?? '', last_name = cred.fullName?.familyName ?? ''
    if (first_name || last_name) {
      // ponytail: one retry only; a name lost after that is typed in the personal-info form (RA-11).
      const save = () => supabase.auth.updateUser({ data: { first_name, last_name } })
      const first = await save()
      if (first.error && (await save()).error) console.warn('Apple name not saved', first.error)
    }
    ```
  - Add after `signOut`:
    ```ts
    /** What the personal-info form shows about the sign-in: email, method, and the name to prefill. */
    export function signInInfo(session: Session) {
      const m = session.user.user_metadata ?? {}
      const provider = session.user.app_metadata?.provider
      // Old email accounts stored one `name`; Google stores `full_name` / `name`.
      const split = splitName(String(m.full_name ?? m.name ?? ''))
      return {
        email: session.user.email ?? '',
        method: provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : 'Email',
        firstName: String(m.first_name || split.first),
        lastName: String(m.last_name || split.last),
      }
    }
    ```

- [ ] **Step 2: `app/signup.tsx`**
  - State: replace `const [name, setName] = useState('')` with
    ```ts
    const [firstName,   setFirstName]   = useState('')
    const [lastName,    setLastName]    = useState('')
    ```
  - Refs: replace `nameRef` with `firstRef` and `lastRef` (same type).
  - `canSubmit`: replace `name.trim() !== ''` with `firstName.trim() !== '' && lastName.trim() !== ''`.
  - `submit`: `const err = await signUp(firstName.trim(), lastName.trim(), email.trim(), password)`.
  - Replace the `{/* Full name */}` field group with:
    ```tsx
          {/* First + last name */}
          <View style={s.nameRow}>
            <View style={[s.fieldGroup, s.nameCol]}>
              <Text style={s.fieldLabel}>First name</Text>
              <TextInput
                ref={firstRef}
                style={s.input}
                placeholder="John"
                placeholderTextColor={colors.textGhost}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                textContentType="givenName"
                returnKeyType="next"
                onSubmitEditing={() => lastRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
            <View style={[s.fieldGroup, s.nameCol]}>
              <Text style={s.fieldLabel}>Last name</Text>
              <TextInput
                ref={lastRef}
                style={s.input}
                placeholder="Doe"
                placeholderTextColor={colors.textGhost}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                textContentType="familyName"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
          </View>
    ```
  - Styles: add after `fieldGroup`:
    ```ts
      nameRow:   { flexDirection: 'row', gap: 10 },
      nameCol:   { flex: 1 },
    ```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → no errors; `grep -n "nameRef\|setName\b" app/signup.tsx` → nothing.

- [ ] **Step 4: Stop.** Files: `src/api/auth.ts`, `app/signup.tsx`.

---

### Task 7: Personal-info screen

**Files:**
- Create: `app/personal-info.tsx`

- [ ] **Step 1: Create `app/personal-info.tsx`:**

```tsx
import { useEffect, useState } from 'react'
import {
  Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'
import { signInInfo } from '../src/api/auth'
import { readBodyData } from '../src/healthkit/bodyData'
import { useAuthStore } from '../src/store/useAuthStore'
import { useProfileStore } from '../src/store/useProfileStore'
import { useRunStore } from '../src/store/useRunStore'
import { autoHrMax, estimateHrMax, isoDate, parseNum, type Sex } from '../src/utils/profile'
import { buttons, colors, fonts } from '../src/utils/tokens'

// RA-11 onboarding (after Health) and RA-10 edit from Settings (?mode=edit). Units: cm/kg until RA-6.
const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'undisclosed', label: 'Prefer not to say' },
]
const str = (n: number | null | undefined) => (n == null ? '' : String(n))
const toDate = (iso: string) => new Date(`${iso}T00:00:00`)  // local midnight

export default function PersonalInfo() {
  const router = useRouter()
  const editing = useLocalSearchParams<{ mode?: string }>().mode === 'edit'
  const session = useAuthStore(s => s.session)
  const runs = useRunStore(s => s.runs)
  const saved = useProfileStore.getState().profile  // initial values only
  const info = session ? signInInfo(session) : null

  const [first,  setFirst]  = useState(saved?.first_name ?? info?.firstName ?? '')
  const [last,   setLast]   = useState(saved?.last_name ?? info?.lastName ?? '')
  const [dob,    setDob]    = useState<string | null>(saved?.dob ?? null)
  const [sex,    setSex]    = useState<Sex | null>(saved?.sex ?? null)
  const [height, setHeight] = useState(str(saved?.height_cm))
  const [weight, setWeight] = useState(str(saved?.weight_kg))
  const [restHr, setRestHr] = useState(str(saved?.resting_hr))
  const [vo2,    setVo2]    = useState(str(saved?.vo2max))
  const [hrText, setHrText] = useState(saved?.hr_max_manual ? str(saved.hr_max) : '')  // '' = auto
  const [dobOpen, setDobOpen] = useState(false)
  const [sexOpen, setSexOpen] = useState(false)

  // Fill what is still empty from Apple Health; saved values and anything already typed win.
  useEffect(() => {
    let alive = true
    readBodyData().then(h => {
      if (!alive) return
      setDob(v => v ?? h.dob)
      setSex(v => v ?? (h.sex === 'other' ? null : h.sex))
      setHeight(v => v || str(h.heightCm))
      setWeight(v => v || str(h.weightKg))
      setRestHr(v => v || str(h.restingHr))
      setVo2(v => v || str(h.vo2max))
    })
    return () => { alive = false }
  }, [])

  const fromRuns = autoHrMax(runs)
  const autoHr = fromRuns ?? estimateHrMax(dob, new Date())
  const hrNote = hrText ? null : fromRuns != null ? 'From your runs' : autoHr != null ? 'Estimated: 220 − age' : null

  const nums = {
    height_cm: parseNum(height), weight_kg: parseNum(weight), resting_hr: parseNum(restHr),
    vo2max: parseNum(vo2), hr_max: parseNum(hrText),
  }
  const numsValid = Object.values(nums).every(v => v !== undefined)
  const canSave = !!session && first.trim() !== '' && last.trim() !== '' && dob != null && numsValid

  const save = () => {
    if (!canSave || !session) return
    useProfileStore.getState().save(session.user.id, {
      first_name: first.trim(), last_name: last.trim(), dob, sex,
      height_cm: nums.height_cm ?? null, weight_kg: nums.weight_kg ?? null,
      resting_hr: nums.resting_hr ?? null, vo2max: nums.vo2max ?? null,
      // typed → the user's value; empty → highest HR from runs (the estimate is never saved)
      hr_max: nums.hr_max ?? fromRuns, hr_max_manual: nums.hr_max != null,
    })
    if (editing) router.back()
    else router.replace('/')  // index: complete profile → dashboard
  }

  const openDob = () => {
    if (!dob) setDob('1990-01-01')  // the spinner needs a date to show; the user scrolls from here
    setDobOpen(v => !v)
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{editing ? 'Personal info' : 'About you'}</Text>
        {!editing && (
          <Text style={s.body}>We filled in what Apple Health knows. Check it and fill in the rest.</Text>
        )}

        {info && (
          <View style={s.card}>
            <Text style={s.cardLabel}>Signed in with {info.method}</Text>
            <Text style={s.cardValue}>{info.email}</Text>
          </View>
        )}

        <View style={s.nameRow}>
          <View style={[s.field, s.flex]}>
            <Label text="First name" required />
            <TextInput style={s.input} value={first} onChangeText={setFirst} autoCapitalize="words"
              textContentType="givenName" placeholder="John" placeholderTextColor={colors.textGhost} />
          </View>
          <View style={[s.field, s.flex]}>
            <Label text="Last name" required />
            <TextInput style={s.input} value={last} onChangeText={setLast} autoCapitalize="words"
              textContentType="familyName" placeholder="Doe" placeholderTextColor={colors.textGhost} />
          </View>
        </View>

        <View style={s.field}>
          <Label text="Date of birth" required />
          <TouchableOpacity style={s.select} onPress={openDob} activeOpacity={0.8}>
            <Text style={dob ? s.selectText : s.placeholder}>
              {dob ? toDate(dob).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select date'}
            </Text>
            <Image source={require('../assets/calendar.png')} style={s.icon} resizeMode="contain" />
          </TouchableOpacity>
          {dobOpen && dob && (
            <DateTimePicker mode="date" display="spinner" themeVariant="dark" maximumDate={new Date()}
              value={toDate(dob)} onChange={(_, d) => { if (d) setDob(isoDate(d)) }} />
          )}
        </View>

        <View style={s.field}>
          <Label text="Sex" />
          <TouchableOpacity style={s.select} onPress={() => setSexOpen(v => !v)} activeOpacity={0.8}>
            <Text style={sex ? s.selectText : s.placeholder}>
              {SEX_OPTIONS.find(o => o.value === sex)?.label ?? 'Select'}
            </Text>
            <Image source={require('../assets/down-arrow.png')} style={s.icon} resizeMode="contain" />
          </TouchableOpacity>
          {sexOpen && (
            <View style={s.options}>
              {SEX_OPTIONS.map(o => (
                <TouchableOpacity key={o.value} style={s.option} activeOpacity={0.7}
                  onPress={() => { setSex(o.value); setSexOpen(false) }}>
                  <Text style={[s.selectText, o.value === sex && { color: colors.accent }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <NumField label="Height" unit="cm" value={height} onChange={setHeight} />
        <NumField label="Weight" unit="kg" value={weight} onChange={setWeight} decimal />
        <NumField label="Resting HR" unit="bpm" value={restHr} onChange={setRestHr} />
        <NumField label="VO2max (if known)" unit="ml/kg/min" value={vo2} onChange={setVo2} decimal />
        <NumField label="HRmax" unit="bpm" value={hrText} onChange={setHrText}
          placeholder={str(autoHr)} note={hrNote} />

        {!numsValid && <Text style={s.error}>Numbers must be above 0.</Text>}

        <TouchableOpacity style={[buttons.primary, s.cta, !canSave && { opacity: 0.5 }]}
          onPress={save} disabled={!canSave} activeOpacity={0.82}>
          <Text style={[buttons.primaryText, s.ctaText]}>{editing ? 'Save' : 'Continue'}</Text>
        </TouchableOpacity>
        {editing && (
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={s.cancel}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={s.label}>
      {text}
      {required && <Text style={s.star}> *</Text>}
    </Text>
  )
}

function NumField({ label, unit, value, onChange, decimal, placeholder, note }: {
  label: string; unit: string; value: string; onChange: (t: string) => void
  decimal?: boolean; placeholder?: string; note?: string | null
}) {
  return (
    <View style={s.field}>
      <Label text={label} />
      <View style={s.inputWrap}>
        <TextInput style={s.inputFlex} value={value} onChangeText={onChange}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder} placeholderTextColor={colors.textGhost} />
        <Text style={s.unit}>{unit}</Text>
      </View>
      {note && <Text style={s.note}>{note}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bgApp },
  container: { paddingHorizontal: 24, paddingTop: 70, paddingBottom: 40, gap: 14 },
  title:     { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 25, fontWeight: '600' },
  body:      { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },

  card:      { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, gap: 4 },
  cardLabel: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 },
  cardValue: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600' },

  nameRow:   { flexDirection: 'row', gap: 10 },
  flex:      { flex: 1 },
  field:     { gap: 4 },
  label:     { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, fontWeight: '500' },
  star:      { color: colors.danger },

  input:     { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10,
               paddingVertical: 11, paddingHorizontal: 14, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSurface, borderWidth: 1,
               borderColor: colors.borderFocus, borderRadius: 10 },
  inputFlex: { flex: 1, paddingVertical: 11, paddingHorizontal: 14, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14 },
  unit:      { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, paddingHorizontal: 12 },
  note:      { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11 },

  select:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bgSurface,
               borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14 },
  selectText:{ color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14 },
  placeholder:{ color: colors.textGhost, fontFamily: fonts.body, fontSize: 14 },
  icon:      { width: 16, height: 16, tintColor: colors.textMuted },
  options:   { backgroundColor: colors.bgCard, borderRadius: 10, borderWidth: 1, borderColor: colors.borderDefault, overflow: 'hidden' },
  option:    { paddingVertical: 12, paddingHorizontal: 14 },

  error:     { color: colors.danger, fontFamily: fonts.body, fontSize: 12 },
  cta:       { marginTop: 8, paddingVertical: 15, alignSelf: 'stretch' },
  ctaText:   { fontSize: 15 },
  cancel:    { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },
})
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → no errors. (If `colors.textMuted` / `borderDefault` / `borderFocus` / `bgSurface` are missing from `src/utils/tokens.ts`, use the names `app/signup.tsx` uses — it uses all of them.)

- [ ] **Step 3: Stop.** File: `app/personal-info.tsx`.

---

### Task 8: Routing + Settings entry

**Files:**
- Modify: `app/index.tsx`, `app/health-access.tsx`, `app/_layout.tsx`, `app/(tabs)/settings.tsx`

- [ ] **Step 1: Replace `app/index.tsx`:**

```tsx
import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { syncNow } from '../src/db/sync'
import { healthSkipped, needsHealthPrompt } from '../src/healthkit/permissions'
import { useAuthStore } from '../src/store/useAuthStore'
import { useProfileStore } from '../src/store/useProfileStore'
import { isComplete } from '../src/utils/profile'

// The one place that picks the screen after login: Health prompt → personal info (RA-11) → Dashboard.
export default function Index() {
  const session = useAuthStore(s => s.session)
  const loading = useAuthStore(s => s.loading)
  const profile = useProfileStore(s => s.profile)
  const [askHealth, setAskHealth] = useState<boolean | null>(null)
  const [synced, setSynced] = useState(false)

  useEffect(() => {
    if (!session) return
    needsHealthPrompt().then(n => setAskHealth(n && !healthSkipped()))
    // New device / reinstall: no local profile yet → wait for one sync, so a profile filled elsewhere skips the form.
    if (useProfileStore.getState().profile) setSynced(true)
    else syncNow().finally(() => setSynced(true))
  }, [session])

  if (loading) return null
  if (!session) return <Redirect href="/login" />
  if (askHealth === null || !synced) return null
  if (askHealth) return <Redirect href="/health-access" />
  return <Redirect href={isComplete(profile) ? '/(tabs)/dashboard' : '/personal-info'} />
}
```

- [ ] **Step 2: `app/health-access.tsx`** — both `router.replace('/(tabs)/dashboard')` become `router.replace('/')` (index decides next), and change the comment on line 9 to `// Then index sends the user on: personal info (RA-11) if not filled yet, else Dashboard.`

- [ ] **Step 3: `app/_layout.tsx`** — add `<Stack.Screen name="personal-info" />` after `<Stack.Screen name="health-access" />`.

- [ ] **Step 4: `app/(tabs)/settings.tsx`** — before the `{/* Apple Health */}`-box (`<View style={s.healthBox}>`) add:

```tsx
      <TouchableOpacity style={s.btn} activeOpacity={0.82}
        onPress={() => router.push({ pathname: '/personal-info', params: { mode: 'edit' } })}>
        <Text style={s.btnText}>Personal info</Text>
      </TouchableOpacity>
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit` → no errors (expo-router's typed routes accept `/personal-info` once the file exists; if typed routes are stale, run `npx expo start` once to regenerate them).

- [ ] **Step 6: Stop.** Files: the four above.

---

### Task 9: Docs

**Files:**
- Modify: `architecture.md`, `CLAUDE.md`, `docs/HANDOFF.md`

- [ ] **Step 1: `architecture.md`**
  - File Structure: add `app/personal-info.tsx` (RA-11/RA-10 form), `src/store/useProfileStore.ts`, `src/utils/profile.ts` (+ `profile.check.ts`).
  - Data Model: the new `profiles` columns (copy the table from the spec §1) and the HRmax rule (saved = manual or highest from runs; effective = saved → runs → 220 − age → 190).
  - Sync (RA-34): `profiles` is the third synced table; cloud key `user_id` ↔ local `id` via `cloudKey` / `fromCloud` in `src/db/merge.ts`; SQLite v4.
  - Onboarding: `index.tsx` decides Health → personal info → Dashboard.

- [ ] **Step 2: `CLAUDE.md`**
  - Stack → Zustand line: "One store per domain (runs, run types, profile, auth)."
  - Stack → expo-sqlite line: add `node src/utils/profile.check.ts` next to the sync self-check.
  - Conventions: "Zones use `effectiveHrMax(profile, runs, today)` from `src/utils/profile.ts`; never a hardcoded HRmax."

- [ ] **Step 3: `docs/HANDOFF.md`** — new section "Current task: RA-11 + RA-10 — `feature/add-personal-info`" with: spec + plan paths, task status, Bar's to-dos (run the migration), device-test list (Task 10), and "next: RA-9 zone methods (own spec)". Update the roadmap row 4.

- [ ] **Step 4: Stop.** Files: the three above.

---

### Task 10: Device test (Bar, dev build)

JS-only, no rebuild: `npx expo start --dev-client`. Migration from Task 1 must be applied first.

- [ ] Existing account (Bar): app opens → personal-info form; first/last name split from the old full name; Health values prefilled; HRmax placeholder with "From your runs". Continue → Dashboard. Reopen app → Dashboard (no form).
- [ ] Supabase Table Editor → `profiles`: the row has the values; `hr_max_manual = false`, `hr_max` = highest run HR.
- [ ] Settings → Personal info → type HRmax 195 → Save → row shows `hr_max = 195`, `hr_max_manual = true`. A run's Zones screen shows ranges from 195 (e.g. Z5 "176+").
- [ ] Empty the HRmax field → Save → `hr_max_manual = false`, `hr_max` back to the run max.
- [ ] Continue stays disabled with an empty first name, last name or DOB; "abc"/"0" in a number field shows "Numbers must be above 0." Red `*` on the three required labels. Sex dropdown: Male / Female / Prefer not to say.
- [ ] New email signup with First + Last name → confirm → Health → form shows those names.
- [ ] Log out / log in → no form (profile pulled from the cloud).
- [ ] Airplane mode → edit weight → Save → back online + reopen → cloud row updated.
