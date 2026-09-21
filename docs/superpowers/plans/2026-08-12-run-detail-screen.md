# Run Detail Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `app/run/[id].tsx` — a full single-run detail screen showing a summary grid, splits, segments, interactive SVG charts, and a map placeholder.

**Architecture:** A `ScrollView`-based screen outside the tabs navigator (root Stack handles it automatically). Data flows from `MOCK_RUNS` via `useLocalSearchParams`. The interactive chart is extracted to `src/components/Chart.tsx` (reusable). Utilities live in `src/utils/chart.ts` and `src/utils/zones.ts`.

**Tech Stack:** expo-router `useLocalSearchParams`, react-native-svg (`Svg`, `Path`, `Polyline`, `Line`, `Circle`, `Rect`, `Text`), React Native `PanResponder`, Zustand (not yet — mock data only in Phase 1).

## Global Constraints

- Colors: hex values from `src/utils/tokens.ts` only — no raw oklch in component files.
- Fonts: `fonts.body` = `'Inter'`, `fonts.mono` = `'JetBrainsMono'` — from `tokens.ts`.
- Unit: `'km'` hardcoded (same as dashboard) until Zustand user store is wired.
- No new npm dependencies.
- Branch: `feature/run-screen`. Bar handles all git operations — never run git commands.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | Add `minHr`, `weather`, `zones` to `Run` |
| `src/utils/format.ts` | Modify | Add `fmtDateFull`, `fmtMMSS` |
| `src/mockData.ts` | Modify | Add `minHr`, `weather`, `zones` to all 14 runs |
| `src/utils/chart.ts` | Create | `genSeries` + `buildChartPaths` |
| `src/utils/zones.ts` | Create | `ZONE_NAMES`, `computePrimaryZone` |
| `src/components/Chart.tsx` | Create | Interactive SVG area chart with PanResponder |
| `app/run/[id].tsx` | Create | Run Detail screen — all sections |
| `app/(tabs)/dashboard.tsx` | Modify | Wire run row `onPress` to navigate to detail |

---

