# Custom HR Zones (RA-9, most of RA-21) — Design

Branch `feature/hr-zones` · 2026-11-21 · approved in brainstorm with Bar. Mockup: `.superpowers/brainstorm/372-1795260023/content/zones-full-v6.html` (gitignored).

## Goal

The user picks how their 5 heart-rate zones are calculated: % of max HR (default), heart-rate reserve, lactate threshold, or manual. They pick once during onboarding, before reaching the Dashboard, and can change it later in Settings. Every run, past and future, shows time-in-zone by the current method. Changing the method updates all runs instantly, offline and on every device.

**Key decision:** each run stores a **heart-rate histogram** (seconds at each bpm) instead of its 5 zone totals. Zones are calculated on screen from the histogram plus the user's current zones, so recalculation needs no Apple Health re-read and no extra code. Rejected alternatives: re-reading HR from Apple Health when the method changes (slow, only on the phone that has the run, needs an "old zones" fallback), and storing the raw HR stream (10–50× bigger, nothing gained).

**Out of scope:** zone renaming (later, `ZONE_NAMES` stays the one place), imperial units (RA-6), monthly summaries (RA-22, which will use the same `zoneTimes`).

## 1. Data

### Runs

| change | cloud (`public.runs`) | phone (SQLite) |
|---|---|---|
| add `hr_hist` | `jsonb` | `TEXT` (JSON col) |
| drop `zones` | `drop column zones` | `ALTER TABLE runs DROP COLUMN zones` |

`hr_hist` is `{ "<bpm>": seconds }`, with bpm floored to an integer (a fractional 156.6 stays below a zone starting at 157, matching Fitness) and seconds rounded to an integer; paused time (pause/resume, auto-pause) is not counted. It's null when the run has no HR samples. It's about 0.5–1 KB per run.

`Run.zones` is removed from `src/types`, and `Run.hrHist: Record<string, number> | null` is added. `merge.ts` `JSON_COLS` and `queries.ts` column lists change to match.

### Profiles

| column | cloud | phone | notes |
|---|---|---|---|
| `zone_method` | `text check (zone_method in ('hrmax','hrr','lthr','manual'))`, nullable | `TEXT` | **null = not chosen yet** (onboarding shows the screen). Zones use % Max meanwhile. |
| `lthr` | `double precision` | `REAL` | LTHR method only |
| `zone_bounds` | `jsonb` | `TEXT` (JSON) | Manual only: 4 bpm values where Z2–Z5 start, strictly increasing |

`ProfileRow` gets the 3 fields. They go through the existing profile sync (`writeChange('profiles', …)`), with no sync changes beyond the column lists.

### Migrations

- `supabase/schema.sql` updated, plus a one-off script `supabase/migrations/2026-11-21-hr-zones.sql` (add columns, drop `runs.zones`). Bar runs it in the SQL Editor **before** opening the new code. A push rejected for a missing column is marked `failed` for good.
- SQLite `VERSION = 5`: `if (v < 5)` adds `runs.hr_hist`, drops `runs.zones`, and adds the 3 profile columns.
- **Re-import once:** existing runs have no histogram, so they'd show "No zone data". Bar runs `delete from public.runs;`, then logs out and in (same as RA-3). Dev data only.

## 2. Zone math: `src/utils/zones.ts` (pure, self-check `node src/utils/zones.check.ts`)

```ts
type Starts = [number, number, number, number]   // bpm where Z2..Z5 start; Z1 = below Starts[0]
zoneStarts(p: ProfileRow | null, hrMax: number): Starts
zoneTimes(hist: Record<string, number> | null, s: Starts): [number, number, number, number, number] | null
hrHistogram(samples, …): Record<string, number> | null   // lives in mapWorkout (same time weighting as today)
zoneRangeLabel(i: number, s: Starts): string               // "below 111", "111–129", "167 and up"
computePrimaryZone(hist, s)                                // was (run); now from zoneTimes
```

| method | Z2 / Z3 / Z4 / Z5 start | needs |
|---|---|---|
| `hrmax` (default, also when null) | 60 / 70 / 80 / 90 % × HRmax | HRmax |
| `hrr` (Karvonen) | rest + 60 / 70 / 80 / 90 % × (HRmax − rest) | resting HR |
| `lthr` | 85 / 90 / 95 / 100 % × LTHR (common running version, Friel 5a–5c merged into Z5) | LTHR |
| `manual` | `zone_bounds` | 4 values |

- All values are rounded to whole bpm.
- A method whose value is missing (resting HR cleared later, broken `zone_bounds`) **falls back to % Max** instead of failing.
- A sample exactly on a start goes to the upper zone, as today.
- HRmax is always `effectiveHrMax(profile, runs, today)` (CLAUDE.md rule).

**One hook:** `useZoneStarts()`, exported from `src/store/useProfileStore.ts`, returns `zoneStarts(profile, effectiveHrMax(...))`. It's used by:
- `app/run/[id]/zones.tsx`: bars from `zoneTimes(run.hrHist, starts)`, ranges from `zoneRangeLabel`. "No zone data for this run" when `hrHist` is null.
- `app/run/[id].tsx`: the Primary zone stat.
- `src/utils/compare.ts`: the Primary Zone row. The row getters need the starts, so the compare call takes them as an argument.

**Import:** `mapWorkout` builds `hrHist` instead of `zones`, and no longer takes `hrMax`. `importRuns.ts` drops the `hrMax` lookup and its `ponytail:` comment. The real-run fixture in `import.check.ts` asserts `hrHist` (sum of seconds ≈ the HR-weighted time).

