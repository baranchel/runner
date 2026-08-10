# Dashboard Summary Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dashboard summary card showing rolling 30-day totals, averages, and period-over-period deltas for all runs.

**Architecture:** Pure stats function computes current/previous period aggregates; a presentational `SummaryCard` component receives the stats and renders three columns (Distance, Time, Runs/Pace) with tinted PNG icons for delta direction and stat labels. Dashboard screen wires the two together using mock data.

**Tech Stack:** React Native, TypeScript, Expo, existing `colors`/`fonts`/`spacing` tokens from `src/utils/tokens.ts`.

## Global Constraints

- Colors: hex tokens from `src/utils/tokens.ts` only — no inline oklch
- Fonts: `Inter` (body), `JetBrainsMono` (all numeric values)
- All distances/paces respect `unit: 'km' | 'mi'` — km display uses `distanceKm`, mi multiplies by `0.621371`; pace per km uses raw sec/km, pace per mi multiplies by `1.60934`
- HealthKit is read-only — mock data only for now
- No new dependencies
- No git commands — Bar handles all commits

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/format.ts` | **Create** | `fmtDuration`, `fmtPace`, `fmtDistance` display helpers |
| `src/utils/stats.ts` | **Modify** | Add `PeriodStats` type + `getPeriodStats` function |
| `src/components/SummaryCard.tsx` | **Create** | Full summary card component |
| `app/(tabs)/dashboard.tsx` | **Modify** | Replace placeholder with `<SummaryCard>` |

---

## Task 1: Format helpers + getPeriodStats

**Files:**
- Create: `src/utils/format.ts`
- Modify: `src/utils/stats.ts` (append after existing `getMonthStats`)
- Modify: `src/types/index.ts` (append `PeriodStats` interface)

**Interfaces produced** (used by Task 2):
```ts
// src/types/index.ts
export interface PeriodStats {
  totalDistanceKm: number   // rounded to 1 decimal
  totalTimeSec: number
  runCount: number
  avgDistanceKm: number     // rounded to 1 decimal
  avgTimeSec: number        // rounded to nearest second
  avgPaceSecPerKm: number   // rounded to nearest second
}

// src/utils/stats.ts
export function getPeriodStats(
  runs: Run[],
  today: Date
): { current: PeriodStats; previous: PeriodStats }

// src/utils/format.ts
export function fmtDuration(sec: number): string   // "6h 12m" or "38m"
export function fmtPace(secPerKm: number, unit: 'km' | 'mi'): string  // "5:15/km" or "8:27/mi"
export function fmtDistance(km: number, unit: 'km' | 'mi'): string    // "47.5 km" or "29.5 mi"
```

- [ ] **Step 1: Add `PeriodStats` to `src/types/index.ts`**

Append after the `MonthStats` interface:

```ts
export interface PeriodStats {
  totalDistanceKm: number
  totalTimeSec: number
  runCount: number
  avgDistanceKm: number
  avgTimeSec: number
  avgPaceSecPerKm: number
}
```

- [ ] **Step 2: Add `getPeriodStats` to `src/utils/stats.ts`**

Append after the existing `getMonthStats` function:

```ts
import type { Run, MonthStats, PeriodStats } from '../types'

function aggregatePeriod(runs: Run[]): PeriodStats {
  const totalDistanceKm = runs.reduce((s, r) => s + r.distanceKm, 0)
  const totalTimeSec    = runs.reduce((s, r) => s + r.timeSec, 0)
  const runCount        = runs.length
  return {
    totalDistanceKm:  Math.round(totalDistanceKm * 10) / 10,
    totalTimeSec,
    runCount,
    avgDistanceKm:    runCount > 0 ? Math.round(totalDistanceKm / runCount * 10) / 10 : 0,
    avgTimeSec:       runCount > 0 ? Math.round(totalTimeSec / runCount)               : 0,
    avgPaceSecPerKm:  totalDistanceKm > 0 ? Math.round(totalTimeSec / totalDistanceKm) : 0,
  }
}