## Task 1: Extend Run type, format helpers, and mock data

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/utils/format.ts`
- Modify: `src/mockData.ts`

**Interfaces:**
- Produces: `Run.minHr`, `Run.weather`, `Run.zones` — used by Tasks 5–8
- Produces: `fmtDateFull(iso)`, `fmtMMSS(sec)` — used by Tasks 5–6

- [ ] **Step 1: Extend the Run interface**

In `src/types/index.ts`, add three fields to `Run` after `splits`:

```ts
export interface Run {
  id: string
  healthkitUuid: string
  typeId: string | null
  name: string
  date: string
  distanceKm: number
  timeSec: number
  avgHr: number | null
  maxHr: number | null
  minHr: number | null          // ← add: lowest HR recorded
  elevGain: number | null
  cadence: number | null
  source: 'apple_health' | 'strava' | 'garmin'
  notes: string | null
  segments: Segment[] | null
  splits: Split[]
  weather: { tempC: number; humidity: number } | null   // ← add
  zones: [number, number, number, number, number] | null // ← add: seconds per zone 1–5
}
```

- [ ] **Step 2: Add format helpers**

In `src/utils/format.ts`, append after `fmtDate`:

```ts
export function fmtDateFull(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

// mm:ss — for split times and segment durations
export function fmtMMSS(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
```

- [ ] **Step 3: Add mock data fields**

In `src/mockData.ts`, add `minHr`, `weather`, and `zones` to every run. Add them after the `splits` array on each run. The `zones` tuple must sum to the run's `timeSec`.

```ts
// run-01  easy 6.0km  2280s  avgHr:134
minHr: 124,
weather: { tempC: 24, humidity: 58 },
zones: [0, 420, 1240, 620, 0],

// run-02  long 7.0km  2870s  avgHr:140
minHr: 130,
weather: { tempC: 26, humidity: 62 },
zones: [0, 580, 1560, 730, 0],

// run-03  tempo 9.0km  2820s  avgHr:150
minHr: 140,
weather: { tempC: 28, humidity: 65 },
zones: [0, 0, 720, 1620, 480],

// run-04  long 9.0km  3690s  avgHr:142
minHr: 132,
weather: { tempC: 27, humidity: 60 },
zones: [0, 740, 1960, 990, 0],

// run-05  interval 8.0km  2748s  avgHr:148
minHr: 138,
weather: { tempC: 22, humidity: 55 },
zones: [0, 288, 460, 880, 1120],

// run-06  long 11.0km  4565s  avgHr:145
minHr: 135,
weather: { tempC: 25, humidity: 63 },
zones: [0, 920, 2440, 1205, 0],

// run-07  easy 5.5km  2090s  avgHr:131
minHr: 121,
weather: { tempC: 23, humidity: 52 },
zones: [0, 410, 1140, 540, 0],

// run-08  interval 8.0km  2870s  avgHr:151
minHr: 141,
weather: { tempC: 29, humidity: 68 },
zones: [0, 300, 470, 950, 1150],

// run-09  long 11.0km  4455s  avgHr:141
minHr: 131,
weather: { tempC: 24, humidity: 57 },
zones: [0, 900, 2360, 1195, 0],

// run-10  tempo 8.0km  2498s  avgHr:151
minHr: 141,
weather: { tempC: 27, humidity: 64 },
zones: [0, 0, 640, 1438, 420],

// run-11  long 13.0km  5330s  avgHr:146
minHr: 136,
weather: { tempC: 26, humidity: 61 },
zones: [0, 1070, 2830, 1430, 0],

// run-12  easy 6.5km  2470s  avgHr:133
minHr: 123,
weather: { tempC: 22, humidity: 49 },
zones: [0, 480, 1340, 650, 0],

// run-13  long 15.0km  6150s  avgHr:148
minHr: 138,
weather: { tempC: 25, humidity: 55 },
zones: [0, 1230, 3260, 1660, 0],

// run-14  interval 10.0km  3520s  avgHr:149
minHr: 139,
weather: { tempC: 21, humidity: 47 },
zones: [0, 350, 590, 1260, 1320],
```

- [ ] **Step 4: Verify TypeScript compiles**

Run in the project root:
```
npx tsc --noEmit
```
Expected: no errors. If you see "Property 'minHr' is missing…", you missed a run in mockData.

---

## Task 2: chart.ts — series generator and SVG path builder

**Files:**
- Create: `src/utils/chart.ts`

**Interfaces:**
- Produces:
  - `genSeries(seedKey: string, n: number, base: number, variance: number, driftTotal: number): number[]`
  - `buildChartPaths(series: number[]): { area: string; line: string }`
- Consumed by: `src/components/Chart.tsx` (Task 4)

- [ ] **Step 1: Create `src/utils/chart.ts`**

```ts
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h >>> 0
}

function makeLcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

export function genSeries(
  seedKey: string,
  n: number,
  base: number,
  variance: number,
  driftTotal: number,
): number[] {
  const rand = makeLcg(hashStr(seedKey))
  const drift = driftTotal / n
  const series: number[] = []
  let v = base - driftTotal / 2
  for (let i = 0; i < n; i++) {
    v += drift + (rand() - 0.5) * variance * 2
    series.push(v)
  }
  return series
}

// viewBox 0 0 300 100, 10px top/bottom padding → 80px usable height
export function buildChartPaths(series: number[]): { area: string; line: string } {
  const n = series.length
  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1
  const toX = (i: number) => (i / (n - 1)) * 300
  const toY = (v: number) => 100 - 10 - ((v - min) / range) * 80
  const pts = series.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
  return {
    area: `M ${toX(0).toFixed(1)},90 L ${pts.join(' L ')} L ${toX(n - 1).toFixed(1)},90 Z`,
    line: pts.join(' '),
  }
}
```

- [ ] **Step 2: Add a self-check at the bottom of the file**

```ts
// ponytail: remove before prod — dev-only determinism check
if (__DEV__) {
  const s = genSeries('test', 4, 100, 5, 0)
  const same = genSeries('test', 4, 100, 5, 0)
  if (s.join() !== same.join()) throw new Error('genSeries is not deterministic')
}
```

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit`. No errors expected.

---

## Task 3: zones.ts — primary zone computation

**Files:**
- Create: `src/utils/zones.ts`

**Interfaces:**
- Produces: `computePrimaryZone(run: Run): { zone: number; name: string; timeSec: number } | null`
- Consumed by: `app/run/[id].tsx` (Task 5)

- [ ] **Step 1: Create `src/utils/zones.ts`**

```ts
import type { Run } from '../types'

export const ZONE_NAMES = ['Very Easy', 'Easy', 'Aerobic', 'Threshold', 'Max'] as const

export function computePrimaryZone(
  run: Run,
): { zone: number; name: string; timeSec: number } | null {
  if (!run.zones) return null
  const maxIdx = run.zones.reduce((best, v, i) => (v > run.zones![best] ? i : best), 0)
  return { zone: maxIdx + 1, name: ZONE_NAMES[maxIdx], timeSec: run.zones[maxIdx] }
}
```

- [ ] **Step 2: Verify**

`npx tsc --noEmit` — no errors.

---

## Task 4: Chart component — interactive SVG with PanResponder

**Files:**
- Create: `src/components/Chart.tsx`

**Interfaces:**
- Consumes: `buildChartPaths` from `src/utils/chart.ts`
- Produces: `<Chart series={number[]} strokeColor={string} formatValue={(v) => string} />`
- Consumed by: `app/run/[id].tsx` (Task 8)

- [ ] **Step 1: Create `src/components/Chart.tsx`**

```tsx
import React, { useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { Circle, Line, Path, Polyline, Rect, Svg, Text as SvgText } from 'react-native-svg'
import { buildChartPaths } from '../utils/chart'
import { colors, fonts } from '../utils/tokens'

interface ChartProps {
  series: number[]
  strokeColor: string
  formatValue: (v: number) => string
}

export function Chart({ series, strokeColor, formatValue }: ChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const viewWidth = useRef(0)
  const n = series.length

  const { area, line } = buildChartPaths(series)
  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1
  const toX = (i: number) => (i / (n - 1)) * 300
  const toY = (v: number) => 100 - 10 - ((v - min) / range) * 80

  const setFromX = (locationX: number) => {
    const svgX = (locationX / viewWidth.current) * 300
    const idx = Math.max(0, Math.min(n - 1, Math.round((svgX / 300) * (n - 1))))
    setActiveIdx(idx)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderRelease: () => setActiveIdx(null),
      onPanResponderTerminate: () => setActiveIdx(null),
    }),
  ).current

  const crossX = activeIdx !== null ? toX(activeIdx) : null
  const crossY = activeIdx !== null ? toY(series[activeIdx]) : null
  const labelText = activeIdx !== null ? formatValue(series[activeIdx]) : null
  // clamp label pill so it never overflows (pill is ~50 SVG units wide)
  const labelX = crossX !== null ? Math.max(5, Math.min(crossX - 25, 245)) : 0

  return (
    <View
      onLayout={(e) => { viewWidth.current = e.nativeEvent.layout.width }}
      {...panResponder.panHandlers}
    >
      <Svg viewBox="0 0 300 100" width="100%" height={90}>
        <Path d={area} fill={strokeColor} fillOpacity={0.15} stroke="none" />
        <Polyline points={line} fill="none" stroke={strokeColor} strokeWidth={2} />
        {activeIdx !== null && crossX !== null && crossY !== null && (
          <>
            <Line
              x1={crossX} y1={10} x2={crossX} y2={90}
              stroke="white" strokeOpacity={0.3} strokeWidth={1}
            />
            <Circle
              cx={crossX} cy={crossY} r={4}
              fill={strokeColor} stroke="white" strokeWidth={1.5}
            />
            <Rect x={labelX} y={2} width={50} height={18} rx={4} fill={colors.bgElevated} />
            <SvgText
              x={labelX + 25} y={14}
              textAnchor="middle"
              fill={colors.textPrimary}
              fontSize={10}
              fontFamily={fonts.mono}
            >
              {labelText}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

`npx tsc --noEmit` — no errors.

---

## Task 5: Run Detail screen — scaffold, header, summary grid

**Files:**
- Create: `app/run/[id].tsx`
- Modify: `app/(tabs)/dashboard.tsx`

**Interfaces:**
- Consumes: `fmtDateFull`, `fmtDistance`, `fmtDuration`, `fmtPace`, `fmtMMSS` from `format.ts`
- Consumes: `computePrimaryZone` from `zones.ts`
- Consumes: `colors`, `fonts`, `runTypeColor`, `spacing` from `tokens.ts`
- Consumes: `MOCK_RUNS`, `MOCK_RUN_TYPES` from `mockData.ts`

- [ ] **Step 1: Create `app/run/[id].tsx`** with header + summary grid

```tsx
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../../src/mockData'
import type { Run, RunType, Split } from '../../src/types'
import { fmtDateFull, fmtDistance, fmtDuration, fmtMMSS, fmtPace } from '../../src/utils/format'
import { colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'
import { computePrimaryZone } from '../../src/utils/zones'

const UNIT = 'km' as const
const TYPE_MAP = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))