## 3. Screen: `app/hr-zones.tsx`

The same screen serves onboarding and Settings (`?mode=edit`, which adds Cancel and returns with `router.back()`).

- **Title** "Your heart-rate zones", sub "Same heart, four ways to split it into 5 zones. Tap one to compare."
- **4 vertical columns**, always vertical, one per method (% Max · Reserve · LTHR · Manual), each a stack of the 5 zone colours (`zoneColor(i)`) on one shared bpm axis drawn from the user's own numbers. Each has a radio dot and a label below. % Max has "Default" under its label. Tapping a column or label selects it. The selected one has a lime border and full opacity; the others are at 55% opacity. Columns are drawn with plain `View`s (flex heights), no SVG needed.
- A column whose value is missing shows an empty dashed column with "?". Manual is never empty: it starts from the % Max values.
- **Card below** (follows the selection):
  - % Max / Reserve / LTHR: title, one-line explanation (copy from the mockup, using the user's numbers), and the **5-row bpm table** (swatch, `Z1 Very Easy`, range).
  - Missing value (Reserve without resting HR, LTHR without LTHR): the card asks for it inline (number field + "bpm"; LTHR adds how to find it: watch, or a 30-min all-out test, average HR of the last 20 min). The column fills in as soon as it's valid.
  - **Manual:** title "Set your own zones", text "You decide where each zone starts. Use your coach's numbers or a lab test.", hint "Set the heart rate (bpm) where each zone starts." Then "Start from: [% Max] [Reserve] [LTHR]" chips that copy those values (a chip is hidden when its method has a missing value). Rows: `Z1 Very Easy  below <Z2>` (read-only), then `Z2..Z5 starts at  [−] [bpm] [+]  –<end>` / `and up`. −/+ change by 1 bpm. The Manual column redraws live. If a start isn't above the previous one, the field turns red, the error "Each zone must start higher than the one before it." shows, and the button is disabled. Valid bpm is 40–230.
  - Manual values typed so far are kept while the user taps other methods.
- **Button** names the choice: "Use % Max" / "Use Reserve" / "Use LTHR" / "Use my zones". Disabled while the selection is invalid.
- **Confirm pop-up** (`Modal`, transparent dark veil): "Use % of max heart rate?" (Manual: "Use your own zones?"), "Your zones will be:", the 5-row table, and "All your past runs will be updated to these zones. You can change this anytime in Settings." Buttons: **Yes, use these zones** (primary) and **Go back**.
- **On confirm:** one `useProfileStore.save` with `zone_method`, plus `lthr` / `zone_bounds` / `resting_hr` when the method uses them (only the fields that changed). Then onboarding → `router.replace('/')`, edit → `router.back()`.
- **Opening state:** the saved method, or % Max when null. Edit mode preloads saved `lthr` / `zone_bounds`.

Styles follow `FRONTEND_SPEC.md` tokens (`colors`, `fonts`, `buttons`), like `personal-info.tsx`.

## 4. Flow

- Onboarding: **Signup → Health permission + first import (unchanged, with progress) → Personal info → HR zones → Dashboard.** Since the import finishes first, the preview uses HRmax from the user's runs, not 220 − age.
- `app/index.tsx`: after the existing `isComplete(profile)` rule, add `profile.zone_method == null → /hr-zones`.
- `app/_layout.tsx`: register `hr-zones` in the signed-in group.
- Settings: new row **Heart-rate zones** → `/hr-zones?mode=edit`.
- The existing user (Bar) sees the zones screen once on next launch (`zone_method` null). Expected.
- Personal info saving a new HRmax or resting HR updates all zone displays automatically through the hook.

## 5. Testing

- `node src/utils/zones.check.ts`, with the sample user HRmax 185 / rest 55 / LTHR 168:
  - % Max → 111 / 130 / 148 / 167.
  - Reserve → 133 / 146 / 159 / 172.
  - LTHR → 143 / 151 / 160 / 168.
  - Manual passes through.
  - null method → % Max.
  - Reserve with no resting HR → % Max.
  - Bad `zone_bounds` (not increasing, wrong length) → % Max.
  - `zoneTimes`: boundary sample goes up, null hist → null.
  - `zoneRangeLabel` strings.
- `node src/healthkit/import.check.ts` (fixture asserts `hrHist`), `node src/db/sync.check.ts`, `node src/utils/profile.check.ts`, `npx tsc --noEmit`.
- **Device (dev build, JS only, no rebuild):**
  1. Run the migration, delete runs, log out and in → import → personal info → zones screen shows your real HRmax.
  2. Tap each column: card and ranges change. Reserve/LTHR ask for missing values inline.
  3. Manual: −/+ and typing move the column; an invalid order shows the error and disables the button; "Start from" chips copy values.
  4. Confirm pop-up shows the right ranges; Go back keeps the selection.
  5. Dashboard → a run's Heart Rate screen matches the chosen zones.
  6. Settings → Heart-rate zones → switch method → the same run's bars and Primary zone change immediately.
  7. Log out and in: the method is kept (cloud).

## 6. Jira (edit after Bar approves this spec)

- **RA-9:** add the onboarding step after Personal info; the vertical column preview with "Default" under % Max; card with bpm table, inline missing value, Manual "starts at" −/+ controls with "Start from"; confirm pop-up with ranges; saving updates all past runs instantly.
- **RA-21:** recalculation now comes from the stored HR histogram. Remove the criteria "re-read HR samples from Apple Health" and "old zones note". The rest (Heart Rate screen uses the user's zones, "No zone data", automatic zones until set) is delivered by this branch.
