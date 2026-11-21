# Personal Info (RA-11) + Edit Profile (RA-10) — Design

Branch `feature/add-personal-info` · 2026-11-21 · approved in brainstorm with Bar.

## Goal

Right after signup (and the Health permission step) the user fills one personal-info form, prefilled from Apple Health and the sign-in name. The same screen opens from Settings to edit it later. The data lives in the cloud, so a new device never asks again. HRmax from this profile replaces `MOCK_HR_MAX = 190`.

**Out of scope:** imperial units (RA-6, form is cm/kg for now), zone methods (RA-9, zones stay % of HRmax), re-computing zone times of already-imported runs (RA-21).

## 1. Data

### Cloud (`supabase/schema.sql` + `supabase/migrations/2026-11-21-profile.sql`)

New nullable columns on `public.profiles`:

| column | type | notes |
|---|---|---|
| `first_name` | text | required by the form (not by the DB) |
| `last_name` | text | required by the form |
| `dob` | date | required by the form |
| `sex` | text | `check (sex in ('female', 'male', 'undisclosed'))` — `undisclosed` = "Prefer not to say" |
| `height_cm` | double precision | |
| `weight_kg` | double precision | |
| `resting_hr` | double precision | |
| `vo2max` | double precision | |
| `hr_max` | double precision | |
| `hr_max_manual` | boolean not null default false | true = user typed HRmax; auto-updates stop |

RLS, grants and the `touch` trigger already cover `profiles`.

### Phone (SQLite v4)

- New `profiles` table (same name as the cloud, so `writeChange('profiles', …)` works unchanged), one row for the signed-in user, local `id` = `user_id`, same columns as above plus `unit` (`hr_max_manual` as 0/1).
- `profiles` becomes the third synced table: `TABLES = ['profiles', 'run_types', 'runs']`.
- `src/api/sync.ts` maps local `id` ↔ cloud `user_id` for `profiles` (push: rename key, upsert `onConflict: 'user_id'`; pull: rename back). No other table changes.
- `clearAll()` also clears `profiles`.

### Store: `src/store/useProfileStore.ts`

- `profile: Profile | null`, `load()` (from SQLite), `save(patch)` → `writeChange('profiles', 'update', { id: userId, ...patch })` → `load()` → `syncNow()`.
- Reloads on `onPulled`, like the runs store.
- `isComplete(p)` = first name, last name and DOB all set.

## 2. Signup: first + last name

- `app/signup.tsx`: the "Full name" field becomes two fields, **First name** and **Last name**, side by side (or stacked on narrow screens), both required.
- `signUp(firstName, lastName, email, password)` saves `user_metadata = { first_name, last_name }`.
- Apple: save `givenName` → `first_name`, `familyName` → `last_name` (same one-retry rule).
- Google: Supabase already stores the Google name (`full_name` / `name`) in `user_metadata`; it is split like an old account's name (no extra call).
- Old accounts with only `user_metadata.name` (and Google): split on the first space (first word = first name, rest = last name). Editable in the form.
- A helper in `src/api/auth.ts` returns `{ firstName, lastName, email, method }` from the session, so screens never read Supabase metadata directly.

## 3. Screen: `app/personal-info.tsx`

One screen, two modes.

- **Onboarding:** `health-access` "Connect" and "Not now" both go back to `/` instead of the dashboard, and `app/index.tsx` decides: Health prompt still needed → `health-access`; profile not complete → `/personal-info`; else dashboard. (So connecting Health later from Settings doesn't reopen a complete form.) This also covers Bar's existing account and any account that skipped the form. When there's no local profile row yet (new device / reinstall), `index` waits for one `syncNow()` (success or failure) before deciding, so a profile that's complete in the cloud skips the form. Offline on a brand-new device the form shows; saving it there is fine (last write wins). Button: **Continue** → `router.replace('/')` (index sends a complete profile to the dashboard).
- **Edit (RA-10):** a "Personal info" button in Settings → same screen with saved values. Button: **Save** → back.

**Prefill, per field:** saved value → Apple Health (`readBodyData()`) → sign-in name (names only). Health `sex: 'other'` is not prefilled (no matching option). `readBodyData()` formats the DOB from local date parts (`toISOString()` is UTC and can land on the day before in Israel).

**Layout** (tokens from `FRONTEND_SPEC.md`, cards/inputs/buttons like the existing auth screens; no Figma frame, so the layout follows the auth screens):

1. Read-only card: sign-in email + method (Apple / Google / Email).
2. **First name** ★, **Last name** ★, **Date of birth** ★ (native date picker, `@react-native-community/datetimepicker`, already installed; `calendar.png` icon).
3. **Sex** — dropdown: Male / Female / Prefer not to say. Tapping the field opens the option list under it (`down-arrow.png` chevron). Built from existing RN components, no new package.
4. Height (cm), Weight (kg), Resting HR (bpm), **VO2max (if known)**, HRmax (bpm).
5. Under HRmax: note "From your runs" or "Estimated: 220 − age".

**Required marker ★:** a red `*` text after each required label, in `colors.danger`, same font as the label (scales with iOS text size; no image asset).

**Validation:** Continue/Save is disabled until first name, last name and DOB are filled. Optional fields can stay empty. Numbers: digits (and one decimal for weight / VO2max) only; empty = null. DOB must be in the past.

## 4. HRmax

Pure logic in `src/utils/profile.ts` (with the other profile helpers; runs under plain `node`):

- `autoHrMax(runs)` = highest `maxHr` across runs, or null.
- `effectiveHrMax(profile, runs, today)`: `profile.hr_max` if set → else `autoHrMax` → else `220 − age` (DOB) → else 190.
- The saved `hr_max` is either the user's own value (`hr_max_manual = true`) or the highest HR from runs (never the 220 − age estimate, so real runs can replace it later).
- Form: when manual, the HRmax field shows the saved value. Otherwise it is empty, with the auto value (from runs, else the estimate from the DOB as entered) as placeholder and its note. Typing a value → manual. Emptying the field → back to auto.
- **After each import** (`importNewRuns`): if `hr_max_manual` is false and the highest new `maxHr` is above the saved `hr_max`, save the new value.
- `MOCK_HR_MAX` is removed. `zoneBounds` / `zoneRangeLabel` take `hrMax` as a required argument, callers pass the effective value; `importRuns.ts` passes it to the zone computation.

## 5. Errors

- Health read fails / denied → fields stay empty, form filled by hand.
- Save works offline (outbox); syncs when back online.
- `readBodyData()` already swallows errors per field.

## 6. Testing

- `node src/db/sync.check.ts`: add a profile push/pull round-trip (`id` ↔ `user_id` mapping).
- `node src/utils/profile.check.ts`: name split, local ISO date, number parsing, auto from runs, manual stays put, new higher run raises auto only when not manual, 220 − age fallback, 190 last resort.
- **Device (dev build):** new signup with first/last name → Health → form prefilled → Continue → dashboard; Bar's existing account sees the form once (names split from the old full name); edit from Settings; offline save syncs later; second device / reinstall skips the form; Apple and Google sign-in prefill names.

## Bar to do

- Run `supabase/migrations/2026-11-21-profile.sql` in the Supabase SQL Editor before the new code first syncs.
- JS-only change; no new dev build needed.
