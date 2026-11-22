# RA-39 Set Run Type Manually — Design

Branch `feature/run-type`. Mockups (gitignored): `.superpowers/brainstorm/886-1795350874/content/run-type-picker.html` (pill, picker option A chosen), `new-run-prompt-v2.html` (option B chosen), `bulk-set-type.html` (bulk Select mode).

## Goal

1. The user can set or change the type of any run, past or new, from Run Detail. They don't have to.
2. A run that **started after the user's account was created** must get an answer from the user (a type, or "Unclassified"). A lime card on the Dashboard keeps asking until every such run has one.
3. The user can set one type on many runs at once (All runs → Select → Select all → Set type), e.g. after coming back from a long logout with dozens of waiting runs.

Runs from before signup never need an answer, so there's no backlog of hundreds of runs. A run made while logged out still asks after the next login (it started after signup and is new to the cloud).

## Data

New column **`runs.needs_type`**: `true` = new run waiting for the user's answer.

- Cloud: `supabase/schema.sql` + `supabase/migrations/2026-11-22-needs-type.sql`:
  `alter table public.runs add column needs_type boolean not null default false;`
  Bar runs it in the SQL Editor **before** opening the new code. A push the server rejects for an unknown column is marked `failed` for good, and that run would stay local-only.
- SQLite: `VERSION = 7`, `if (v < 7) ALTER TABLE runs ADD COLUMN needs_type INTEGER NOT NULL DEFAULT 0`. The `runs` column list in `queries.ts` gets `needs_type`.
- `Run.needsType: boolean`. `rowToRun` maps `needs_type === 1 || needs_type === true` (SQLite gives 1/0, the cloud gives a boolean). `runToRow` writes `needs_type`.
- Default `false` = every existing row is "answered". No backfill.

Why a separate flag instead of using `type_id`: "Unclassified, approved by the user" and "not looked at yet" both have `type_id = null`.

## Import

`src/healthkit/importRuns.ts`: the row is `{ ...runToRow(mapped), needs_type: needsType(mapped.startedAt, createdAt) }`, where `createdAt = useAuthStore.getState().session?.user.created_at` (Supabase account creation time; no new setting to store or sync).

`needsType(startedAt, createdAt)` in `src/healthkit/mapWorkout.ts`: `true` when both are known and the run started after the account was created; otherwise `false` (no session or no start time → never ask).

- The import stays insert-only (`writeChange('runs', 'insert', …)` = `INSERT OR IGNORE` locally, `ignoreDuplicates` in the cloud). A run already saved keeps its `type_id`, `needs_type`, `notes` and `edits`, so logging out and in never brings the card back for answered runs.
- Users who tap "Not now" on Health and connect later: runs between signup and connecting ask too (made after the first login; intended).
- Dev note: after `delete from public.runs;` every run since the account was created asks again.

## Saving

`useRunStore.setType(ids: string[], typeId: string | null)` (one function for one run or many):
for each id `writeChange('runs', 'update', { id, type_id: typeId, needs_type: false })`, then one `load()` and one `syncNow()`.
ponytail: one outbox op + one HTTP update per run (same as the first import); a bulk RPC only if hundreds of runs at once proves slow.
Same path as Edit Run, so it works offline and syncs later. The run's `name` is never touched (renaming stays in Edit). Every screen reads `useRunStore`, so the run card, All runs filter, month stats and Compare update straight away.

## Picker (reusable)

`pickRunType(title, currentTypeId, onPick)` in `src/components/RunPickerList.tsx`, built on the existing `pick()` (native `ActionSheetIOS`, the same sheet as the All runs type filter):
- Options: `Unclassified`, then the user's types in store order. The current one is shown as `✓ <name>`; `currentTypeId` `undefined` = no ✓ (bulk, and any run still waiting for its answer, so it never shows "✓ Unclassified" before the user chose it). Cancel = nothing happens.
- `onPick(typeId | null)`.
- RA-15's **Change** button reuses it as is.

## Run Detail

