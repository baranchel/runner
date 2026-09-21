# Chronodrom — Run Detail Screen Design

**Date:** 2026-08-12  
**Status:** Approved  
**Branch:** `feature/run-screen`

---

## What We're Building

`app/run/[id].tsx` — the single-run detail screen. Navigated to by tapping any run row in the dashboard's Recent Runs section (and later from the Runs list screen). Shows a full breakdown of one run: summary metrics, splits, segments (if structured), pace and HR charts, and a map placeholder.

---

## Screen Structure (top to bottom)

```
Back link
Run header
Summary grid
Splits table
Segments section (conditional)
Charts (Pace, Heart Rate)
Map placeholder
```

---

## 1. Navigation

**File:** `app/run/[id].tsx`  
**Route param:** `id` via `useLocalSearchParams()` from expo-router.  
**Back link:** `‹ Back` — 12px, `accent` color, calls `router.back()`.

**Wiring:** Dashboard's recent run rows get an `onPress` that calls `router.push('/run/' + run.id)`.

---

## 2. Run Header

```
<TypeName>            ← 20px / 800, text-primary
<Full date>           ← 12px, text-faint  e.g. "Aug 10, 2026"
Synced from <source>  ← 12px, text-faint  e.g. "Synced from Apple Health"
```

Source label map: `apple_health` → "Apple Health", `strava` → "Strava", `garmin` → "Garmin".

Type name has an 8×36px color bar to its left (same style as run rows), using `runTypeColor(type.hue)`.

---

## 3. Run Summary Grid

**Style:** identical to the Weekly Stats Grid on Dashboard — 2-column grid, 2 cards per row, `gap: 10px` between rows. Each card: `bg-surface`, `border-default`, `border-radius 10`, `padding 14`.

**Card anatomy:**
```
[icon]  LABEL           ← 11px, text-dim, icon tinted
VALUE                   ← JetBrains Mono, 22px / 700, text-primary
sub-label               ← 11px, text-faint (optional)
```

**8 cards in 4 rows:**

| Row | Left card | Right card |
|-----|-----------|------------|
| 1 | **Distance** — `distance.png` (gold) / value: `fmtDistance` | **Time** — `time.png` (teal) / value: `fmtDuration` |
| 2 | **Avg Pace** — `pace.png` (orange) / value: `fmtPace(avgPace)` / sub: `fastest–slowest/km` | **Avg HR** — `heart-rate.png` (red `#d74f49`) / value: `N bpm` / sub: `min–max bpm` |
| 3 | **Elevation** — `elevation.png` (green `#3bac68`) / value: `N m` | **Calories** — `calories.png` (orange) / value: `N kcal` |
| 4 | **Weather** — `weather.png` (muted) / value: `N°C` / sub: `Humidity: N%` | **Primary Zone** — `pace.png` (accent, temporary) / value: `Zone N` / sub: `<ZoneName> · Nm` |

**Computed values:**

- `avgPace`: `run.timeSec / run.distanceKm`
- Pace range: fastest (lowest sec/km) and slowest (highest sec/km) across all splits. `segmentKm = split.km - prevKm` where `prevKm = 0` for the first split. Sub-label: `fmtPace(fastest)–fmtPace(slowest)` (fastest always first)
- Calories: `Math.round(run.distanceKm * 62)`
- HR sub-label: `run.avgHr` is the value; sub shows `run.minHr–run.maxHr bpm` (add `minHr` field to data model, or derive as `avgHr - 10` from mock data)
- Primary Zone: computed via `computePrimaryZone(run)` — see Zone Computation below

---

## 4. Zone Data

HR zones are determined by the watch (not computed client-side). They are stored on the run as time spent in each of 5 zones.

**Data model addition:**
```ts
zones: [number, number, number, number, number] | null
// index 0–4 = Zone 1–5, value = seconds spent in that zone
// null if the watch did not record zone data
```

**Zone names:**
| Zone | Name |
|------|------|
| 1 | Very Easy |
| 2 | Easy |
| 3 | Aerobic |
| 4 | Threshold |
| 5 | Max |

`computePrimaryZone(run)`: find the index with max value in `run.zones`. Return `{ zone: N, name: ZoneName, timeSec: N }`. If `run.zones` is null, return null and show `'—'` in the card.

Display: value = `Zone N`, sub-label = `<ZoneName> · Xm`.

Lives in `src/utils/zones.ts`.

---

## 5. Splits Table

Section label: `SPLITS`

Card: `bg-chart`, `border-default`, `border-radius 10`, overflow hidden.

**4 columns:** `Km · Pace · Time · HR`

Header row: `bg-elevated`, 11px, `text-dim`  
Data rows: JetBrains Mono 13px, border-top `border-subtle`, columns `0.5fr 1fr 1fr 1fr`

One row per split. Km column shows the split marker (e.g. `1`, `2`, `5.5`).  
Pace = `fmtPace(split.timeSec / segmentKm)`.  
Time = `fmtDuration(split.timeSec)`.  
HR = `split.avgHr ?? '—'`.

