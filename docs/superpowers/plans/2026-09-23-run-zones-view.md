# Run Zones View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a screen, opened from a run's HR chart, that shows the heart-rate trace plus a colored time-in-zone table.

**Architecture:** A new expo-router sub-screen `app/run/[id]/zones.tsx` (same pattern as `splits.tsx`/`segments.tsx`) renders the existing `HrRangeBarsChart` above a zones table. Zone boundaries are derived from one placeholder HRmax constant now; `run.zones` (seconds/zone) already exists in mock data. Entry is a tappable `HEART RATE ›` chevron header on run detail.

**Tech Stack:** Expo Router, React Native, TypeScript. Pure helpers in `src/utils/`. No new dependencies.

## Global Constraints

- **Git is handled by Bar.** Do NOT run any git command. Each task ends by listing the changed files so Bar can commit.
- **Mock data only.** No HealthKit. Read runs from `src/mockData.ts` (`MOCK_RUNS`).
- **Colors** are hex in `src/utils/tokens.ts`; canonical oklch lives in `FRONTEND_SPEC.md` (keep both in sync).
- **Display units:** this screen is `km`-agnostic (no distance/pace shown); HR is `bpm`.
- **Type check** after each task: `npx tsc --noEmit` must pass.
- Placeholder HRmax: `190`. Zone bands at 50/60/70/80/90% of HRmax.
- Zone boundaries for `hrMax=190` are `[95, 114, 133, 152, 171]`.

---

### Task 1: Zone color tokens + helper

**Files:**
- Modify: `src/utils/tokens.ts`
- Modify: `FRONTEND_SPEC.md` (Design Tokens table)

**Interfaces:**
- Produces: `colors.zone1..colors.zone5` (hex strings); `ZONE_COLORS: string[]`; `zoneColor(i: number): string`.

- [ ] **Step 1: Add the five zone colors to the `colors` object**

In `src/utils/tokens.ts`, inside the `colors` object (after `iconSky`), add:

```ts
  zone1: '#e8c200',   // oklch(~0.83 0.17 100) yellow
  zone2: '#e89a00',   // oklch(~0.75 0.16 75)  amber
  zone3: '#e06f00',   // oklch(~0.67 0.16 55)  orange
  zone4: '#dc4a28',   // oklch(~0.60 0.18 35)  red-orange
  zone5: '#d21f1f',   // oklch(~0.55 0.20 27)  strong red
```

- [ ] **Step 2: Add the array + helper**

After the `runTypeColor` export (near line 56), add:

```ts
export const ZONE_COLORS = [
  colors.zone1, colors.zone2, colors.zone3, colors.zone4, colors.zone5,
]
export const zoneColor = (i: number): string => ZONE_COLORS[i] ?? colors.textGhost
```

- [ ] **Step 3: Mirror the tokens into FRONTEND_SPEC.md**

Add a "Zone colors (Z1–Z5)" row group to the Design Tokens table with the five oklch values above, noting they ramp yellow→red for heart-rate zones.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 5: Signal ready**

Tell Bar: changed `src/utils/tokens.ts`, `FRONTEND_SPEC.md` — ready to commit.

---

### Task 2: Zone boundary + range helpers

**Files:**
- Modify: `src/utils/zones.ts`
- Create: `src/utils/zones.check.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `MOCK_HR_MAX = 190`
  - `zoneBounds(hrMax?: number): [number, number, number, number, number]` — lower-bound bpm per zone at 50/60/70/80/90% of `hrMax`.
  - `zoneRangeLabel(i: number, hrMax?: number): string` — e.g. `'<114'`, `'114–132'`, `'171+'`.

- [ ] **Step 1: Write the failing check**

Create `src/utils/zones.check.ts`:

```ts
import assert from 'node:assert/strict'
import { zoneBounds, zoneRangeLabel } from './zones.ts'

// boundaries at 50/60/70/80/90% of 190
assert.deepEqual(zoneBounds(190), [95, 114, 133, 152, 171])