const SOURCE_LABEL: Record<string, string> = {
  apple_health: 'Apple Health',
  strava: 'Strava',
  garmin: 'Garmin',
}

function getPaceRange(splits: Split[]): { fastest: number; slowest: number } {
  let prevKm = 0
  const paces = splits.map(s => {
    const segKm = s.km - prevKm
    prevKm = s.km
    return s.timeSec / segKm
  })
  return { fastest: Math.min(...paces), slowest: Math.max(...paces) }
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: ReturnType<typeof require>
  iconColor: string
  label: string
  value: string
  sub?: string
}

function MetricCard({ icon, iconColor, label, value, sub }: MetricCardProps) {
  return (
    <View style={s.metricCard}>
      <View style={s.metricLabelRow}>
        <Image source={icon} style={[s.metricIcon, { tintColor: iconColor }]} />
        <Text style={s.metricLabel}>{label}</Text>
      </View>
      <Text style={s.metricValue}>{value}</Text>
      {sub ? <Text style={s.metricSub}>{sub}</Text> : null}
    </View>
  )
}

// ─── Summary Grid ─────────────────────────────────────────────────────────────

function SummaryGrid({ run, unit }: { run: Run; unit: 'km' | 'mi' }) {
  const avgPace = run.timeSec / run.distanceKm
  const { fastest, slowest } = getPaceRange(run.splits)
  const calories = Math.round(run.distanceKm * 62)
  const zone = computePrimaryZone(run)

  const rows: [MetricCardProps, MetricCardProps][] = [
    [
      {
        icon: require('../../assets/distance.png'), iconColor: '#e8a900',
        label: 'Distance', value: fmtDistance(run.distanceKm, unit),
      },
      {
        icon: require('../../assets/time.png'), iconColor: '#00a6b8',
        label: 'Time', value: fmtDuration(run.timeSec),
      },
    ],
    [
      {
        icon: require('../../assets/pace.png'), iconColor: '#dc6600',
        label: 'Avg Pace', value: fmtPace(avgPace, unit),
        sub: `${fmtPace(fastest, unit)}–${fmtPace(slowest, unit)}`,
      },
      {
        icon: require('../../assets/heart-rate.png'), iconColor: colors.hrLine,
        label: 'Avg HR',
        value: run.avgHr != null ? `${run.avgHr} bpm` : '—',
        sub: run.minHr != null && run.maxHr != null ? `${run.minHr}–${run.maxHr} bpm` : undefined,
      },
    ],
    [
      {
        icon: require('../../assets/elevation.png'), iconColor: colors.elevLine,
        label: 'Elevation', value: run.elevGain != null ? `${run.elevGain} m` : '—',
      },
      {
        icon: require('../../assets/calories.png'), iconColor: '#dc6600',
        label: 'Calories', value: `${calories} kcal`,
      },
    ],
    [
      {
        icon: require('../../assets/weather.png'), iconColor: colors.textMuted,
        label: 'Weather',
        value: run.weather != null ? `${run.weather.tempC}°C` : '—',
        sub: run.weather != null ? `Humidity: ${run.weather.humidity}%` : undefined,
      },
      {
        icon: require('../../assets/pace.png'), iconColor: colors.accent,
        label: 'Primary Zone',
        value: zone ? `Zone ${zone.zone}` : '—',
        sub: zone ? `${zone.name} · ${Math.round(zone.timeSec / 60)}m` : undefined,
      },
    ],
  ]

  return (
    <View style={s.gridWrap}>
      {rows.map((row, ri) => (
        <View key={ri} style={s.gridRow}>
          {row.map((card, ci) => (
            <MetricCard key={ci} {...card} />
          ))}
        </View>
      ))}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RunDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const run = MOCK_RUNS.find(r => r.id === id)

  if (!run) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Text style={s.notFound}>Run not found</Text>
      </SafeAreaView>
    )
  }

  const type = run.typeId ? TYPE_MAP[run.typeId] : null
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        {/* back */}
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>

        {/* header */}
        <View style={s.header}>
          <View style={[s.headerBar, { backgroundColor: typeColor }]} />
          <View>
            <Text style={s.headerType}>{type?.name ?? 'Unclassified'}</Text>
            <Text style={s.headerDate}>{fmtDateFull(run.date)}</Text>
            <Text style={s.headerSource}>Synced from {SOURCE_LABEL[run.source] ?? run.source}</Text>
          </View>
        </View>

        {/* summary */}
        <SummaryGrid run={run} unit={UNIT} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { padding: spacing.screenH, gap: spacing.gap },

  backBtn:  { marginBottom: 4 },
  backText: { fontFamily: fonts.body, fontSize: 12, color: colors.accent },

  header:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerBar:  { width: 8, height: 52, borderRadius: 4 },
  headerType: { fontFamily: fonts.body, fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  headerDate: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2 },
  headerSource: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },

  gridWrap: { gap: 10 },
  gridRow:  { flexDirection: 'row', gap: 10 },

  metricCard: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 14,
  },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  metricIcon:     { width: 12, height: 12 },
  metricLabel:    { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  metricValue:    { fontFamily: fonts.mono, fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  metricSub:      { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 3 },

  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
})
```

- [ ] **Step 2: Wire dashboard run rows to navigate**

In `app/(tabs)/dashboard.tsx`, find the `RecentRuns` function. The run row is currently a `<View>`. Replace it with a `<TouchableOpacity>` that pushes to the run detail route:

Add import at the top (it's already imported — `useRouter` is already there):

Find the run row in `RecentRuns`:
```tsx
// BEFORE (around line 208):
<View key={run.id} style={s.runRow}>
```

Replace with:
```tsx
<TouchableOpacity key={run.id} style={s.runRow} activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}`)}>
```

