# Runs Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Runs screen with a month-grouped list, sticky type filter chips, and per-month stats showing both overall and filtered totals.

**Architecture:** Single file (`app/(tabs)/runs.tsx`). A pure `buildSections` function prepares `SectionList` data from `MOCK_RUNS`. Three sub-components (`TypeFilterBar`, `MonthHeader`, `RunRow`) keep the render tree readable. No new files, no new dependencies.

**Tech Stack:** React Native `SectionList`, `ScrollView`, `TouchableOpacity`, expo-router, existing tokens/format utils.

## Global Constraints

- Colors from `src/utils/tokens.ts` — never hardcode hex in the component file.
- Fonts: `fonts.body` (Inter) for labels, `fonts.mono` (JetBrainsMono) for numeric values.
- All distance/pace respects `unit` constant (`'km'` for now, same as other screens).
- Never write to MOCK_RUNS or MOCK_RUN_TYPES — read-only.
- No new npm packages.
- CLAUDE.md: never run git commands — Bar handles all git operations.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/(tabs)/runs.tsx` | Rewrite | Entire Runs screen |

---

### Task 1: Data Layer — `buildSections`

**Files:**
- Modify: `app/(tabs)/runs.tsx`

**Interfaces:**
- Produces:
  ```ts
  type RunSection = {
    key: string           // 'YYYY-MM'
    title: string         // 'SEPTEMBER 2026'
    allStats: { runCount: number; totalDistanceKm: number; totalTimeSec: number }
    filteredStats: { runCount: number; totalDistanceKm: number; totalTimeSec: number } | null
    data: Run[]           // filtered runs for this month
  }

  function buildSections(runs: Run[], selectedTypeId: string | null): RunSection[]
  ```

- [ ] **Step 1: Add imports and write `buildSections` at the top of `runs.tsx`**

Replace the entire file with this starting skeleton:

```tsx
import { SectionList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../../src/mockData'
import type { Run, RunType } from '../../src/types'
import { fmtDate, fmtDistance, fmtDuration } from '../../src/utils/format'
import { colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'

const UNIT: 'km' | 'mi' = 'km'
const TYPE_MAP = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

type MonthStats = { runCount: number; totalDistanceKm: number; totalTimeSec: number }

type RunSection = {
  key: string
  title: string
  allStats: MonthStats
  filteredStats: MonthStats | null
  data: Run[]
}

function computeStats(runs: Run[]): MonthStats {
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

export default function Runs() {
  return null // placeholder — filled in Task 4
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
})
```

- [ ] **Step 2: Verify it compiles**

Open Expo Go and navigate to the Runs tab. Screen should be blank (returns null) with no red error box. If there's a TypeScript error, fix it before continuing.

---

### Task 2: `RunRow` Component

**Files:**
- Modify: `app/(tabs)/runs.tsx`

**Interfaces:**
- Consumes: `Run`, `RunType | undefined`, `useRouter`
- Produces: `<RunRow run={run} />` — tappable card navigating to `/run/[id]`

- [ ] **Step 1: Add `RunRow` above the `Runs` export**

```tsx
function RunRow({ run }: { run: Run }) {
  const router = useRouter()
  const type = run.typeId ? TYPE_MAP[run.typeId] : undefined
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost

  return (
    <TouchableOpacity style={rr.card} onPress={() => router.push(`/run/${run.id}`)}>
      <View style={[rr.bar, { backgroundColor: typeColor }]} />
      <View style={rr.center}>
        <Text style={rr.typeName}>{type?.name ?? 'Unclassified'}</Text>
        <Text style={rr.date}>{fmtDate(run.date)}</Text>
        <Text style={rr.meta}>
          {fmtDistance(run.distanceKm, UNIT)} · {fmtDuration(run.timeSec)}
        </Text>
      </View>
      <Text style={rr.chevron}>›</Text>
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
  bar:      { width: 8, height: 36, borderRadius: 4 },
  center:   { flex: 1, gap: 2 },
  typeName: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  date:     { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  meta:     { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  chevron:  { fontFamily: fonts.body, fontSize: 18, color: colors.textGhost },
})
```

- [ ] **Step 2: Smoke-test by temporarily rendering one row**

Inside the `Runs` export, temporarily replace `return null` with:

```tsx
return (
  <SafeAreaView style={s.safe} edges={['top']}>
    <RunRow run={MOCK_RUNS[0]} />
  </SafeAreaView>
)
```

Check Expo Go: should see a single run card with type-color bar, name, date, distance, chevron.

- [ ] **Step 3: Revert to `return null`** — put placeholder back before Task 3.

---

### Task 3: `MonthHeader` Component

**Files:**
- Modify: `app/(tabs)/runs.tsx`

**Interfaces:**
- Consumes: `RunSection` (key, title, allStats, filteredStats)
- Produces: `<MonthHeader section={section} selectedTypeId={string|null} />`

- [ ] **Step 1: Add `fmtStats` helper and `MonthHeader` above the `Runs` export**

```tsx
function fmtStats(stats: MonthStats): string {
  const dist = fmtDistance(stats.totalDistanceKm, UNIT)
  const time = fmtDuration(stats.totalTimeSec)
  return `${stats.runCount} runs · ${dist} · ${time}`
}

function MonthHeader({ section, selectedTypeId }: { section: RunSection; selectedTypeId: string | null }) {
  const filteredType = selectedTypeId ? TYPE_MAP[selectedTypeId] : null
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
```

- [ ] **Step 2: Smoke-test by temporarily rendering one header**

Replace `return null` temporarily:

```tsx
const testSection = buildSections(MOCK_RUNS, null)[0]
return (
  <SafeAreaView style={s.safe} edges={['top']}>
    <MonthHeader section={testSection} selectedTypeId={null} />
  </SafeAreaView>
)
```

Check Expo Go: should see month title + "All runs N runs · X km · Xh Xm". No filtered row.

- [ ] **Step 3: Test with a filter active**

Change `buildSections(MOCK_RUNS, null)` to `buildSections(MOCK_RUNS, 'easy')` and verify a second row appears with the green dot + "Easy Run" + its stats.

- [ ] **Step 4: Revert to `return null`**.

---

### Task 4: `TypeFilterBar` + Wire Full Screen

**Files:**
- Modify: `app/(tabs)/runs.tsx`

**Interfaces:**
- Consumes: `MOCK_RUN_TYPES`, `selectedTypeId`, `setSelectedTypeId`
- Produces: Complete `Runs` screen

- [ ] **Step 1: Add `TypeFilterBar` component**

```tsx
function TypeFilterBar({
  selectedTypeId,
  onSelect,
}: {
  selectedTypeId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <View style={tf.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tf.row}>
        {/* All chip */}
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
    </View>
  )
}

const tf = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
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
```

- [ ] **Step 2: Wire the full `Runs` screen**

Replace the `Runs` export and `s` StyleSheet with:

```tsx
export default function Runs() {
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const sections = buildSections(MOCK_RUNS, selectedTypeId)

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <TypeFilterBar selectedTypeId={selectedTypeId} onSelect={setSelectedTypeId} />
      <SectionList
        sections={sections}
        keyExtractor={run => run.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <MonthHeader section={section} selectedTypeId={selectedTypeId} />
        )}
        renderItem={({ item }) => (
          <View style={s.itemWrap}>
            <RunRow run={item} />
          </View>
        )}
        SectionSeparatorComponent={() => <View style={s.sectionGap} />}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>No runs match this filter.</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bgApp },
  listContent: { paddingBottom: 32 },
  itemWrap:    { paddingHorizontal: spacing.screenH, paddingTop: 10, gap: 10 },
  sectionGap:  { height: 10 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText:   { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
})
```

- [ ] **Step 3: Full verification in Expo Go**

Check each of the following:
1. **Default view** — runs grouped by month, newest month first, "All runs N runs · X km · Xh Xm" in each header.
2. **Filter by a type** — tap e.g. "Easy Run". Only easy runs appear under each month. Each month header shows "All runs" row (unchanged) + "Easy Run" row below it. Months with zero matching runs disappear.
3. **Deselect filter** — tap "Easy Run" again or tap "All". All runs return.
4. **Tap a run row** — navigates to the Run Detail screen for that run.
5. **Sticky headers** — scroll down; month header sticks at the top as you scroll through its runs.
6. **No red error boxes** at any point.

- [ ] **Step 4: Tell Bar the files are ready to commit**

List what changed:
- `app/(tabs)/runs.tsx` — full implementation