// range labels: Z1 open-below, Z2–Z4 inclusive spans, Z5 open-above
assert.deepEqual(
  [0, 1, 2, 3, 4].map(i => zoneRangeLabel(i, 190)),
  ['<114', '114–132', '133–151', '152–170', '171+'],
)

console.log('zones.check OK')
```

- [ ] **Step 2: Run the check to verify it fails**

Run: `node src/utils/zones.check.ts`
Expected: FAIL — `zoneBounds`/`zoneRangeLabel` not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/utils/zones.ts`:

```ts
export const MOCK_HR_MAX = 190  // ponytail: placeholder until per-user HRmax setting exists

// lower-bound bpm for each zone (Z1..Z5) at 50/60/70/80/90% of HRmax
export function zoneBounds(hrMax = MOCK_HR_MAX): [number, number, number, number, number] {
  return [0.5, 0.6, 0.7, 0.8, 0.9].map(p => Math.round(hrMax * p)) as
    [number, number, number, number, number]
}

// human range per zone: Z1 "<b2", middle "b–(next-1)", Z5 "b5+"
export function zoneRangeLabel(i: number, hrMax = MOCK_HR_MAX): string {
  const b = zoneBounds(hrMax)
  if (i === 0) return `<${b[1]}`
  if (i === 4) return `${b[4]}+`
  return `${b[i]}–${b[i + 1] - 1}`
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `node src/utils/zones.check.ts`
Expected: `zones.check OK`

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Signal ready**

Tell Bar: changed `src/utils/zones.ts`, added `src/utils/zones.check.ts` — ready to commit.

---

### Task 3: Extract the HR-dots helper

**Why:** The synthetic HR series + min/max normalization is currently inline in `ChartsSection` (`app/run/[id].tsx`). The zones screen needs the exact same dots. Extract once, reuse in both.

**Files:**
- Modify: `src/utils/chart.ts` (add helper)
- Modify: `app/run/[id].tsx` (use helper in `ChartsSection`)

**Interfaces:**
- Consumes: `genSeries` (already in `src/utils/chart.ts`), `Run` type.
- Produces: `hrSeries(run: Run): number[]` — 240 HR samples normalized to span `[minHr, maxHr]` (falling back to `avgHr±15`, `avgHr` default 140).

- [ ] **Step 1: Add `hrSeries` to `src/utils/chart.ts`**

Add (import `Run` type at top if not present):

```ts
import type { Run } from '../types'

// Deterministic synthetic HR series for a run, normalized so its extremes
// match the run's min/max HR. Shared by run detail and the zones screen.
export function hrSeries(run: Run): number[] {
  const avgHr = run.avgHr ?? 140
  const minHr = run.minHr ?? avgHr - 15
  const maxHr = run.maxHr ?? avgHr + 15
  const raw = genSeries(run.id + 'hr', 240, avgHr, 4, 6)
  const rawMin = Math.min(...raw)
  const rawMax = Math.max(...raw)
  const rawRange = rawMax - rawMin || 1
  return raw.map(v => Math.round(minHr + ((v - rawMin) / rawRange) * (maxHr - minHr)))
}
```

- [ ] **Step 2: Replace the inline block in `ChartsSection`**

In `app/run/[id].tsx`, delete the inline HR-dots computation in `ChartsSection` (the `avgHr`/`runMinHr`/`runMaxHr`/`rawHr`/`hrDots` lines) and replace with:

```ts
const hrDots = hrSeries(run)
```

Update the import from `../../src/utils/chart` to include `hrSeries` alongside `genSeries`. (`genSeries` is still used for pace elsewhere — keep it.)

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Visual check in Expo Go**

Open a run's detail screen. The HEART RATE chart must render exactly as before (same shape/extremes).

- [ ] **Step 5: Signal ready**

Tell Bar: changed `src/utils/chart.ts`, `app/run/[id].tsx` — ready to commit.

---

### Task 4: Zones screen

**Files:**
- Create: `app/run/[id]/zones.tsx`

**Interfaces:**
- Consumes: `MOCK_RUNS`; `HrRangeBarsChart` (from `src/components/Chart`); `hrSeries` (Task 3); `ZONE_NAMES`, `zoneRangeLabel` (Task 2); `zoneColor`, `colors`, `fonts` (Task 1 / tokens); `tableStyles` (from `SplitsTable`); `fmtMMSS` (from `src/utils/format`).
- Produces: route `/run/[id]/zones`.

Percentages use `total = sum(run.zones)` as the denominator so the Total row is always 100% (mock `zones` need not sum to `run.timeSec`).

- [ ] **Step 1: Create the screen file**

Create `app/run/[id]/zones.tsx`:

```tsx
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MOCK_RUNS } from '../../../src/mockData'
import { fmtMMSS } from '../../../src/utils/format'
import { colors, fonts, spacing, zoneColor } from '../../../src/utils/tokens'
import { ZONE_NAMES, zoneRangeLabel } from '../../../src/utils/zones'
import { hrSeries } from '../../../src/utils/chart'
import { HrRangeBarsChart } from '../../../src/components/Chart'
import { tableStyles as st } from '../../../src/components/SplitsTable'