The kicker line (`● EASY · SAT 15 NOV 2026`) becomes:
- A **pill**: type colour at 25% as background, a dot, the name and `▾` in the type colour (`runTypeColor(hue)`). Unclassified uses `colors.textGhost`. Height 28, radius 14, Inter 11/600.
- The date stays next to it as the existing kicker text style.
- Tap → `pickRunType('Run type', run.typeId, id => setType(run.id, id))`.

## Dashboard "New run" card

Shown at the top of the Dashboard (above the week card) when at least one run has `needsType`:
- Lime card (`colors.lime`, ink text, radius 18 like the mockup): kicker `NEW RUN · NEEDS A TYPE` + `1 of N` badge when N > 1, run name, `date · distance · time` in mono, a dark **Choose type ▾** button.
- Shows the **oldest** waiting run first.
- **Choose type** → `pickRunType(<run name>, run.typeId, id => setType(run.id, id))`. Cancel → the card stays. Picking a type (including Unclassified) → the card moves to the next run or disappears.
- Tapping the card body opens Run Detail. Picking from the pill there also clears it.
- The card component is local to `app/(tabs)/dashboard.tsx` (one user, no shared component).

## All runs: type filter + Select mode

**Filter.** The type filter (`pickType`, used by All runs and the Compare run picker) gets an **Unclassified** option after "All types": a sentinel `UNCLASSIFIED = 'unclassified'` in `RunPickerList.tsx`. `buildSections` matches it to `typeId === null`; `typeLabel` and `MonthHeader` show "Unclassified" with the grey `textGhost` dot.

**Select mode** (`app/(tabs)/runs.tsx`):
- A lime **Select** text button at the right of the "All runs" title; it reads **Done** while selecting. One `mode` state: `'none' | 'compare' | 'bulk'`. Entering one mode leaves the other; Compare keeps its own button and its 2-run limit.
- In bulk mode every run card shows the check circle (existing `RunCard checked`), no limit. Tapping a card toggles it.
- Bottom bar (same style as the Compare bar): **Select all** / **Deselect all** (all runs the current filter shows; "Deselect all" when they're all checked) · `N selected` · **Set type ▾** (disabled at 0) · ✕.
- **Set type ▾** → `pickRunType('Set type for N runs', undefined, id => setType(selectedIds, id))`, then the mode closes.

**Dashboard shortcut.** With 2+ waiting runs, the card shows **Set all N ›** → `router.navigate({ pathname: '/runs', params: { bulk: '1' } })`. All runs then opens bulk mode with the filter on "All types" and exactly the `needsType` runs checked (same pattern as the existing `select` param).

## Checks

- `node src/healthkit/import.check.ts`: `needsType` (after signup → true, before or equal → false, missing start or createdAt → false).
- `node src/db/sync.check.ts`: `runToRow`/`rowToRun` carry `needsType` (`1` and `true` → true, `0`/missing → false).
- Re-import tripwire (also in `sync.check.ts`, reads source files as text): `importRuns.ts` saves with `writeChange('runs', 'insert'`, the `writeChange` insert path uses `INSERT OR IGNORE`, and `src/api/sync.ts` pushes inserts with `ignoreDuplicates: true`. If someone changes any of these, the check fails, because a re-import could then overwrite a type the user set.
- The Unclassified filter is a one-liner in `RunPickerList.tsx` (imports react-native, so no node check); covered by the device test.
- `tsc` clean. Device test (Bar): set/change a type from the pill (card, filter, month stats, Compare update); bulk: Unclassified → Select all → Set type; Dashboard "Set all N" opens with the waiting runs checked; offline change syncs; a new Watch run shows the Dashboard card; Unclassified clears it; logout/login → the type is kept and no card appears for old runs.

## Docs

- `architecture.md`: `needs_type`, `setType`, `pickRunType`, the Dashboard card, All runs Select mode + Unclassified filter.
- `CLAUDE.md` Data Rules: HealthKit import never overwrites `type_id` / `needs_type`; runs that started after the account was created get `needs_type = true`.
- `docs/HANDOFF.md`: RA-39 section + Bar's to-do (migration first).

## Out of scope

- Type suggestions (RA-15), colours in the picker (option B, rejected for now), editing the type list itself.