export function getPeriodStats(
  runs: Run[],
  today: Date,
): { current: PeriodStats; previous: PeriodStats } {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const DAY = 86400_000

  const current  = runs.filter(r => {
    const d = new Date(r.date).getTime()
    return d >= todayStart - 29 * DAY && d <= todayStart
  })
  const previous = runs.filter(r => {
    const d = new Date(r.date).getTime()
    return d >= todayStart - 59 * DAY && d < todayStart - 29 * DAY
  })

  return { current: aggregatePeriod(current), previous: aggregatePeriod(previous) }
}
```

- [ ] **Step 3: Verify `getPeriodStats` logic manually**

With `today = new Date('2026-08-11')` and `MOCK_RUNS`:

**Current period (2026-07-13 → 2026-08-11):** runs 04–12 → 9 runs
- totalDistanceKm: `9.0+8.0+11.0+5.5+8.0+11.0+8.0+13.0+6.5` = **80.0 km**
- totalTimeSec: `3690+2748+4565+2090+2870+4455+2498+5330+2470` = **30716 s**
- avgDistanceKm: `80.0 / 9` = **8.9 km**
- avgTimeSec: `30716 / 9` ≈ **3413 s** (56m 53s)
- avgPaceSecPerKm: `30716 / 80.0` ≈ **384 s/km** (6:24/km)

**Previous period (2026-06-12 → 2026-07-12):** runs 01–03 → 3 runs
- totalDistanceKm: `6.0+7.0+9.0` = **22.0 km**
- totalTimeSec: `2280+2870+2820` = **7970 s**
- avgDistanceKm: `22.0 / 3` ≈ **7.3 km**
- avgTimeSec: `7970 / 3` ≈ **2657 s** (44m 17s)
- avgPaceSecPerKm: `7970 / 22.0` ≈ **362 s/km** (6:02/km)

Add a quick call to your JS console or a `console.log` in the dashboard screen to confirm these values before building the UI.

- [ ] **Step 4: Create `src/utils/format.ts`**

```ts
export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function fmtPace(secPerKm: number, unit: 'km' | 'mi'): string {
  const s = unit === 'mi' ? Math.round(secPerKm * 1.60934) : secPerKm
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  const suffix = unit === 'mi' ? '/mi' : '/km'
  return `${m}:${String(r).padStart(2, '0')}${suffix}`
}

export function fmtDistance(km: number, unit: 'km' | 'mi'): string {
  const val = unit === 'mi' ? km * 0.621371 : km
  const suffix = unit === 'mi' ? ' mi' : ' km'
  return `${Math.round(val * 10) / 10}${suffix}`
}
```

- [ ] **Step 5: Verify format helpers manually**

Expected outputs:
- `fmtDuration(30716)` → `"8h 31m"`
- `fmtDuration(2470)` → `"41m"`
- `fmtPace(384, 'km')` → `"6:24/km"`
- `fmtPace(384, 'mi')` → `"10:18/mi"`
- `fmtDistance(80.0, 'km')` → `"80 km"`
- `fmtDistance(80.0, 'mi')` → `"49.7 mi"`

---

## Task 2: SummaryCard component

**Files:**
- Create: `src/components/SummaryCard.tsx`

**Interfaces consumed** (from Task 1):
```ts
import type { PeriodStats } from '../types'
import { getPeriodStats } from '../utils/stats'
import { fmtDuration, fmtPace, fmtDistance } from '../utils/format'
```

**Props:**
```ts
interface SummaryCardProps {
  runs: Run[]
  today: Date
  unit: 'km' | 'mi'
}
```

- [ ] **Step 1: Create `src/components/SummaryCard.tsx`**

```tsx
import { View, Text, Image, StyleSheet } from 'react-native'
import type { Run, PeriodStats } from '../types'
import { getPeriodStats } from '../utils/stats'
import { fmtDuration, fmtPace, fmtDistance } from '../utils/format'
import { colors, fonts, spacing } from '../utils/tokens'

interface SummaryCardProps {
  runs: Run[]
  today: Date
  unit: 'km' | 'mi'
}

// ─── Delta logic ─────────────────────────────────────────────────────────────

type DeltaDir = 'up' | 'down' | 'flat'

function deltaDir(
  current: number,
  previous: number,
  lowerIsBetter = false,
  useAbsolute = false,
): DeltaDir {
  if (previous === 0 && current === 0) return 'flat'
  if (previous === 0) return lowerIsBetter ? 'down' : 'up'
  if (useAbsolute) {
    const diff = current - previous
    if (diff === 0) return 'flat'
    return (lowerIsBetter ? diff < 0 : diff > 0) ? 'up' : 'down'
  }
  const pct = (current - previous) / previous
  if (Math.abs(pct) < 0.02) return 'flat'
  return (lowerIsBetter ? pct < 0 : pct > 0) ? 'up' : 'down'
}

function fmtDelta(current: number, previous: number, formatter: (n: number) => string): string {
  const diff = current - previous
  const sign = diff >= 0 ? '+' : '−'
  return `${sign}${formatter(Math.abs(diff))}`
}