And the closing `</View>` → `</TouchableOpacity>`.

`router` is already available in `RecentRuns` — pass it as a prop from `Dashboard`:
```tsx
// Dashboard component:
<RecentRuns onSeeAll={() => router.push('/(tabs)/runs')} router={router} />

// RecentRuns signature:
function RecentRuns({ onSeeAll, router }: { onSeeAll: () => void; router: ReturnType<typeof useRouter> }) {
```

- [ ] **Step 3: Test in Expo Go**

Start Expo Go (`npx expo start`). Open the app. Tap any run in the Recent Runs list. The Run Detail screen should appear with header and 8 metric cards. Tap `‹ Back` to return.

---

## Task 6: Splits table

**Files:**
- Modify: `app/run/[id].tsx`

**Interfaces:**
- Consumes: `Split` from `src/types`, `fmtPace`, `fmtMMSS` from `format.ts`

- [ ] **Step 1: Add `SplitsTable` component above the `RunDetail` export**

```tsx
function SplitsTable({ run, unit }: { run: Run; unit: 'km' | 'mi' }) {
  let prevKm = 0
  return (
    <View>
      <Text style={s.sectionLabel}>SPLITS</Text>
      <View style={st.card}>
        {/* header */}
        <View style={[st.row, st.headerRow]}>
          <Text style={[st.cell, st.hdr, { flex: 0.5 }]}>Km</Text>
          <Text style={[st.cell, st.hdr]}>Pace</Text>
          <Text style={[st.cell, st.hdr]}>Time</Text>
          <Text style={[st.cell, st.hdr]}>HR</Text>
        </View>
        {run.splits.map((split, i) => {
          const segKm = split.km - prevKm
          const pace = split.timeSec / segKm
          prevKm = split.km
          return (
            <View key={i} style={[st.row, i > 0 && st.borderTop]}>
              <Text style={[st.cell, st.val, { flex: 0.5 }]}>{split.km}</Text>
              <Text style={[st.cell, st.val]}>{fmtPace(pace, unit)}</Text>
              <Text style={[st.cell, st.val]}>{fmtMMSS(split.timeSec)}</Text>
              <Text style={[st.cell, st.val]}>{split.avgHr ?? '—'}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  card:      { backgroundColor: colors.bgChart, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: spacing.radius, overflow: 'hidden' },
  row:       { flexDirection: 'row' },
  headerRow: { backgroundColor: colors.bgElevated },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  cell:      { flex: 1, paddingHorizontal: 10, paddingVertical: 10 },
  hdr:       { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  val:       { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
})
```