export default function ZonesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const run = MOCK_RUNS.find(r => r.id === id)

  if (!run) {
    return (
      <View style={[s.screen, s.center]}>
        <Text style={s.notFound}>Run not found</Text>
      </View>
    )
  }

  const zones = run.zones
  const total = zones ? zones.reduce((a, b) => a + b, 0) : 0

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} activeOpacity={0.7}>
          <Text style={s.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Heart Rate</Text>
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: spacing.gap }}>
        <View style={s.chartCard}>
          <HrRangeBarsChart dots={hrSeries(run)} timeSec={run.timeSec} />
        </View>

        <Text style={s.sectionLabel}>ZONES</Text>
        {zones ? (
          <View style={st.card}>
            <View style={[st.row, st.headerRow]}>
              <Text style={[st.cell, st.hdr, { flex: 1.5 }]}>Zone</Text>
              <Text style={[st.cell, st.hdr]}>Range (bpm)</Text>
              <Text style={[st.cell, st.hdr]}>Time</Text>
              <Text style={[st.cell, st.hdr, { flex: 0.6 }]}>%</Text>
            </View>
            {zones.map((sec, i) => (
              <View key={i} style={[st.row, i > 0 && st.borderTop]}>
                <Text style={[st.cell, st.val, { flex: 1.5, color: zoneColor(i) }]}>{`Z${i + 1} ${ZONE_NAMES[i]}`}</Text>
                <Text style={[st.cell, st.val, { color: colors.textSecondary }]}>{zoneRangeLabel(i)}</Text>
                <Text style={[st.cell, st.val, { color: colors.iconTeal }]}>{fmtMMSS(sec)}</Text>
                <Text style={[st.cell, st.val, { flex: 0.6 }]}>{total > 0 ? Math.round((sec / total) * 100) : 0}%</Text>
              </View>
            ))}
            <View style={[st.row, s.totalRow]}>
              <Text style={[st.cell, st.val, s.totalVal, { flex: 1.5 }]}>Total</Text>
              <Text style={[st.cell, st.val]}>—</Text>
              <Text style={[st.cell, st.val, s.totalVal]}>{fmtMMSS(total)}</Text>
              <Text style={[st.cell, st.val, s.totalVal, { flex: 0.6 }]}>100%</Text>
            </View>
          </View>
        ) : (
          <Text style={s.noData}>No zone data for this run</Text>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bgApp },
  center:   { alignItems: 'center', justifyContent: 'center' },
  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  closeBtn: {
    position: 'absolute', left: 14, width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon:   { fontFamily: fonts.body, fontSize: 16, color: colors.textPrimary },
  headerTitle: { fontFamily: fonts.body, fontSize: 18, fontWeight: '800', color: colors.textPrimary },

  body: { flex: 1, paddingHorizontal: 18 },
  chartCard: { backgroundColor: colors.bgChart, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: spacing.radius, overflow: 'hidden' },

  sectionLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, letterSpacing: 0.6 },
  noData: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  totalRow: { borderTopWidth: 1, borderTopColor: colors.borderStrong },
  totalVal: { fontWeight: '700', color: colors.textPrimary },
})
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Verify the route renders (temporary manual nav)**

