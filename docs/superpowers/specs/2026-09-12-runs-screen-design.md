# Runs Screen — Design Spec

**Date:** 2026-09-12  
**Branch:** feature/runs-screen  
**Status:** Approved

---

## Overview

Replace the placeholder Runs screen with an Apple Fitness-style grouped list. Runs are grouped by calendar month, always expanded. A sticky type filter bar at the top lets the user narrow runs by type; month headers show both overall and filtered stats simultaneously.

---

## Layout

```
┌─────────────────────────────────────┐
│  Type filter chips (fixed/sticky)   │
├─────────────────────────────────────┤
│  SectionList (scrollable)           │
│  ┌───────────────────────────────┐  │
│  │ SEPTEMBER 2026                │  │  ← sticky section header
│  │ All runs   8 runs · 62.4 km · 7h 12m │
│  │ ● Easy Run 4 runs · 24.1 km · 3h 20m │  ← only when filter active
│  ├───────────────────────────────┤  │
│  │  run row                      │  │
│  │  run row                      │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ AUGUST 2026                   │  │
│  │ ...                           │  │
└─────────────────────────────────────┘
```

---

## Components

### 1. Type Filter Chips (sticky)

- Fixed `View` above the `SectionList`, not part of the scroll.
- Background: `bg-card`, padding 12px vertical, border-bottom `border-subtle`.
- Contents: horizontal `ScrollView` (handles many types without wrapping).
- Chips: `[ All ]  [ Easy Run ]  [ Long Run ]  [ Tempo ]  [ Intervals ]`
- **"All" chip** is active when no filter is selected (clears filter).
- **Single-select**: tapping an active type chip deselects it (back to All).
- Chip styles: reuse existing active/inactive chip styles from dashboard.

### 2. SectionList

- Sections = calendar months, sorted newest first.
- Each section's data = runs in that month, sorted newest first.
- When a type filter is active, only runs matching the selected typeId are included in each section's data array. Empty sections are hidden.
- `stickySectionHeadersEnabled={true}` — month headers stick as you scroll.

### 3. Month Section Header

```
SEPTEMBER 2026
──────────────────────────────────────────
All runs    8 runs · 62.4 km · 7h 12m
● Easy Run  4 runs · 24.1 km · 3h 20m    ← only when filter active
```

- **Month label**: `text-dim`, 12px, uppercase, letter-spacing 0.6, `fonts.body`
- **"All runs" row**: always shown. Label `text-muted` 12px + stats `text-secondary` 12px JetBrains Mono
- **Filtered type row**: shown only when a type filter is active. Type-color dot (8×8 circle) + type name + condensed stats. Same size as All runs row.
- Stats format: `N runs · X.X km · Xh Xm`
- Background: `bg-card` — visually separates from run rows.
- Padding: 12px horizontal, 10px vertical.

### 4. Run Rows

Reuse existing run row style (identical to dashboard recent runs + run list):

- Background: `bg-surface`, border `border-default`, border-radius 10, padding 12px
- Left: 8×36px type-color bar (border-radius 4)
- Center: type name (14px / 600) + date (11px, `text-faint`); line 2: distance · pace · duration (12px, `text-muted`)
- Right: chevron `›` in `text-ghost`
- Tapping navigates to Run Detail (`/run/[id]`)

---

## Data Flow

```
MOCK_RUNS
  → group by 'YYYY-MM' key (run.date.slice(0, 7))
  → sort month keys newest first
  → per month: compute allStats (always) + filteredStats (when typeId selected)
  → per month: filter runs array by typeId (empty = all)
  → hide months where filtered run array is empty
  → pass to SectionList as sections array
```

Month stats computed fields:
- `runCount` — length of runs in month (all / filtered)
- `totalDistanceKm` — sum of distanceKm
- `totalTimeSec` — sum of timeSec
- Display: `N runs · X.X km · Xh Xm`

---

## State

Single local state in `runs.tsx`:

```ts
const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
```

Toggling the same type deselects (back to null = All). No other filter state on this screen — the existing distance/pace/duration filters from the spec are deferred (out of scope for this iteration).

---

## Files Touched

| File | Change |
|------|--------|
| `app/(tabs)/runs.tsx` | Full implementation — replace placeholder |
| `src/types/index.ts` | `MonthStats` already defined — no change needed |
| `src/mockData.ts` | Read-only — no change |

No new files, no new dependencies.