- [ ] **Step 2: Wire `sectionLabel` style** (add to the `s` StyleSheet at the bottom of the file):

```ts
sectionLabel: {
  fontFamily: fonts.body,
  fontSize: 12,
  color: colors.textDim,
  letterSpacing: 0.6,
  marginBottom: 10,
},
```

- [ ] **Step 3: Add `<SplitsTable>` to the `ScrollView` in `RunDetail`**

After `<SummaryGrid ... />`, add:
```tsx
<SplitsTable run={run} unit={UNIT} />
```

- [ ] **Step 4: Test in Expo Go**

The splits table should appear below the summary. Verify km markers, pace, time, and HR values look correct for a known run (e.g. run-01 easy: km 1 should show ~6:23/km).

---

## Task 7: Segments section

**Files:**
- Modify: `app/run/[id].tsx`

**Interfaces:**
- Consumes: `Segment` type, `runTypeColor` from `tokens.ts`, `fmtDistance`, `fmtMMSS`, `fmtPace`

- [ ] **Step 1: Add segment color + label helpers** (inside `app/run/[id].tsx`, above the component):

```ts
const SEGMENT_DISPLAY: Record<string, { label: string; color: (typeColor: string) => string }> = {
  warmup:   { label: 'Warm-up',   color: () => colors.elevLine },
  cooldown: { label: 'Cool-down', color: () => colors.elevLine },
  rep:      { label: 'Work',      color: (tc) => tc },
  main:     { label: 'Work',      color: (tc) => tc },
  rest:     { label: 'Rest',      color: () => colors.textMuted },
}
```

