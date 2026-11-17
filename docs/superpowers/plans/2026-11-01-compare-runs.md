# Compare Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user compare exactly 2 runs side by side, reachable from the Runs list (selection mode), Run Detail (same-type sheet), and the Compare tab (two-slot picker).

**Architecture:** One comparison screen (`app/compare/result.tsx`) driven by route params `a` and `b`. Metric rows and the per-row "better" rule live in `src/utils/compare.ts`. The month-grouped run list is extracted from `runs.tsx` into `src/components/RunPickerList.tsx` so the Runs tab and the Compare tab picker share it. Selection state is local `useState` in `runs.tsx` (tab screens stay mounted, so it persists until cancelled); Run Detail hands a pre-selected run over via the `select` route param.

**Tech Stack:** Expo ~54, expo-router, React Native `Modal` (`presentationStyle="pageSheet"`), `Switch`, `Alert`, `SectionList`/`FlatList`. Existing tokens and format utils.

**Spec:** `docs/superpowers/specs/2026-11-01-compare-runs-design.md`

## Global Constraints

- CLAUDE.md: **never run git commands.** "Commit" steps mean: stop and tell Bar which files are ready to commit.
- Colors from `src/utils/tokens.ts` only — no hardcoded hex in screens/components.
- Fonts: `fonts.body` (Inter) for labels, `fonts.mono` (JetBrainsMono) for numeric values.
- Unit: `const UNIT = 'km' as const` in each file (same as existing screens) until `useUserStore` exists.
- Data is read-only: never mutate `MOCK_RUNS` / `MOCK_RUN_TYPES`.
- No new npm dependencies. (`npx tsx` is a one-off runner for the self-check, not a project dependency.)
- "Better" is per row only. Never compute an overall winner, score, or count of row wins.
- Exact copy:
  - 3rd-run alert: `You can compare only 2 runs. Uncheck one first.`
  - Toggle label: `Highlight better results`
  - Sheet link: `Choose from all runs`
  - Not found: `Run not found`
- Icon asset: `assets/compare.png` (already in repo), tinted via `tintColor`.
- Typecheck command used for verification: `npx tsc --noEmit` (must report no errors).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/compare.ts` | Create | `COMPARE_METRICS`, `betterValue()` |
| `src/utils/compare.check.ts` | Create | Assert-based self-check for `betterValue()` |
| `src/components/RunPickerList.tsx` | Create | Month-grouped run list + type chips; exports `RunPickerList`, `RunRow`, `TYPE_MAP` |
| `app/(tabs)/runs.tsx` | Rewrite | Runs tab: list + selection mode + bottom bar |
| `app/compare/result.tsx` | Create | Comparison screen |
| `app/(tabs)/compare.tsx` | Rewrite | Two-slot picker |
| `app/run/[id].tsx` | Modify | Compare FAB + same-type sheet |
| `FRONTEND_SPEC.md` | Modify §5 | Match new design |
| `architecture.md` | Modify | File tree |

---

### Task 1: Metrics + `betterValue()` rule

**Files:**
- Create: `src/utils/compare.ts`
- Test: `src/utils/compare.check.ts`

**Interfaces:**
- Consumes: `fmtDistance`, `fmtMMSS`, `fmtPace` from `src/utils/format.ts`; `computePrimaryZone` from `src/utils/zones.ts`; `Run` from `src/types`.
- Produces:
  - `type Better = 'higher' | 'lower' | 'none'`
  - `interface CompareMetric { label: string; get: (run: Run) => number | null; fmt: (value: number, unit: 'km' | 'mi') => string; better: Better }`
  - `const COMPARE_METRICS: CompareMetric[]` (10 rows, labels exactly: `Distance`, `Time`, `Avg Pace`, `Avg HR`, `Max HR`, `Elevation`, `Cadence`, `Calories`, `Primary Zone`, `Weather`)
  - `function betterValue(m: CompareMetric, a: Run, b: Run): 'a' | 'b' | null`

- [ ] **Step 1: Write the failing self-check**

Create `src/utils/compare.check.ts`:

```ts
// Run: npx tsx src/utils/compare.check.ts
import type { Run } from '../types'
import { COMPARE_METRICS, betterValue } from './compare'