function fmtPaceDelta(currentSec: number, previousSec: number, unit: 'km' | 'mi'): string {
  // No sign — the arrow icon already conveys direction (green up = faster, red down = slower)
  const absDiff = Math.abs(currentSec - previousSec)
  const m = Math.floor(absDiff / 60)
  const s = Math.round(absDiff % 60)
  const suffix = unit === 'mi' ? '/mi' : '/km'
  return `${m}:${String(s).padStart(2, '0')}${suffix}`
}

// ─── Delta row ────────────────────────────────────────────────────────────────

const ICONS = {
  up:       require('../../assets/up-arrow.png'),
  down:     require('../../assets/down-arrow.png'),
  flat:     require('../../assets/straight-arrow.png'),
}

const DELTA_COLORS: Record<DeltaDir, string> = {
  up:   '#3bac68',           // elev-line green
  down: colors.danger,       // #d74f49
  flat: colors.textFaint,    // #7d7d8f
}

interface DeltaRowProps {
  dir: DeltaDir
  label: string              // formatted delta string, e.g. "+8.2 km" or "" when flat
}

function DeltaRow({ dir, label }: DeltaRowProps) {
  return (
    <View style={s.deltaRow}>
      <Image source={ICONS[dir]} style={[s.deltaIcon, { tintColor: DELTA_COLORS[dir] }]} />
      {dir !== 'flat' && <Text style={[s.deltaText, { color: DELTA_COLORS[dir] }]}>{label}</Text>}
    </View>
  )
}

// ─── Stat column ──────────────────────────────────────────────────────────────

interface StatColumnProps {
  topValue: string
  topDelta: { dir: DeltaDir; label: string }
  label: string
  bottomValue: string
  bottomDelta: { dir: DeltaDir; label: string }
  bottomIcon?: { source: ReturnType<typeof require>; color: string }
  topIcon?: { source: ReturnType<typeof require>; color: string }
}

function StatColumn({ topValue, topDelta, label, bottomValue, bottomDelta, topIcon, bottomIcon }: StatColumnProps) {
  return (
    <View style={s.col}>
      <View style={s.valueRow}>
        <Text style={s.topValue}>{topValue}</Text>
        {topIcon && (
          <Image source={topIcon.source} style={[s.statIcon, { tintColor: topIcon.color }]} />
        )}
      </View>
      <DeltaRow dir={topDelta.dir} label={topDelta.label} />
      <Text style={s.colLabel}>{label}</Text>
      <View style={s.valueRow}>
        <Text style={s.bottomValue}>{bottomValue}</Text>
        {bottomIcon && (
          <Image source={bottomIcon.source} style={[s.statIcon, { tintColor: bottomIcon.color }]} />
        )}
      </View>
      <DeltaRow dir={bottomDelta.dir} label={bottomDelta.label} />
    </View>
  )
}

// ─── Runs / Pace column ───────────────────────────────────────────────────────

interface RunsPaceColumnProps {
  runCount: number
  runsDelta: { dir: DeltaDir; label: string }
  avgPaceSec: number
  paceDelta: { dir: DeltaDir; label: string }
  unit: 'km' | 'mi'
}