- [ ] **Step 2: Add `SegmentsSection` component**

```tsx
function SegmentsSection({ run, typeColor, unit }: { run: Run; typeColor: string; unit: 'km' | 'mi' }) {
  if (!run.segments) return null
  return (
    <View>
      <Text style={s.sectionLabel}>STRUCTURE</Text>
      <View style={{ gap: 8 }}>
        {run.segments.map((seg, i) => {
          const display = SEGMENT_DISPLAY[seg.type] ?? { label: seg.type, color: () => colors.textMuted }
          const dotColor = display.color(typeColor)
          const pace = seg.distanceKm > 0 ? seg.timeSec / seg.distanceKm : 0
          return (
            <View key={i} style={sg.card}>
              <View style={[sg.dot, { backgroundColor: dotColor }]} />
              <View style={{ flex: 1 }}>
                <View style={sg.topRow}>
                  <Text style={sg.label}>{seg.label}</Text>
                  <Text style={sg.type}>{display.label}</Text>
                  <Text style={sg.meta}>
                    {fmtDistance(seg.distanceKm, unit)} · {fmtMMSS(seg.timeSec)} · {fmtPace(pace, unit)}
                  </Text>
                </View>
                {seg.avgHr != null && (
                  <Text style={sg.hr}>avg HR: {seg.avgHr} bpm</Text>
                )}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const sg = StyleSheet.create({
  card:   { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: spacing.radius, padding: 12, gap: 12 },
  dot:    { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  label:  { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  type:   { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  meta:   { fontFamily: fonts.mono, fontSize: 12, color: colors.textFaint },
  hr:     { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 4 },
})
```