---

## 6. Segments Section (conditional)

Only rendered when `run.segments` is non-null and non-empty.

Section label: `STRUCTURE`

One card per segment. Each card: `bg-surface`, `border-default`, `border-radius 10`, `padding 12`.

Layout per card:
```
[color dot]  LABEL TYPE         distance · time · pace
             avg HR: N bpm
```

Pace = `fmtPace(segment.timeSec / segment.distanceKm)`.

Segment type → color dot:
- `warmup` / `cooldown`: `elevLine` (#3bac68, teal)
- `rep` / `main`: run type color (`runTypeColor(type.hue)`)
- `rest`: `text-muted` (#888898, gray)

Segment type → display label:
- `warmup` → "Warm-up"
- `cooldown` → "Cool-down"
- `rep` / `main` → "Work"
- `rest` → "Rest"

---

## 7. Charts

Section label per chart (`PACE`, `HEART RATE`).

SVG area chart — `viewBox="0 0 300 100"`, 100% width, 90px height. Background card: `bg-chart`, `border-default`, `border-radius 10`.

**Pace chart:** fill = type color at opacity 0.15, stroke = type color, width 2  
**Heart rate chart:** fill = `#d74f49` at opacity 0.15, stroke = `#d74f49`, width 2

Chart series generated via `genSeries` in `src/utils/chart.ts` (new file):
```ts
pace series:  genSeries(run.id + 'pace', 16, timeSec/distanceKm, 14, 0)
heart rate:   genSeries(run.id + 'hr',   16, avgHr - 6,          8,  14)
```

SVG path builder (area fill + polyline) also lives in `chart.ts`.

### Interactive Scrubbing

Charts are touch-interactive. When the user holds/drags a finger over a chart:

**Gesture:** `PanResponder` (built-in React Native, no new dep) attached to a transparent `View` absolutely positioned over the SVG. Tracks `touchX` in rendered-pixel space; maps to viewBox X via `(touchX / renderedWidth) * 300`. Find the nearest series index, interpolate value.

**Overlay elements (rendered inside the SVG when active):**
- Vertical crosshair: `<Line x1={svgX} y1={10} x2={svgX} y2={90}` — `stroke: white, opacity: 0.3, strokeWidth: 1`
- Dot on curve: `<Circle cx={svgX} cy={pointY} r={4}` — filled with the chart stroke color, white border `strokeWidth: 1.5`
- Value label: `<Rect>` + `<Text>` pill above the dot, value in JetBrains Mono 11px. Clamped horizontally so it never overflows the chart edges.

**Label content:**
- Pace chart: `fmtPace(value)` e.g. `6:14/km`
- HR chart: `Math.round(value) + ' bpm'` e.g. `138 bpm`

**State:** each chart manages its own `activeIndex: number | null` via `useState`. Cleared on `onPanResponderRelease` / `onPanResponderTerminate`.

---

## 8. Map Placeholder

Section label: `MAP`

Card: `bg-chart`, `border-default`, `border-radius 10`, height 160px, centered label:
```
Map coming in Phase 3
```
12px, `text-muted`.

---

## Data Model Changes

### Run type — add `weather` and `minHr`

```ts
interface Run {
  // ... existing fields ...
  minHr: number | null       // add — lowest HR recorded during run
  weather: {
    tempC: number
    humidity: number         // 0–100 percentage
  } | null
  zones: [number, number, number, number, number] | null  // seconds per zone 1–5, from watch
}
```

`minHr` is separate from `avgHr` and `maxHr` — it represents the floor (e.g. during warmup/rest).  
For mock data: set `minHr ≈ avgHr - 10`.

### format.ts — add `fmtDateFull`

```ts
export function fmtDateFull(iso: string): string  // "Aug 10, 2026"
```

### New files

- `src/utils/chart.ts` — `genSeries`, SVG path builder
- `src/utils/zones.ts` — `computePrimaryZone`

---

## Mock Data Updates

Add `weather` and `minHr` to all 14 runs in `src/mockData.ts`:
- Weather: plausible summer values (tempC 18–28, humidity 45–75)
- minHr: `avgHr - 10` for all runs

---

## Navigation Wiring

- `app/run/[id].tsx` created (new screen)
- `app/(tabs)/dashboard.tsx` — run rows get `onPress={() => router.push('/run/' + run.id)}`
- Runs list screen (not yet built) will wire the same way when built

---

## Implementation Order

Since the user wants to see the summary first:

1. Add `weather` + `minHr` to `Run` type + all mock data
2. Add `fmtDateFull` to `format.ts`
3. Create `src/utils/chart.ts` (genSeries + path builder)
4. Create `src/utils/zones.ts` (computePrimaryZone)
5. Create `app/run/[id].tsx` — header + summary grid only (first pass)
6. Wire dashboard run rows to navigate to run detail
7. Add splits table
8. Add segments section
9. Add charts (pace + HR)
10. Add map placeholder