function RunsPaceColumn({ runCount, runsDelta, avgPaceSec, paceDelta, unit }: RunsPaceColumnProps) {
  return (
    <View style={s.col}>
      <View style={s.valueRow}>
        <Text style={s.topValue}>{runCount}</Text>
        <Image
          source={require('../../assets/counter.png')}
          style={[s.statIcon, { tintColor: colors.accent }]}
        />
      </View>
      <DeltaRow dir={runsDelta.dir} label={runsDelta.label} />
      <View style={s.divider} />
      <View style={s.valueRow}>
        <Text style={s.bottomValue}>{fmtPace(avgPaceSec, unit)}</Text>
        <Image
          source={require('../../assets/pace.png')}
          style={[s.statIcon, { tintColor: '#dc6600' }]}
        />
      </View>
      <DeltaRow dir={paceDelta.dir} label={paceDelta.label} />
    </View>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function SummaryCard({ runs, today, unit }: SummaryCardProps) {
  const { current: c, previous: p } = getPeriodStats(runs, today)
  const hasPrev = p.runCount > 0

  const distTopDelta = hasPrev
    ? { dir: deltaDir(c.totalDistanceKm, p.totalDistanceKm), label: fmtDelta(c.totalDistanceKm, p.totalDistanceKm, n => fmtDistance(n, unit)) }
    : { dir: 'flat' as DeltaDir, label: '' }

  const distBotDelta = hasPrev
    ? { dir: deltaDir(c.avgDistanceKm, p.avgDistanceKm), label: fmtDelta(c.avgDistanceKm, p.avgDistanceKm, n => fmtDistance(n, unit)) }
    : { dir: 'flat' as DeltaDir, label: '' }

  const timeTopDelta = hasPrev
    ? { dir: deltaDir(c.totalTimeSec, p.totalTimeSec), label: fmtDelta(c.totalTimeSec, p.totalTimeSec, fmtDuration) }
    : { dir: 'flat' as DeltaDir, label: '' }

  const timeBotDelta = hasPrev
    ? { dir: deltaDir(c.avgTimeSec, p.avgTimeSec), label: fmtDelta(c.avgTimeSec, p.avgTimeSec, fmtDuration) }
    : { dir: 'flat' as DeltaDir, label: '' }

  const runsDelta = hasPrev
    ? {
        dir: deltaDir(c.runCount, p.runCount, false, true),
        label: fmtDelta(c.runCount, p.runCount, n => String(Math.round(n))),
      }
    : { dir: 'flat' as DeltaDir, label: '' }

  const paceDelta = hasPrev
    ? {
        // pace: lower = faster = better → lowerIsBetter = true
        dir: deltaDir(c.avgPaceSecPerKm, p.avgPaceSecPerKm, true),
        label: fmtPaceDelta(c.avgPaceSecPerKm, p.avgPaceSecPerKm, unit),
      }
    : { dir: 'flat' as DeltaDir, label: '' }

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerLeft}>LAST 30 DAYS</Text>
        {hasPrev && <Text style={s.headerRight}>vs prev 30 days</Text>}
      </View>

      {/* Three stat columns */}
      <View style={s.columns}>
        <StatColumn
          topValue={fmtDistance(c.totalDistanceKm, unit)}
          topDelta={distTopDelta}
          label="DISTANCE"
          bottomValue={fmtDistance(c.avgDistanceKm, unit)}
          bottomDelta={distBotDelta}
        />
        <View style={s.colSep} />
        <StatColumn
          topValue={fmtDuration(c.totalTimeSec)}
          topDelta={timeTopDelta}
          label="TIME"
          bottomValue={fmtDuration(c.avgTimeSec)}
          bottomDelta={timeBotDelta}
        />
        <View style={s.colSep} />
        <RunsPaceColumn
          runCount={c.runCount}
          runsDelta={runsDelta}
          avgPaceSec={c.avgPaceSecPerKm}
          paceDelta={paceDelta}
          unit={unit}
        />
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: spacing.cardP,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
    letterSpacing: 0.6,
  },
  headerRight: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  colSep: {
    width: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topValue: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bottomValue: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  colLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
    letterSpacing: 0.6,
    marginVertical: 6,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: 8,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    height: 16,
  },
  deltaIcon: {
    width: 12,
    height: 12,
  },
  deltaText: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
  statIcon: {
    width: 14,
    height: 14,
  },
})
```

- [ ] **Step 2: Verify tintColor works on your icon PNGs**

`tintColor` only recolors the non-transparent pixels of a PNG. Your icons need to be white or black (not multicolor) for tinting to produce the correct hue. Open one icon in any image viewer to check — if they're already single-color (white/black), tinting works as expected.

---

## Task 3: Wire dashboard screen

**Files:**
- Modify: `app/(tabs)/dashboard.tsx`

**Interfaces consumed:**
```ts
import SummaryCard from '../../src/components/SummaryCard'
import { MOCK_RUNS } from '../../src/mockData'
```

- [ ] **Step 1: Replace the placeholder in `app/(tabs)/dashboard.tsx`**

```tsx
import { ScrollView, StyleSheet } from 'react-native'
import SummaryCard from '../../src/components/SummaryCard'
import { MOCK_RUNS } from '../../src/mockData'
import { colors, spacing } from '../../src/utils/tokens'

export default function Dashboard() {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <SummaryCard
        runs={MOCK_RUNS}
        today={new Date()}
        unit="km"
      />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgApp },
  content:   { padding: spacing.screenH, gap: spacing.gap },
})
```

- [ ] **Step 2: Open in Expo Go and verify**

Run `npx expo start` and open in Expo Go. Check the dashboard tab:

1. **Current period stats** (today = 2026-08-11, last 30 days):
   - Total distance: `80 km` · Avg distance: `8.9 km`
   - Total time: `8h 31m` · Avg time: `56m`
   - Runs: `9` · Avg pace: `6:24/km`

2. **Delta direction — confirmed expected:**
   - Distance: up (green) — 80 km vs 22 km last period
   - Time: up (green) — 30716s vs 7970s
   - Runs: up (green) — 9 vs 3
   - Pace: down (red) — 384 s/km vs 362 s/km (slower = red)

3. **Icons:** counter icon purple, pace icon orange, arrow icons green/red/faint

4. **Layout:** three equal columns, DISTANCE and TIME labels centered between top/bottom values, runs/pace column separated by a horizontal rule
