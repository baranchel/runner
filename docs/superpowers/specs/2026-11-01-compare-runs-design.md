# Compare Runs — Design

**Date:** 2026-11-01
**Branch:** `feature/compare-runs`
**Status:** Approved in brainstorming, pending spec review

## Goal

Let the user compare exactly 2 runs side by side. Three entry points: the Runs list, the Run Detail screen, and the Compare tab. The comparison shows basic metrics with no highlighting by default; a native toggle highlights the "better" value per metric using a placeholder rule that is easy to redefine later.

## Navigation

```
Runs tab ──[compare icon]──► selection mode
   │  tap row = check/uncheck (max 2)
   │  3rd tap → Alert: "You can compare only 2 runs. Uncheck one first."
   │  2 checked → bottom bar: "Aug 1 vs Aug 14   Compare ›   ✕"
   │     Compare › ──push──► /compare/result?a=…&b=…
   │     ✕ / re-tap compare icon ──► uncheck all, exit selection mode
   │
Run Detail ──[compare icon, top-right]──► bottom sheet
   │  other runs of the same type, newest first
   │     tap run ──push──► /compare/result?a=<this>&b=<picked>
   │     "Choose from all runs ›" ──navigate──► Runs tab with ?select=<this>
   │     ✕ / swipe down ──► close sheet, stay on Run Detail
   │
Compare tab ── two slots [Run A] [Run B]
      tap slot ──► modal run list (month groups + type chips) → fills slot
      Compare button (enabled when both filled) ──push──► /compare/result?a=…&b=…
```

`/compare/result` is a stack screen (like `/run/[id]`), so back returns to wherever the user came from.

## Behavior

### Runs tab — selection mode

- A compare icon in the Runs screen header toggles selection mode. While active, the icon is tinted `accent`.
- In selection mode, tapping a row checks/unchecks it instead of opening Run Detail. Checked rows show a drawn circle with ✓ (no image asset).
- Maximum 2 checked. Tapping a 3rd unchecked row shows `Alert.alert('You can compare only 2 runs. Uncheck one first.')` and changes nothing.
- When exactly 2 are checked, a bar appears at the bottom of the screen: the two dates (`fmtDate`, older first), a "Compare ›" button, and a ✕ button.
  - **Compare ›** pushes `/compare/result?a=<older>&b=<newer>`. Selection is kept.
  - **✕** unchecks both runs and exits selection mode.
- Unchecking a run while the bar is visible hides the bar until 2 are checked again.
- **Persistence:** selection lives in `useState` in `runs.tsx`. Tab screens stay mounted, so selection survives tab switches and visiting the comparison screen. It clears only on ✕ or re-tapping the compare icon. Killing the app resets it (no persistence to disk).
- **Incoming `select` param:** when the Runs screen receives `select=<id>`, it enters selection mode with only that run checked (replacing any existing selection), then clears the param with `router.setParams({ select: undefined })`.
- The type filter stays usable during selection. Checked runs stay checked even when the filter hides them; the bar still shows both dates.

### Run Detail — compare sheet

- Compare icon at the top-right, styled as a mirror of the existing floating back button (44×44 circle, `bg-surface`, `border-strong`).
- Tapping it opens a bottom sheet: RN `Modal` with `animationType="slide"` and `presentationStyle="pageSheet"` (native iOS sheet, swipe-down to dismiss for free; `onRequestClose` handles it).
- The sheet lists other runs with the same `typeId` as the current run (for an unclassified run: other unclassified runs), newest first, excluding the current run. Row style matches the Runs list rows.
- Empty state: "No other <Type name> runs" (or "No other unclassified runs").
- Tapping a run closes the sheet and pushes `/compare/result?a=<current>&b=<picked>`.
- A "Choose from all runs ›" row sits at the bottom of the sheet, always visible. It closes the sheet and navigates to `/(tabs)/runs` with `select=<current>`.
- ✕ in the sheet header or swiping down closes the sheet with no navigation.

### Compare tab — picker

- Title "Compare runs" (17 px / 700).
- Two slot cards side by side, with no A/B labels. An empty slot shows "Select run"; a filled slot shows type color bar, type name, date, and distance.
- Tapping a slot opens a page sheet (RN `Modal`, `presentationStyle="pageSheet"`) containing `RunPickerList` (month groups + type chips) and a close button. Tapping a run fills that slot and closes the modal.
- The run already in the other slot is shown greyed out and is not tappable.
- A "Compare" button below the slots is disabled until both slots are filled, then pushes `/compare/result?a=<A>&b=<B>`.
- Slots keep their values while the tab stays mounted.

### Comparison screen — `/compare/result`