function eq(actual: unknown, expected: unknown, msg: string) {
  if (actual !== expected) throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`)
}

const base: Run = {
  id: 'x', healthkitUuid: 'x', typeId: null, name: 'x', date: '2026-01-01',
  distanceKm: 10, timeSec: 3000, avgHr: 150, maxHr: 170, minHr: 120,
  elevGain: 50, cadence: 170, source: 'apple_health', notes: null,
  segments: null, splits: [], weather: null, zones: null,
}
const run = (o: Partial<Run>): Run => ({ ...base, ...o })
const metric = (label: string) => {
  const m = COMPARE_METRICS.find(x => x.label === label)
  if (!m) throw new Error(`missing metric ${label}`)
  return m
}

eq(COMPARE_METRICS.length, 10, 'row count')
eq(betterValue(metric('Distance'), run({ distanceKm: 10 }), run({ distanceKm: 12 })), 'b', 'higher wins')
eq(betterValue(metric('Time'), run({ timeSec: 2900 }), run({ timeSec: 3000 })), 'a', 'lower wins')
eq(betterValue(metric('Avg Pace'), run({ timeSec: 3000 }), run({ timeSec: 2900 })), 'b', 'faster pace wins')
eq(betterValue(metric('Avg HR'), run({ avgHr: 150 }), run({ avgHr: 150 })), null, 'tie')
eq(betterValue(metric('Calories'), run({ distanceKm: 5 }), run({ distanceKm: 10 })), null, 'none rule')
eq(betterValue(metric('Avg HR'), run({ avgHr: null }), run({ avgHr: 140 })), null, 'missing value')
eq(metric('Avg Pace').get(run({ distanceKm: 0 })), null, 'zero distance pace')
eq(metric('Time').fmt(2892, 'km'), '48:12', 'time format')

console.log('compare.check: all passed')
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx tsx src/utils/compare.check.ts`
Expected: FAIL — error resolving `./compare` (module not found).

- [ ] **Step 3: Implement `src/utils/compare.ts`**

```ts
import type { Run } from '../types'
import { fmtDistance, fmtMMSS, fmtPace } from './format'
import { computePrimaryZone } from './zones'

export type Better = 'higher' | 'lower' | 'none'

export interface CompareMetric {
  label: string
  get: (run: Run) => number | null
  fmt: (value: number, unit: 'km' | 'mi') => string
  better: Better
}

// "Better" is judged per row only — there is no overall verdict on which run is better.
// ponytail: placeholder rule; redefine by editing `better` per row (or replacing betterValue)
export const COMPARE_METRICS: CompareMetric[] = [
  { label: 'Distance',     get: r => r.distanceKm,                                  fmt: (v, u) => fmtDistance(v, u),    better: 'higher' },
  { label: 'Time',         get: r => r.timeSec,                                     fmt: v => fmtMMSS(v),                better: 'lower' },
  { label: 'Avg Pace',     get: r => (r.distanceKm > 0 ? r.timeSec / r.distanceKm : null), fmt: (v, u) => fmtPace(v, u), better: 'lower' },
  { label: 'Avg HR',       get: r => r.avgHr,                                       fmt: v => `${Math.round(v)} bpm`,    better: 'lower' },
  { label: 'Max HR',       get: r => r.maxHr,                                       fmt: v => `${Math.round(v)} bpm`,    better: 'lower' },
  { label: 'Elevation',    get: r => r.elevGain,                                    fmt: v => `${Math.round(v)} m`,      better: 'higher' },
  { label: 'Cadence',      get: r => r.cadence,                                     fmt: v => `${Math.round(v)} spm`,    better: 'higher' },
  { label: 'Calories',     get: r => Math.round(r.distanceKm * 62),                 fmt: v => `${v} kcal`,               better: 'none' },
  { label: 'Primary Zone', get: r => computePrimaryZone(r)?.zone ?? null,           fmt: v => `Zone ${v}`,               better: 'none' },
  { label: 'Weather',      get: r => r.weather?.tempC ?? null,                      fmt: v => `${v}°C`,                  better: 'none' },
]

// Which side has the better value in this one row. null = no highlight
// (rule is 'none', a value is missing, or the values are equal).
export function betterValue(m: CompareMetric, a: Run, b: Run): 'a' | 'b' | null {
  if (m.better === 'none') return null
  const va = m.get(a)
  const vb = m.get(b)
  if (va == null || vb == null || va === vb) return null
  return (va > vb) === (m.better === 'higher') ? 'a' : 'b'
}
```

Note: the Calories formula (`distanceKm * 62`) is the same one `SummaryGrid` in `app/run/[id].tsx` uses.

- [ ] **Step 4: Run the check and confirm it passes**

Run: `npx tsx src/utils/compare.check.ts`
Expected: `compare.check: all passed`

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit checkpoint**

Tell Bar: ready to commit `src/utils/compare.ts`, `src/utils/compare.check.ts`.

---

### Task 2: Extract `RunPickerList` from the Runs screen (pure refactor)

The Runs tab must look and behave exactly as before after this task.

**Files:**
- Create: `src/components/RunPickerList.tsx`
- Rewrite: `app/(tabs)/runs.tsx`

**Interfaces:**
- Consumes: `MOCK_RUNS`, `MOCK_RUN_TYPES`, format utils, tokens.
- Produces (from `src/components/RunPickerList.tsx`):
  - `const TYPE_MAP: Record<string, RunType>`
  - `function RunRow(props: { run: Run; onPress: () => void; checked?: boolean; disabled?: boolean }): JSX.Element` — `checked === undefined` shows the `›` chevron; a boolean shows a check circle (filled + ✓ when true). `disabled` greys the row and blocks taps.
  - `function RunPickerList(props: { onPressRun: (run: Run) => void; checkedIds?: string[]; disabledIds?: string[]; headerRight?: ReactNode; bottomInset?: number }): JSX.Element` — owns its own type-filter state. `checkedIds` provided ⇒ rows render check circles. `headerRight` renders to the right of the type chips. `bottomInset` adds extra bottom padding to the list (for an overlaying bar).

- [ ] **Step 1: Create `src/components/RunPickerList.tsx`**

```tsx
import { useState, type ReactNode } from 'react'
import { SectionList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../mockData'
import type { Run, RunType } from '../types'
import { fmtDate, fmtDistance, fmtDuration, fmtPace } from '../utils/format'
import { colors, fonts, runTypeColor, spacing } from '../utils/tokens'

// ponytail: hardcoded until useUserStore lands; replace with store selector
const UNIT: 'km' | 'mi' = 'km'
export const TYPE_MAP: Record<string, RunType> = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

type SectionStats = { runCount: number; totalDistanceKm: number; totalTimeSec: number }

type RunSection = {
  key: string
  title: string
  allStats: SectionStats
  filteredStats: SectionStats | null
  data: Run[]
}

function computeStats(runs: Run[]): SectionStats {
  return {
    runCount: runs.length,
    totalDistanceKm: runs.reduce((s, r) => s + r.distanceKm, 0),
    totalTimeSec: runs.reduce((s, r) => s + r.timeSec, 0),
  }
}

function buildSections(runs: Run[], selectedTypeId: string | null): RunSection[] {
  // group by 'YYYY-MM'
  const groups = new Map<string, Run[]>()
  for (const run of runs) {
    const key = run.date.slice(0, 7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(run)
  }

  // sort months newest first
  const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a))

  const sections: RunSection[] = []
  for (const key of sortedKeys) {
    const monthRuns = groups.get(key)!.sort((a, b) => b.date.localeCompare(a.date))
    const filteredRuns = selectedTypeId
      ? monthRuns.filter(r => r.typeId === selectedTypeId)
      : monthRuns

    // skip month entirely if filter active and no matching runs
    if (selectedTypeId && filteredRuns.length === 0) continue

    const [year, month] = key.split('-').map(Number)
    sections.push({
      key,
      title: `${MONTH_NAMES[month - 1].toUpperCase()} ${year}`,
      allStats: computeStats(monthRuns),
      filteredStats: selectedTypeId ? computeStats(filteredRuns) : null,
      data: filteredRuns,
    })
  }
  return sections
}

function fmtStats(stats: SectionStats): string {
  const dist = fmtDistance(stats.totalDistanceKm, UNIT)
  const time = fmtDuration(stats.totalTimeSec)
  return `${stats.runCount} runs · ${dist} · ${time}`
}

function MonthHeader({ section, selectedTypeId }: { section: RunSection; selectedTypeId: string | null }) {
  const filteredType = selectedTypeId ? (TYPE_MAP[selectedTypeId] ?? null) : null
  const typeColor = filteredType ? runTypeColor(filteredType.hue) : colors.textGhost

  return (
    <View style={mh.container}>
      <Text style={mh.title}>{section.title}</Text>
      <View style={mh.row}>
        <Text style={mh.label}>All runs</Text>
        <Text style={mh.stats}>{fmtStats(section.allStats)}</Text>
      </View>
      {section.filteredStats && filteredType && (
        <View style={mh.row}>
          <View style={[mh.dot, { backgroundColor: typeColor }]} />
          <Text style={[mh.label, { color: typeColor }]}>{filteredType.name}</Text>
          <Text style={mh.stats}>{fmtStats(section.filteredStats)}</Text>
        </View>
      )}
    </View>
  )
}

const mh = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.screenH,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  title: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 2,
  },
  stats: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
  },
})

export function RunRow({
  run,
  onPress,
  checked,
  disabled,
}: {
  run: Run
  onPress: () => void
  checked?: boolean
  disabled?: boolean
}) {
  const type = run.typeId ? TYPE_MAP[run.typeId] : undefined
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost

  const pace = run.timeSec / run.distanceKm
  return (
    <TouchableOpacity
      style={[rr.card, checked && rr.cardChecked, disabled && rr.cardDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[rr.bar, { backgroundColor: typeColor }]} />
      <View style={rr.center}>
        <Text style={rr.typeName}>{type?.name ?? 'Unclassified'}</Text>
        <Text style={rr.date}>{fmtDate(run.date)}</Text>
        <Text style={rr.meta}>
          {fmtDistance(run.distanceKm, UNIT)} · {fmtPace(pace, UNIT)} · {fmtDuration(run.timeSec)}
        </Text>
      </View>
      {checked === undefined ? (
        <Text style={rr.chevron}>›</Text>
      ) : (
        <View style={[rr.check, checked && rr.checkOn]}>
          {checked && <Text style={rr.checkMark}>✓</Text>}
        </View>
      )}
    </TouchableOpacity>
  )
}

const rr = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 12,
    gap: 12,
  },
  cardChecked:  { borderColor: colors.accent },
  cardDisabled: { opacity: 0.35 },
  bar:      { width: 8, height: 36, borderRadius: 4 },
  center:   { flex: 1, gap: 2 },
  typeName: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  date:     { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  meta:     { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  chevron:  { fontFamily: fonts.body, fontSize: 18, color: colors.textGhost },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderFocus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn:   { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.bgApp },
})

function TypeFilterBar({
  selectedTypeId,
  onSelect,
  right,
}: {
  selectedTypeId: string | null
  onSelect: (id: string | null) => void
  right?: ReactNode
}) {
  return (
    <View style={tf.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tf.row} style={tf.scroll}>
        <TouchableOpacity
          style={[tf.chip, selectedTypeId === null && tf.chipActive]}
          onPress={() => onSelect(null)}
        >
          <Text style={[tf.chipText, selectedTypeId === null && tf.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {MOCK_RUN_TYPES.map(type => {
          const active = selectedTypeId === type.id
          const typeColor = runTypeColor(type.hue)
          return (
            <TouchableOpacity
              key={type.id}
              style={[
                tf.chip,
                active && { backgroundColor: typeColor + '40', borderColor: typeColor + '80' },
              ]}
              onPress={() => onSelect(active ? null : type.id)}
            >
              <Text style={[tf.chipText, active && { color: typeColor }]}>{type.name}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      {right ? <View style={tf.right}>{right}</View> : null}
    </View>
  )
}

const tf = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  scroll: { flex: 1 },
  right:  { paddingLeft: 4, paddingRight: spacing.screenH },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenH,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderFocus,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: 'transparent',
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
})

export function RunPickerList({
  onPressRun,
  checkedIds,
  disabledIds = [],
  headerRight,
  bottomInset = 0,
}: {
  onPressRun: (run: Run) => void
  checkedIds?: string[]
  disabledIds?: string[]
  headerRight?: ReactNode
  bottomInset?: number
}) {
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const sections = buildSections(MOCK_RUNS, selectedTypeId)

  return (
    <View style={s.flex}>
      <TypeFilterBar selectedTypeId={selectedTypeId} onSelect={setSelectedTypeId} right={headerRight} />
      <SectionList
        sections={sections}
        keyExtractor={run => run.id}
        extraData={[checkedIds, disabledIds]}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <MonthHeader section={section as RunSection} selectedTypeId={selectedTypeId} />
        )}
        renderSectionFooter={() => <View style={{ height: 16 }} />}
        renderItem={({ item }) => (
          <View style={s.itemWrap}>
            <RunRow
              run={item}
              onPress={() => onPressRun(item)}
              checked={checkedIds ? checkedIds.includes(item.id) : undefined}
              disabled={disabledIds.includes(item.id)}
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ paddingBottom: 32 + bottomInset }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>No runs match this filter.</Text>
          </View>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  flex:      { flex: 1 },
  itemWrap:  { paddingHorizontal: spacing.screenH, paddingTop: 10 },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
})
```

Note `extraData`: `SectionList` only re-renders rows when `sections` changes; `extraData` makes it re-render when the checked/disabled lists change.

- [ ] **Step 2: Rewrite `app/(tabs)/runs.tsx` to use it**

```tsx
import { StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RunPickerList } from '../../src/components/RunPickerList'
import { colors } from '../../src/utils/tokens'

export default function Runs() {
  const router = useRouter()
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <RunPickerList onPressRun={run => router.push(`/run/${run.id}`)} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
})
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Manual (Expo Go, `npx expo start`): Runs tab looks identical to before — month headers sticky, type chips filter, tapping a row opens Run Detail.

- [ ] **Step 4: Commit checkpoint**

Tell Bar: ready to commit `src/components/RunPickerList.tsx`, `app/(tabs)/runs.tsx`.

---

### Task 3: Comparison screen

**Files:**
- Create: `app/compare/result.tsx`

**Interfaces:**
- Consumes: `COMPARE_METRICS`, `betterValue` (Task 1); `TYPE_MAP` (Task 2); `MOCK_RUNS`; `fmtDateFull`.
- Produces: route `/compare/result` with params `{ a: string; b: string }` (run ids). Later tasks navigate with `router.push({ pathname: '/compare/result', params: { a, b } })`.

No root layout change is needed: `app/_layout.tsx` uses a default `Stack`, so `compare/result` is pushed as a normal card screen. (`/compare/result` does not clash with the `/compare` tab route.)

- [ ] **Step 1: Create `app/compare/result.tsx`**

```tsx
import { useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MOCK_RUNS } from '../../src/mockData'
import type { Run } from '../../src/types'
import { TYPE_MAP } from '../../src/components/RunPickerList'
import { COMPARE_METRICS, betterValue } from '../../src/utils/compare'
import { fmtDateFull } from '../../src/utils/format'
import { colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'

const UNIT = 'km' as const

function RunHeader({ run, label }: { run: Run; label: string }) {
  const router = useRouter()
  const type = run.typeId ? TYPE_MAP[run.typeId] : undefined
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost
  return (
    <TouchableOpacity style={s.runHeader} activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}`)}>
      <View style={[s.runBar, { backgroundColor: typeColor }]} />
      <View style={s.flex}>
        <Text style={s.runLabel}>{label}</Text>
        <Text style={s.runType} numberOfLines={1}>{type?.name ?? 'Unclassified'}</Text>
        <Text style={s.runDate}>{fmtDateFull(run.date)}</Text>
      </View>
    </TouchableOpacity>
  )
}

export default function CompareResult() {
  const { a, b } = useLocalSearchParams<{ a?: string; b?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [highlight, setHighlight] = useState(false)

  const runA = MOCK_RUNS.find(r => r.id === a)
  const runB = MOCK_RUNS.find(r => r.id === b)

  const backButton = (
    <TouchableOpacity onPress={() => router.back()} style={[s.backFab, { top: insets.top + 12 }]} activeOpacity={0.7}>
      <Text style={s.backFabIcon}>‹</Text>
    </TouchableOpacity>
  )

  if (!runA || !runB) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Text style={s.notFound}>Run not found</Text>
        {backButton}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.headers}>
          <RunHeader run={runA} label="A" />
          <RunHeader run={runB} label="B" />
        </View>

        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>Highlight better results</Text>
          <Switch
            value={highlight}
            onValueChange={setHighlight}
            trackColor={{ true: colors.accentBg, false: colors.borderFocus }}
          />
        </View>

        <View style={s.table}>
          <View style={[s.row, s.headRow]}>
            <Text style={[s.cellMetric, s.headText]}>Metric</Text>
            <Text style={[s.cellVal, s.headText]}>A</Text>
            <Text style={[s.cellVal, s.headText]}>B</Text>
          </View>
          {COMPARE_METRICS.map(m => {
            const va = m.get(runA)
            const vb = m.get(runB)
            const better = highlight ? betterValue(m, runA, runB) : null
            return (
              <View key={m.label} style={s.row}>
                <Text style={s.cellMetric}>{m.label}</Text>
                <Text style={[s.cellVal, better === 'a' && s.better]}>{va == null ? '—' : m.fmt(va, UNIT)}</Text>
                <Text style={[s.cellVal, better === 'b' && s.better]}>{vb == null ? '—' : m.fmt(vb, UNIT)}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
      {backButton}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  flex:    { flex: 1 },
  content: { padding: spacing.screenH, paddingTop: 72, gap: spacing.gap },

  backFab: {
    position: 'absolute',
    left: spacing.screenH,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  backFabIcon: {
    fontFamily: fonts.body,
    fontSize: 28,
    lineHeight: 30,
    color: colors.textPrimary,
    marginTop: -3,
    marginLeft: -2,
  },

  headers:   { flexDirection: 'row', gap: 10 },
  runHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 12,
  },
  runBar:   { width: 6, height: 44, borderRadius: 3 },
  runLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  runType:  { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  runDate:  { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 2 },

  toggleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },

  table: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  headRow:    { backgroundColor: colors.bgElevated, borderTopWidth: 0 },
  headText:   { fontFamily: fonts.body, fontSize: 11, color: colors.textDim, fontWeight: '400' },
  cellMetric: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  cellVal:    { flex: 0.8, textAlign: 'right', fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
  better:     { color: colors.accent, fontWeight: '700' },

  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 80 },
})
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Manual check of this screen happens in Task 4 (first entry point).

- [ ] **Step 3: Commit checkpoint**

Tell Bar: ready to commit `app/compare/result.tsx`.

---

### Task 4: Compare tab — two-slot picker

**Files:**
- Rewrite: `app/(tabs)/compare.tsx`

**Interfaces:**
- Consumes: `RunPickerList`, `TYPE_MAP` (Task 2); route `/compare/result` (Task 3).
- Produces: nothing used by other tasks.

- [ ] **Step 1: Rewrite `app/(tabs)/compare.tsx`**

```tsx
import { useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RunPickerList, TYPE_MAP } from '../../src/components/RunPickerList'
import type { Run } from '../../src/types'
import { fmtDate, fmtDistance } from '../../src/utils/format'
import { colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'

const UNIT = 'km' as const
type Slot = 'a' | 'b'

function SlotCard({ label, run, onPress }: { label: string; run: Run | null; onPress: () => void }) {
  const type = run?.typeId ? TYPE_MAP[run.typeId] : undefined
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost
  return (
    <TouchableOpacity style={s.slot} activeOpacity={0.7} onPress={onPress}>
      <Text style={s.slotLabel}>{label}</Text>
      {run ? (
        <View style={s.slotBody}>
          <View style={[s.slotBar, { backgroundColor: typeColor }]} />
          <View style={s.flex}>
            <Text style={s.slotType} numberOfLines={1}>{type?.name ?? 'Unclassified'}</Text>
            <Text style={s.slotMeta}>{fmtDate(run.date)} · {fmtDistance(run.distanceKm, UNIT)}</Text>
          </View>
        </View>
      ) : (
        <Text style={s.slotEmpty}>Select run</Text>
      )}
    </TouchableOpacity>
  )
}

export default function Compare() {
  const router = useRouter()
  const [slots, setSlots] = useState<Record<Slot, Run | null>>({ a: null, b: null })
  const [picking, setPicking] = useState<Slot | null>(null)

  const other = picking === 'a' ? slots.b : picking === 'b' ? slots.a : null
  const ready = slots.a !== null && slots.b !== null

  function pick(run: Run) {
    if (!picking) return
    setSlots(prev => ({ ...prev, [picking]: run }))
    setPicking(null)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.content}>
        <Text style={s.title}>Compare runs</Text>

        <View style={s.slots}>
          <SlotCard label="Run A" run={slots.a} onPress={() => setPicking('a')} />
          <SlotCard label="Run B" run={slots.b} onPress={() => setPicking('b')} />
        </View>

        <TouchableOpacity
          style={[s.button, !ready && s.buttonDisabled]}
          disabled={!ready}
          onPress={() => router.push({ pathname: '/compare/result', params: { a: slots.a!.id, b: slots.b!.id } })}
        >
          <Text style={s.buttonText}>Compare</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={picking !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPicking(null)}
      >
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select run {picking?.toUpperCase()}</Text>
            <TouchableOpacity onPress={() => setPicking(null)} hitSlop={8}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <RunPickerList onPressRun={pick} disabledIds={other ? [other.id] : []} />
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  flex:    { flex: 1 },
  content: { padding: spacing.screenH, gap: spacing.gap },
  title:   { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.textPrimary },

  slots: { flexDirection: 'row', gap: 10 },
  slot: {
    flex: 1,
    minHeight: 84,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 12,
    gap: 8,
  },
  slotLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  slotBody:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotBar:   { width: 6, height: 36, borderRadius: 3 },
  slotType:  { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  slotMeta:  { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 2 },
  slotEmpty: { fontFamily: fonts.body, fontSize: 14, color: colors.textGhost },

  button: {
    backgroundColor: colors.accentBg,
    borderRadius: spacing.radius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.35 },
  buttonText:     { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  modal:       { flex: 1, backgroundColor: colors.bgApp },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH,
    paddingVertical: 16,
  },
  modalTitle: { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  close:      { fontFamily: fonts.body, fontSize: 18, color: colors.textSecondary },
})
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Manual (Expo Go):
1. Compare tab shows "Compare runs", two empty slots, disabled Compare button.
2. Tap Run A → sheet with run list; pick a run → slot A filled, sheet closes. Swipe down / ✕ closes without picking.
3. Tap Run B → the run in slot A is greyed out and not tappable. Pick another → Compare enabled.
4. Compare → comparison screen: headers A/B, toggle off, 10 rows, "—" for missing values.
5. Toggle on → per row, the better value turns accent + bold (Distance/Elevation/Cadence higher; Time/Pace/HR lower; Calories/Zone/Weather never). Ties never highlight.
6. Tap a run header → Run Detail. Back → comparison. Back → Compare tab with slots still filled.

- [ ] **Step 3: Commit checkpoint**

Tell Bar: ready to commit `app/(tabs)/compare.tsx`.

---

### Task 5: Runs tab selection mode + bottom bar

**Files:**
- Rewrite: `app/(tabs)/runs.tsx`

**Interfaces:**
- Consumes: `RunPickerList` (Task 2) with `checkedIds`, `headerRight`, `bottomInset`; route `/compare/result` (Task 3).
- Produces: the Runs route accepts param `select?: string` (a run id). Task 6 navigates with `router.navigate({ pathname: '/runs', params: { select: run.id } })`.

- [ ] **Step 1: Rewrite `app/(tabs)/runs.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RunPickerList } from '../../src/components/RunPickerList'
import { MOCK_RUNS } from '../../src/mockData'
import type { Run } from '../../src/types'
import { fmtDate } from '../../src/utils/format'
import { colors, fonts, spacing } from '../../src/utils/tokens'

const BAR_SPACE = 76 // list bottom padding while the compare bar is showing

export default function Runs() {
  const router = useRouter()
  const { select } = useLocalSearchParams<{ select?: string }>()
  // Selection lives here; tab screens stay mounted, so it persists until ✕ or icon re-tap.
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Arriving from Run Detail's "Choose from all runs": start fresh with that run checked.
  useEffect(() => {
    if (!select) return
    setSelecting(true)
    setSelectedIds([select])
    router.setParams({ select: undefined })
  }, [select])

  function exitSelection() {
    setSelecting(false)
    setSelectedIds([])
  }

  function onPressRun(run: Run) {
    if (!selecting) {
      router.push(`/run/${run.id}`)
      return
    }
    if (selectedIds.includes(run.id)) {
      setSelectedIds(ids => ids.filter(id => id !== run.id))
      return
    }
    if (selectedIds.length >= 2) {
      Alert.alert('You can compare only 2 runs. Uncheck one first.')
      return
    }
    setSelectedIds(ids => [...ids, run.id])
  }

  // older run first → A, newer → B
  const pair = selectedIds.length === 2
    ? selectedIds
        .map(id => MOCK_RUNS.find(r => r.id === id))
        .filter((r): r is Run => r !== undefined)
        .sort((x, y) => x.date.localeCompare(y.date))
    : null

  const compareIcon = (
    <TouchableOpacity onPress={() => (selecting ? exitSelection() : setSelecting(true))} hitSlop={8}>
      <Image
        source={require('../../assets/compare.png')}
        style={[s.icon, { tintColor: selecting ? colors.accent : colors.textSecondary }]}
      />
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <RunPickerList
        onPressRun={onPressRun}
        checkedIds={selecting ? selectedIds : undefined}
        headerRight={compareIcon}
        bottomInset={pair ? BAR_SPACE : 0}
      />

      {pair && pair.length === 2 && (
        <View style={s.bar}>
          <Text style={s.barText} numberOfLines={1}>
            {fmtDate(pair[0].date)} vs {fmtDate(pair[1].date)}
          </Text>
          <TouchableOpacity
            style={s.barBtn}
            onPress={() => router.push({ pathname: '/compare/result', params: { a: pair[0].id, b: pair[1].id } })}
          >
            <Text style={s.barBtnText}>Compare ›</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={exitSelection} hitSlop={8}>
            <Text style={s.barClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  icon: { width: 22, height: 22 },

  bar: {
    position: 'absolute',
    left: spacing.screenH,
    right: spacing.screenH,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: spacing.radius,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  barText:    { flex: 1, fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  barBtn:     { backgroundColor: colors.accentBg, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  barBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  barClose:   { fontFamily: fonts.body, fontSize: 18, color: colors.textSecondary },
})
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Manual (Expo Go):
1. Compare icon sits right of the type chips, grey. Tap → turns accent, rows show empty circles.
2. Tap a row → checked (accent border + ✓), does not open Run Detail. Tap again → unchecked.
3. Check 2 → bar appears: "Jul 5 vs Aug 2   Compare ›   ✕" (older date first).
4. Tap a 3rd row → alert "You can compare only 2 runs. Uncheck one first."; nothing changes.
5. Uncheck one → bar hides. Re-check → bar returns.
6. Compare › → comparison screen with older run as A. Back → still in selection mode, both checked, bar visible.
7. Switch to Dashboard and back → selection intact.
8. Change type filter → checked runs stay checked (bar still shows both dates even if one is filtered out).
9. ✕ → selection cleared, icon grey, rows show chevrons, tap opens Run Detail. Same result when re-tapping the icon mid-selection.

- [ ] **Step 3: Commit checkpoint**

Tell Bar: ready to commit `app/(tabs)/runs.tsx`.

---

### Task 6: Run Detail — compare icon + same-type sheet

**Files:**
- Modify: `app/run/[id].tsx` (imports at lines 1–13; add `CompareSheet` component before `// ─── Screen`; add state, FAB, and sheet inside `RunDetail`; add styles)

**Interfaces:**
- Consumes: `RunRow`, `TYPE_MAP` (Task 2); route `/compare/result` (Task 3); Runs `select` param (Task 5).
- Produces: nothing used by other tasks.

- [ ] **Step 1: Update imports**

Replace lines 1–2:

```tsx
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
```

with:

```tsx
import { useState } from 'react'
import { FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { RunRow } from '../../src/components/RunPickerList'
```

(`TYPE_MAP` stays defined locally in this file as it is today; no change needed.)

- [ ] **Step 2: Add the `CompareSheet` component**

Insert directly above `// ─── Screen ───...`:

```tsx
// ─── Compare Sheet ───────────────────────────────────────────────────────────

function CompareSheet({ run, visible, onClose }: { run: Run; visible: boolean; onClose: () => void }) {
  const router = useRouter()
  const typeName = run.typeId ? (TYPE_MAP[run.typeId]?.name ?? 'Unclassified') : 'unclassified'
  const others = MOCK_RUNS
    .filter(r => r.id !== run.id && r.typeId === run.typeId)
    .sort((x, y) => y.date.localeCompare(x.date))

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={cs.sheet}>
        <View style={cs.header}>
          <Text style={cs.title}>Compare with…</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={cs.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={others}
          keyExtractor={r => r.id}
          contentContainerStyle={cs.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <RunRow
              run={item}
              onPress={() => {
                onClose()
                router.push({ pathname: '/compare/result', params: { a: run.id, b: item.id } })
              }}
            />
          )}
          ListEmptyComponent={<Text style={cs.empty}>No other {typeName} runs</Text>}
        />
        <TouchableOpacity
          style={cs.allRow}
          activeOpacity={0.7}
          onPress={() => {
            onClose()
            router.navigate({ pathname: '/runs', params: { select: run.id } })
          }}
        >
          <Text style={cs.allText}>Choose from all runs</Text>
          <Text style={cs.allChevron}>›</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}
```

Note: `/runs` is the URL of `app/(tabs)/runs.tsx` (route groups like `(tabs)` are not part of the URL). `router.navigate` pops back to the existing tabs screen instead of pushing a new one.

- [ ] **Step 3: Wire it into `RunDetail`**

In `RunDetail`, add state as the first line after `const insets = useSafeAreaInsets()`:

```tsx
  const [sheetOpen, setSheetOpen] = useState(false)
```

Then replace the floating back button block at the end of the JSX:

```tsx
      {/* floating back button — pinned top-left, always visible */}
      <TouchableOpacity onPress={() => router.back()} style={[s.backFab, { top: insets.top + 12 }]} activeOpacity={0.7}>
        <Text style={s.backFabIcon}>‹</Text>
      </TouchableOpacity>
    </SafeAreaView>
```

with:

```tsx
      {/* floating back button — pinned top-left, always visible */}
      <TouchableOpacity onPress={() => router.back()} style={[s.backFab, { top: insets.top + 12 }]} activeOpacity={0.7}>
        <Text style={s.backFabIcon}>‹</Text>
      </TouchableOpacity>

      {/* floating compare button — pinned top-right, mirrors the back button */}
      <TouchableOpacity
        onPress={() => setSheetOpen(true)}
        style={[s.backFab, s.compareFab, { top: insets.top + 12 }]}
        activeOpacity={0.7}
      >
        <Image source={require('../../assets/compare.png')} style={s.compareFabIcon} />
      </TouchableOpacity>

      <CompareSheet run={run} visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </SafeAreaView>
```

Note: hooks must run before the early `if (!run) return`; `useState` goes right after `useSafeAreaInsets()`, which is above that early return.

- [ ] **Step 4: Add styles**

Inside the `s` StyleSheet, after `backFabIcon: {...},` add:

```tsx
  compareFab:     { left: undefined, right: spacing.screenH },
  compareFabIcon: { width: 20, height: 20, tintColor: colors.textPrimary },
```

After the `mp` StyleSheet at the end of the file, add:

```tsx
const cs = StyleSheet.create({
  sheet:  { flex: 1, backgroundColor: colors.bgApp },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH,
    paddingVertical: 16,
  },
  title: { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  close: { fontFamily: fonts.body, fontSize: 18, color: colors.textSecondary },
  list:  { paddingHorizontal: spacing.screenH, paddingBottom: 16 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.screenH,
    marginBottom: 32,
    padding: 14,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
  },
  allText:    { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  allChevron: { fontFamily: fonts.body, fontSize: 18, color: colors.textGhost },
})
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Manual (Expo Go):
1. Run Detail shows a compare button top-right, same style as the back button.
2. Tap → sheet lists only runs of the same type, newest first, current run excluded.
3. Tap a run → sheet closes, comparison opens with current run as A. Back → Run Detail.
4. ✕ or swipe down → sheet closes, stay on Run Detail.
5. "Choose from all runs ›" → Runs tab in selection mode with this run checked. Check one more → bar appears.
6. With an existing selection on the Runs tab, use "Choose from all runs ›" from another run → only the new run is checked.
7. If navigating while the sheet is still animating closed causes a glitch on device, move the navigation into the `Modal`'s `onDismiss` callback instead (iOS-only prop, fires after the close animation).

- [ ] **Step 6: Commit checkpoint**

Tell Bar: ready to commit `app/run/[id].tsx`.

---

### Task 7: Docs

**Files:**
- Modify: `FRONTEND_SPEC.md` (§5 Compare, lines ~353–369)
- Modify: `architecture.md` (File Structure block)

- [ ] **Step 1: Replace `FRONTEND_SPEC.md` §5**

Replace everything from `### 5. Compare` up to (not including) the `---` before `### 6. Settings` with:

```markdown
### 5. Compare

Full design: `docs/superpowers/specs/2026-11-01-compare-runs-design.md`.

**Entry points**
- **Runs tab**: compare icon (right of type chips) toggles selection mode; rows show check circles; max 2 (3rd tap → alert "You can compare only 2 runs. Uncheck one first."). With 2 checked, a bottom bar shows "<date> vs <date>", "Compare ›", and ✕ (clears selection, exits mode). Selection persists until ✕ or icon re-tap.
- **Run Detail**: compare button top-right (mirrors back button) → page sheet listing other runs of the same type; tap one → comparison. "Choose from all runs ›" → Runs tab in selection mode with this run checked.
- **Compare tab**: title "Compare runs" — 17 px / 700. Two slot cards (Run A, Run B); tap → page sheet with the run list; the other slot's run is greyed out. "Compare" button (accentBg, disabled at 35% opacity until both filled).

**Comparison screen** (`/compare/result?a=&b=`)
- Floating back button; two run header cards (type bar, A/B label, type name, date) — tap opens Run Detail.
- Row: "Highlight better results" + native iOS Switch, off by default, not persisted.
- Table: border `border-default`, radius 10, overflow hidden. Header (bg `bg-elevated`, 11 px, `text-dim`): Metric · A · B, columns `1fr 0.8fr 0.8fr`, A/B right-aligned. Values JetBrains Mono 13 px; missing → "—".
- Rows (10): Distance · Time · Avg Pace · Avg HR · Max HR · Elevation · Cadence · Calories · Primary Zone · Weather.
- **Highlighting** (toggle on): per row only, the better value gets `accent` + weight 700. Higher is better: Distance, Elevation, Cadence. Lower: Time, Pace, Avg HR, Max HR. Never: Calories, Primary Zone, Weather. Ties and missing values never highlight. No overall winner. Rule lives in `src/utils/compare.ts`.
```

- [ ] **Step 2: Update `architecture.md` file tree**

In the File Structure block, replace:

```
  run/
    [id].tsx                   ← Run Detail screen
```

with:

```
  run/
    [id].tsx                   ← Run Detail screen (+ compare sheet)
  compare/
    result.tsx                 ← Comparison screen (?a=<runId>&b=<runId>)
```

and replace:

```
  components/                  ← RunCard, FilterBar, TypeChip, MetricCard, Chart, TypePicker, Drawer
```

with:

```
  components/                  ← RunPickerList (shared run list + type chips), Chart, SplitsTable, SegmentsTable
```

and replace:

```
  utils/                       ← format.ts, chart.ts, filters.ts, stats.ts
```

with:

```
  utils/                       ← format.ts, chart.ts, stats.ts, zones.ts, compare.ts (metrics + per-row "better" rule)
```

- [ ] **Step 3: Commit checkpoint**

Tell Bar: ready to commit `FRONTEND_SPEC.md`, `architecture.md`, plus the spec and plan docs (`docs/superpowers/specs/2026-11-01-compare-runs-design.md`, `docs/superpowers/plans/2026-11-01-compare-runs.md`).
