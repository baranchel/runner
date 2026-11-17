# Run Zones View — Design

**Date:** 2026-09-23
**Branch:** `HR-and-zones-screen`
**Status:** Approved for implementation

## Goal

Let the user open a dedicated screen from a run's HR chart that shows the
heart-rate trace together with a **time-in-zone** breakdown table. Phase 1 runs
entirely on mock data; the zone-boundary source becomes a real per-user value in
a later phase.

Monthly/aggregate zones summary is **out of scope** for this spec — deferred to a
follow-up.

## Background (what already exists)

- `Run.zones: [number,number,number,number,number] | null` — seconds per zone
  1–5. Already populated in `src/mockData.ts`.
- `src/utils/zones.ts` — `ZONE_NAMES` (`Very Easy, Easy, Aerobic, Threshold, Max`)
  and `computePrimaryZone(run)`.
- Run detail (`app/run/[id].tsx`) already renders a "Primary Zone" summary card
  and a `HEART RATE` chart (`HrRangeBarsChart` in `src/components/Chart.tsx`).
- Sub-screen pattern: `app/run/[id]/splits.tsx` and `segments.tsx` are full
  screens opened from a tappable `LABEL ›` chevron header on run detail. Shared
  table styling lives in `SplitsTable.tsx` (`tableStyles`).

## Decisions

1. **Table form**, styled like Splits/Segments — columns **Zone | Range (bpm) |
   Time | %**, one row per zone Z1→Z5, plus a **Total** row.
2. **Entry point:** a tappable **`HEART RATE ›` chevron header** above the HR
   chart on run detail (same mechanism as SPLITS/SEGMENTS). We do **not** make the
   chart body itself the tap target — it captures horizontal drags for scrubbing
   (the reason swipe-back is disabled on run detail), so a body tap would fight
   the gesture.
3. The opened screen shows **both** the HR chart and the zones table, so the user
   sees their HR trace and how it maps to zones on one screen.
4. **Zone boundaries (now):** derived from a single placeholder HRmax constant
   (`190` bpm) using standard %-of-max bands (50/60/70/80/90/100%). Later swaps to
   a real per-user value (auto from age = `220 − age`, then user-overridable).
5. **Colors:** 5 new tokens `zone1…zone5`, ramping **yellow → strong red**.

## Components & Changes

### `src/utils/tokens.ts`
Add 5 zone colors (warm ramp) and a helper:

```ts
zone1: '#e8c200',  // yellow
zone2: '#e89a00',  // amber
zone3: '#e06f00',  // orange
zone4: '#dc4a28',  // red-orange
zone5: '#d21f1f',  // strong red
```
```ts
export const ZONE_COLORS = [zone1, zone2, zone3, zone4, zone5]
export const zoneColor = (i: number): string => ZONE_COLORS[i] ?? colors.textGhost
```
(Also mirror these into FRONTEND_SPEC.md → Design Tokens, since it is the visual
source of truth. Exact oklch values can be tuned there.)

### `src/utils/zones.ts`
Add boundary + range helpers:

```ts
export const MOCK_HR_MAX = 190  // ponytail: placeholder until per-user HRmax setting exists

// lower-bound bpm for each zone at 50/60/70/80/90% of HRmax
export function zoneBounds(hrMax = MOCK_HR_MAX): [number,number,number,number,number]

// display string per zone index: "<114", "114–133", …, ">171"
export function zoneRangeLabel(i: number, hrMax = MOCK_HR_MAX): string
```

Rounding: `Math.round(hrMax * pct)`. Z1 shows `<lower(Z2)`, Z5 shows `>lower(Z5)`,
middle zones show `lower–(nextLower−1)`.

### `app/run/[id]/zones.tsx` (new)
- Same header chrome as `splits.tsx` (✕ close, centered title **"Heart Rate"**).
- `run = MOCK_RUNS.find(...)`; render "Run not found" fallback like splits.
- Body (`ScrollView`):
  1. Reuse `HrRangeBarsChart` with the same `dots`/`timeSec` derivation used in
     `ChartsSection` (extract the HR-dots helper so both callers share it, rather
     than duplicating the normalization math).
  2. Zones table using `tableStyles`: header row, 5 zone rows, Total row.
     - Zone cell: `Z{n}` + `ZONE_NAMES[i]`, colored `zoneColor(i)`.
     - Range cell: `zoneRangeLabel(i)`.
     - Time cell: `fmtMMSS(run.zones[i])` (or `fmtDuration` — match Splits, which
       uses `fmtMMSS`).
     - % cell: `Math.round(run.zones[i] / run.timeSec * 100)`%.
     - Total row: total time = `sum(run.zones)`, `100%`.
- If `run.zones` is null: render the table area with an empty/"No zone data" state
  (mirrors how segments are conditionally absent).

### `app/run/[id].tsx`
Wrap the existing `HEART RATE` chart block in a `TouchableOpacity` that
`router.push(\`/run/${run.id}/zones\`)`, and change the section label to the
`tapHeader` + `tapChevron` pattern already used for SPLITS/SEGMENTS. Leave the
existing "Primary Zone" summary card as-is.

## Data Flow

`run.zones` (seconds/zone, mock) + `MOCK_HR_MAX` (for range labels) →
`zones.tsx` renders chart (from HR dots) + table (time, %, range per zone). No new
data sources; no HealthKit. Percentages are derived, boundaries are derived from
one constant.

## Testing

Deterministic pure functions get one self-check each (no framework):
- `zoneBounds(190)` → `[95,114,133,152,171]` (50/60/70/80/90%).
- `zoneRangeLabel` → `['<114','114–132','133–151','152–170','>171']`.
- Percentages sum to 100 (±1 from rounding) for a sample `run.zones`.

Visual check in Expo Go: open a run → tap HEART RATE → chart + table render, zone
colors ramp yellow→red, Total row = run time.

## Out of Scope / Later

- Monthly / all-runs zones aggregation (total-seconds vs. percentage — TBD in its
  own spec).
- Real HRmax: auto from age (`220 − age`) then user-editable boundaries setting.
- Computing `run.zones` from real HealthKit HR samples (replaces mock values).