In Expo Go, navigate to `/run/<some-id>/zones` (e.g. via a temporary link, or proceed to Task 4 to wire the real entry). Confirm: HR chart at top, zones table with 5 colored rows (yellow→red), ranges shown, Total row time = sum of zones and 100%.

- [ ] **Step 4: Signal ready**

Tell Bar: added `app/run/[id]/zones.tsx` — ready to commit.

---

### Task 5: Wire the entry point on run detail

**Files:**
- Modify: `app/run/[id].tsx` (`ChartsSection`)

**Interfaces:**
- Consumes: `useRouter` (already imported), the `tapHeader`/`tapChevron`/`sectionLabel` styles (already defined in `s`).

- [ ] **Step 1: Make the HEART RATE block tap through to the zones screen**

In `ChartsSection` (`app/run/[id].tsx`), the function needs the router. Add at the top of `ChartsSection`:

```ts
const router = useRouter()
```

Replace the HEART RATE block:

```tsx
      <View>
        <Text style={s.sectionLabel}>HEART RATE</Text>
        <View style={ch.card}>
          <HrRangeBarsChart dots={hrDots} timeSec={run.timeSec} />
        </View>
      </View>
```

with a tappable header matching SPLITS/SEGMENTS:

```tsx
      <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}/zones`)}>
        <View style={s.tapHeader}>
          <Text style={[s.sectionLabel, { marginBottom: 0 }]}>HEART RATE</Text>
          <Text style={s.tapChevron}>›</Text>
        </View>
        <View style={ch.card}>
          <HrRangeBarsChart dots={hrDots} timeSec={run.timeSec} />
        </View>
      </TouchableOpacity>
```

(`TouchableOpacity` and `useRouter` are already imported in this file.)

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Visual + interaction check in Expo Go**

Open a run → the HEART RATE section now shows a `›` chevron → tap it → the Zones screen opens with the HR chart and zone table → ✕ returns to run detail. Confirm scrubbing the HR chart on run detail still works (tap-to-open should not have replaced scrub, because only the header area triggers navigation via the surrounding touchable — verify a drag on the chart still scrubs; if the touchable swallows the drag, move the `onPress` to wrap only the `tapHeader` View instead of the chart).

- [ ] **Step 4: Signal ready**

Tell Bar: changed `app/run/[id].tsx` — ready to commit.

---

## Self-Review Notes

- **Spec coverage:** table form (T4), entry from HR chart via chevron (T5), HR chart + table on one screen (T4), bpm ranges (T2+T4), yellow→red colors (T1+T4), placeholder HRmax boundaries (T2), Total row (T4). All covered.
- **Type consistency:** `hrSeries` (T3) consumed in T4/T5; `zoneBounds`/`zoneRangeLabel`/`ZONE_NAMES`/`MOCK_HR_MAX` (T2) consumed in T4; `zoneColor`/`ZONE_COLORS` (T1) consumed in T4. Names match across tasks.
- **Known interaction risk (T5 Step 3):** the chart captures horizontal drags for scrubbing; if wrapping the chart in a touchable interferes, the fallback (wrap only the header) is stated inline.
- **Deviation from spec (intentional):** Z5 range label is `171+` (not `>171`) and the `%` denominator is `sum(run.zones)` (not `run.timeSec`) so the Total row reads 100%. Both are within the approved design.