- [ ] **Step 3: Add to `ScrollView` in `RunDetail`**

After `<SplitsTable ... />`, add:
```tsx
{run.segments && <SegmentsSection run={run} typeColor={typeColor} unit={UNIT} />}
```

- [ ] **Step 4: Test in Expo Go**

Open a structured run (e.g. run-03 Tempo or run-05 Intervals). Segments section should appear after splits. Warmup and cooldown dots are teal, Work dots are the run type color, Rest dots are muted gray.

---

## Task 8: Charts + map placeholder

**Files:**
- Modify: `app/run/[id].tsx`

**Interfaces:**
- Consumes: `Chart` from `src/components/Chart.tsx`
- Consumes: `genSeries` from `src/utils/chart.ts`
- Consumes: `fmtPace`, `fmtMMSS` from `format.ts`

- [ ] **Step 1: Add imports at top of `app/run/[id].tsx`**

```tsx
import { Chart } from '../../src/components/Chart'
import { genSeries } from '../../src/utils/chart'
```

- [ ] **Step 2: Add `ChartsSection` component**

```tsx
function ChartsSection({ run, typeColor, unit }: { run: Run; typeColor: string; unit: 'km' | 'mi' }) {
  const avgPace = run.timeSec / run.distanceKm
  const avgHr = run.avgHr ?? 140

  const paceSeries = genSeries(run.id + 'pace', 16, avgPace, 14, 0)
  const hrSeries   = genSeries(run.id + 'hr',   16, avgHr - 6, 8, 14)

  return (
    <>
      <View>
        <Text style={s.sectionLabel}>PACE</Text>
        <View style={ch.card}>
          <Chart
            series={paceSeries}
            strokeColor={typeColor}
            formatValue={(v) => fmtPace(v, unit)}
          />
        </View>
      </View>
      <View>
        <Text style={s.sectionLabel}>HEART RATE</Text>
        <View style={ch.card}>
          <Chart
            series={hrSeries}
            strokeColor={colors.hrLine}
            formatValue={(v) => `${Math.round(v)} bpm`}
          />
        </View>
      </View>
    </>
  )
}

const ch = StyleSheet.create({
  card: {
    backgroundColor: colors.bgChart,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
  },
})
```

- [ ] **Step 3: Add `MapPlaceholder` component**

```tsx
function MapPlaceholder() {
  return (
    <View>
      <Text style={s.sectionLabel}>MAP</Text>
      <View style={mp.card}>
        <Text style={mp.label}>Map coming in Phase 3</Text>
      </View>
    </View>
  )
}

const mp = StyleSheet.create({
  card:  { backgroundColor: colors.bgChart, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: spacing.radius, height: 160, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
})
```

- [ ] **Step 4: Add to `ScrollView` in `RunDetail`**

After `<SegmentsSection ... />` (and its condition), add:
```tsx
<ChartsSection run={run} typeColor={typeColor} unit={UNIT} />
<MapPlaceholder />
```

- [ ] **Step 5: Test in Expo Go**

Open any run. Scroll to the bottom. Pace and HR charts should both appear. Tap and drag on either chart — a crosshair, dot, and value pill should track your finger. Map placeholder appears at the bottom.

Check: hold finger on chart edge — pill should clamp and not overflow.

- [ ] **Step 6: Final check — `npx tsc --noEmit`**

No TypeScript errors across all modified files.