- Floating back button (same as Run Detail).
- A row with the label "Highlight better results" and a native `Switch`, off on every visit (not persisted).
- Metrics table (style from `FRONTEND_SPEC.md` §5: border `border-default`, radius 10, header row: empty metric cell, then per run its type name (in run type color) over its date, right-aligned, tap → that run's `/run/[id]`; columns `1fr 0.8fr 0.8fr`; values in JetBrains Mono). No A/B labels in the UI..
- Missing value → "—".
- Toggle on → for each metric, the better value in that row gets `accent` color and font-weight 700. Ties, `none` metrics, and rows with a missing value highlight nothing.
- Bad or missing `a`/`b` param, or a run id not found → "Run not found" plus the back button.

## Metrics and the "better" rule

"Better" is judged per row only: each metric row independently highlights its better value. There is no overall verdict on which run is better, and no score or count of row wins.

All in `src/utils/compare.ts`:

```ts
type Better = 'higher' | 'lower' | 'none'

interface CompareMetric {
  label: string
  get: (run: Run) => number | null
  fmt: (value: number, unit: 'km' | 'mi') => string
  better: Better
}

export const COMPARE_METRICS: CompareMetric[]
export function betterValue(m: CompareMetric, a: Run, b: Run): 'a' | 'b' | null
```

| Row | Value | Format | Placeholder `better` |
|---|---|---|---|
| Distance | `distanceKm` | `fmtDistance` | higher |
| Time | `timeSec` | `fmtMMSS` | lower |
| Avg Pace | `timeSec / distanceKm` | `fmtPace` | lower |
| Avg HR | `avgHr` | `"<n> bpm"` | lower |
| Max HR | `maxHr` | `"<n> bpm"` | lower |
| Elevation | `elevGain` | `"<n> m"` | higher |
| Cadence | `cadence` | `"<n> spm"` | higher |
| Calories | `round(distanceKm * 62)` (same formula as Run Detail) | `"<n> kcal"` | none |
| Primary Zone | `computePrimaryZone(run)?.zone` | `"Zone <n>"` | none |
| Weather | `weather?.tempC` | `"<n>°C"` | none |

`betterValue()` returns `null` when `better === 'none'`, either value is null, or values are equal. To redefine "better" later, edit the `better` field (or replace `betterValue()`); no UI changes needed.

Units: all formatting takes `UNIT`, hardcoded `'km'` like `runs.tsx` today, until `useUserStore` exists.

## Files

**New**

| File | Purpose |
|---|---|
| `app/compare/result.tsx` | Comparison screen |
| `src/utils/compare.ts` | `COMPARE_METRICS`, `betterValue()` |
| `src/utils/compare.check.ts` | Assert-based self-check for `betterValue()` |
| `src/components/RunPickerList.tsx` | Month-grouped run list with type chips, extracted from `runs.tsx` (`buildSections`, `MonthHeader`, `RunRow`, `TypeFilterBar`). Props: `onPressRun(run)`, optional `checkedIds: string[]`, optional `disabledIds: string[]`. |

**Changed**

| File | Change |
|---|---|
| `app/(tabs)/runs.tsx` | Uses `RunPickerList`; adds compare icon, selection state, bottom bar, 3rd-run alert, `select` param handling |
| `app/run/[id].tsx` | Compare icon (top-right) + same-type bottom sheet |
| `app/(tabs)/compare.tsx` | Replaces placeholder with slots, picker modal, Compare button |
| `FRONTEND_SPEC.md` §5 | Rewrite to match this design (slots instead of `<select>`, 10 rows, highlighting behind a toggle, off by default) |
| `architecture.md` | Add new files to the file tree |

**Asset:** `assets/compare.png` (already in repo), tinted in code like the other icons.

No new dependencies. Uses RN `Modal`, `Switch`, `Alert`.

## Testing

- No test framework in the project; none added.
- `src/utils/compare.check.ts` asserts `betterValue()` for: higher wins, lower wins, tie → null, `none` → null, missing value → null. Run with `npx tsx src/utils/compare.check.ts`.
- Manual checklist in Expo Go (mock data):
  1. Runs: icon enters selection mode; check 2 → bar shows both dates; 3rd tap → alert; uncheck one → bar hides.
  2. Runs: ✕ clears and exits; re-tapping the icon clears and exits.
  3. Runs: select 2, switch to Dashboard and back → still selected; open comparison and go back → still selected.
  4. Run Detail: icon opens sheet with same-type runs only, current run excluded; tap one → comparison.
  5. Run Detail: "Choose from all runs ›" → Runs tab in selection mode with that run checked.
  6. Run Detail: ✕ / swipe-down closes the sheet with no navigation.
  7. Compare tab: fill both slots; other slot's run greyed out; Compare enabled only when both filled.
  8. Comparison: toggle off → no highlights; on → better values highlighted per row; "—" rows never highlighted.
  9. Comparison: header tap opens Run Detail; `/compare/result?a=bad` shows "Run not found".

## Out of scope

- Comparing more than 2 runs
- Side-by-side splits or overlaid charts
- Persisting selection or toggle state across app restarts
- Final definition of "better" (placeholder rule only)
