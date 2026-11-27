# RA-22 Zones Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show time-in-zones for the last 30 days inside the Dashboard's Last 30 days card, and the top 2 zones in each All runs month header.

**Architecture:** Three pure helpers in `src/utils/zones.ts` (sum zone seconds over runs → % → top 2), self-checked in `zones.check.ts`. The 30-day filter inside `getPeriodStats` is exported as `inLast30Days` so the card's stats and its zones use the same runs. UI only reads these helpers; everything is computed live from `run.hrHist` + `useZoneStarts()`.

**Tech Stack:** Expo / React Native, TypeScript, Zustand stores. Self-checks run with plain `node` (type-stripping).

Spec: `docs/superpowers/specs/2026-11-27-month-zones-design.md`.

**Rules for implementers:** never run git (Bar commits). No new dependencies. No DB / schema change. Branch is `feature/month-zones`.

---

## File map

| File | Change |
|---|---|
| `src/utils/zones.ts` | add `sumZoneTimes`, `zonePcts`, `topZones` |
| `src/utils/zones.check.ts` | add cases for the three helpers |
| `src/utils/stats.ts` | export `inLast30Days`, used by `getPeriodStats` |
| `src/components/RunPickerList.tsx` | export `matchesType`; `RunSection.zoneHists`; zone line in `MonthHeader` |
| `app/(tabs)/dashboard.tsx` | Time in zones section in `ThirtyDayCard` |
| `FRONTEND_SPEC.md`, `docs/HANDOFF.md` | docs |

---

### Task 1: Zone summary helpers (pure, TDD)

**Files:**
- Modify: `src/utils/zones.ts` (append after `zoneTimes`)
- Test: `src/utils/zones.check.ts`

- [ ] **Step 1: Write the failing checks**

In `src/utils/zones.check.ts`, extend the import on line 3:

```ts
import { computePrimaryZone, methodStarts, sumZoneTimes, topZones, validStarts, zonePcts, zoneRangeLabel, zoneStarts, zoneTimes } from './zones.ts'
```

Insert before `console.log('zones.check OK')`:

```ts
// RA-22: summaries over many runs (s = [111, 130, 148, 167])
eq(sumZoneTimes([{ '100': 60, '140': 30 }, null, { '140': 10, '170': 20 }], s), [60, 0, 40, 0, 20],
  'sums zone seconds over runs; a run without HR is skipped')
eq(sumZoneTimes([null, null], s), null, 'no run has HR → null')
eq(sumZoneTimes([{}, null], s), null, 'only empty histograms → null')
eq(sumZoneTimes([], s), null, 'no runs → null')

eq(zonePcts([60, 0, 40, 0, 20]), [50, 0, 33, 0, 17], 'rounded % of total time in zones')
eq(zonePcts([0, 0, 0, 0, 0]), [0, 0, 0, 0, 0], 'all zero → all 0%, no NaN')

eq(topZones([60, 0, 40, 0, 20]), [{ zone: 1, pct: 50 }, { zone: 3, pct: 33 }], 'top 2 by time, biggest first')
eq(topZones([0, 300, 0, 0, 0]), [{ zone: 2, pct: 100 }], 'single zone → one entry, no "0%" second')
eq(topZones([0, 995, 4, 0, 0]), [{ zone: 2, pct: 100 }], 'second zone rounding to 0% is left out')
eq(topZones([0, 50, 50, 0, 0]), [{ zone: 2, pct: 50 }, { zone: 3, pct: 50 }], 'tie → lower zone first')
eq(topZones([0, 0, 0, 0, 0]), [], 'no time → nothing')
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/utils/zones.check.ts`
Expected: FAIL — `SyntaxError: The requested module './zones.ts' does not provide an export named 'sumZoneTimes'`.

- [ ] **Step 3: Implement**

Append to `src/utils/zones.ts` right after `zoneTimes`:

```ts
/** RA-22: zone seconds summed over runs. null when no run has any HR time. */
export function sumZoneTimes(hists: readonly (HrHist | null)[], s: Starts): ZoneSeconds | null {
  const z: ZoneSeconds = [0, 0, 0, 0, 0]
  for (const h of hists) zoneTimes(h, s)?.forEach((sec, i) => { z[i] += sec })
  return z.some(v => v > 0) ? z : null
}

/** Rounded % per zone of total time in zones (may not add up to exactly 100). */
export function zonePcts(z: ZoneSeconds): ZoneSeconds {
  const total = z.reduce((a, b) => a + b, 0)
  return z.map(v => (total > 0 ? Math.round((v / total) * 100) : 0)) as ZoneSeconds
}

/** Up to 2 zones by time, biggest first (tie → lower zone), leaving out any that round to 0%. zone = 1..5 */
export function topZones(z: ZoneSeconds): { zone: number; pct: number }[] {
  const p = zonePcts(z)
  return [0, 1, 2, 3, 4]
    .sort((a, b) => z[b] - z[a] || a - b)
    .filter(i => p[i] >= 1)
    .slice(0, 2)
    .map(i => ({ zone: i + 1, pct: p[i] }))
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node src/utils/zones.check.ts`
Expected: `zones.check OK`

---

### Task 2: `inLast30Days` (refactor, no behaviour change)

**Files:**
- Modify: `src/utils/stats.ts:56-75`

- [ ] **Step 1: Replace `getPeriodStats` with the exported filter + caller**

```ts
const DAY = 86400_000
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
const runDay = (r: Run) => { const [y, m, d] = r.date.split('-').map(Number); return new Date(y, m - 1, d).getTime() }

/** Runs from the last 30 days, today included (same window as the Dashboard's Last 30 days card). */
export function inLast30Days(runs: Run[], today: Date): Run[] {
  const t = dayStart(today)
  return runs.filter(r => { const d = runDay(r); return d >= t - 29 * DAY && d <= t })
}

export function getPeriodStats(
  runs: Run[],
  today: Date,
): { current: PeriodStats; previous: PeriodStats } {
  const t = dayStart(today)
  const previous = runs.filter(r => { const d = runDay(r); return d >= t - 59 * DAY && d < t - 29 * DAY })
  return { current: aggregatePeriod(inLast30Days(runs, today)), previous: aggregatePeriod(previous) }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 3: Top zones in the All runs month header

**Files:**
- Modify: `src/components/RunPickerList.tsx`

- [ ] **Step 1: Imports**

Change line 1 to `import { Fragment, useState } from 'react'`. Add:

```ts
import { useZoneStarts } from '../store/useProfileStore'
import { sumZoneTimes, topZones, type HrHist } from '../utils/zones'
```

and add `zoneColor` to the existing `../utils/tokens` import.

- [ ] **Step 2: Export `matchesType`**

Line 27: `const matchesType = …` → `export const matchesType = …` (the Dashboard reuses it in Task 4).

- [ ] **Step 3: Section carries the filtered runs' histograms**

In `RunSection` add the field:

```ts
  /** RA-22: HR histograms of the runs shown (after the type filter) → header zone line */
  zoneHists: (HrHist | null)[]
```

In `buildSections`, in the `sections.push({ … })` object, add:

```ts
      zoneHists: filteredRuns.map(r => r.hrHist),
```

- [ ] **Step 4: Zone line in `MonthHeader`**

At the top of `MonthHeader`, after `const typeMap = useTypeMap()`:

```ts
  const starts = useZoneStarts()
  const zsec = sumZoneTimes(section.zoneHists, starts)
  const top = zsec ? topZones(zsec) : []
```

Inside the outer `<View style={s.monthHeader}>`, after the filtered-type block (last child):

```tsx
      {top.length > 0 && (
        <View style={s.filteredRow}>
          {top.map((z, k) => (
            <Fragment key={z.zone}>
              {k > 0 && <Text style={s.monthStats}>·</Text>}
              <View style={[s.dot, { backgroundColor: zoneColor(z.zone - 1) }]} />
              <Text style={s.monthStats}>Z{z.zone} {z.pct}%</Text>
            </Fragment>
          ))}
        </View>
      )}
```

(`filteredRow`, `dot` and `monthStats` styles already exist: right-aligned row, 8 px dot, mono 10 `textSecondary`.)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `Run.hrHist`'s type isn't `HrHist | null`, check `src/types.ts` and match it — don't cast.

---

### Task 4: Time in zones inside the Last 30 days card

**Files:**
- Modify: `app/(tabs)/dashboard.tsx`

- [ ] **Step 1: Imports**

```ts
import { useState } from 'react'
import { matchesType, pickRunType, pickType, typeLabel } from '../../src/components/RunPickerList'
import { useZoneStarts } from '../../src/store/useProfileStore'
import { getPeriodStats, inLast30Days } from '../../src/utils/stats'
import { colors, fonts, spacing, buttons, zoneColor } from '../../src/utils/tokens'
import { sumZoneTimes, zonePcts } from '../../src/utils/zones'
```

(Replace the existing `RunPickerList`, `stats` and `tokens` import lines; `pickRunType` is still used by `NewRunCard`.)

- [ ] **Step 2: Data in `ThirtyDayCard`**

After `const runs = useRunStore(s => s.runs)`:

```ts
  const [zoneType, setZoneType] = useState<string | null>(null)  // null = All types; resets on app restart
  const starts = useZoneStarts()
  const zoneRuns = inLast30Days(runs, TODAY).filter(r => !zoneType || matchesType(r, zoneType))
  const zoneSec = sumZoneTimes(zoneRuns.map(r => r.hrHist), starts)
```

- [ ] **Step 3: JSX**

After the `<View style={s.grid}>…</View>` block, before the card's closing `</View>`:

```tsx
      <View style={s.limeDivider} />
      <View style={s.zonesHead}>
        <Text style={s.limeEyebrow}>TIME IN ZONES</Text>
        <TouchableOpacity style={s.inkPill} onPress={() => pickType(setZoneType)}>
          <Text style={s.inkPillText}>{typeLabel(zoneType)} ▾</Text>
        </TouchableOpacity>
      </View>
      {zoneSec ? (
        <View style={s.zoneRows}>
          {zonePcts(zoneSec).map((pct, i) => (
            <View key={i} style={s.zoneRow}>
              <Text style={s.zoneNum}>{i + 1}</Text>
              <View style={s.zoneTrack}>
                {pct > 0 && <View style={[s.zoneFill, { width: `${pct}%`, backgroundColor: zoneColor(i) }]} />}
              </View>
              <Text style={s.zonePct}>{pct}%</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.zonesEmpty}>No heart-rate data in the last 30 days</Text>
      )}
```

- [ ] **Step 4: Styles**

In the `// 30-day card (lime)` group of `StyleSheet.create`, add:

```ts
  zonesHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  inkPill:     { borderWidth: 1, borderColor: colors.ink, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 4 },
  inkPillText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.ink },
  zoneRows:    { gap: 6 },
  zoneRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneNum:     { width: 12, fontFamily: fonts.mono, fontSize: 13, fontWeight: '700', color: colors.ink },
  zoneTrack:   { flex: 1, height: 14, borderRadius: 5, backgroundColor: 'rgba(29,23,44,0.10)', overflow: 'hidden' },
  zoneFill:    { height: 14, borderRadius: 5 },
  zonePct:     { width: 36, textAlign: 'right', fontFamily: fonts.mono, fontSize: 11, fontWeight: '600', color: colors.ink },
  zonesEmpty:  { fontFamily: fonts.body, fontSize: 12, color: colors.ink, opacity: 0.7 },
```

- [ ] **Step 5: Type-check + all self-checks**

Run: `npx tsc --noEmit` → no errors.
Run: `node src/utils/zones.check.ts` → `zones.check OK`.
Run: `npx tsx src/utils/compare.check.ts` → passes (uses `stats.ts`).

---

### Task 5: Docs

**Files:**
- Modify: `FRONTEND_SPEC.md` (section 2 Dashboard, section 3 Runs)
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: `FRONTEND_SPEC.md`**

After `#### 2c. Recent Runs` block (before the `---` that ends section 2), add:

```md
#### 2d. Last 30 days card — Time in zones (RA-22)
Below the stat grid, after a `limeDivider`: eyebrow "TIME IN ZONES" (as "LAST 30 DAYS") with an ink outline pill on the right (`<type> ▾`, `pickType`: All types / Unclassified / types; filters the zones only, resets on app restart). Then 5 rows, gap 6: zone number (mono 13 / 700, ink) · track 14 px, radius 5, `rgba(29,23,44,0.10)`, fill `zoneColor(i)` at the zone's % · "54%" (mono 11 / 600, ink, right, 36 px). % = share of total time in zones over runs from the last 30 days (`inLast30Days`). No HR → "No heart-rate data in the last 30 days" (12, ink 70%). No comparison with the previous 30 days.
```

In section 3, after the RunCard paragraph, add:

```md
**Month header zone line (RA-22):** right-aligned row under the stats (and under the filtered-type row): `● Z2 64% · ● Z3 22%` — 8 px dot in `zoneColor`, mono 10 `textSecondary`. Top 2 zones by time of the runs shown (follows the type filter); second zone only when it rounds to ≥ 1%; no HR in the month → no row. Same header in the Compare run picker.
```

- [ ] **Step 2: `docs/HANDOFF.md`**

Replace the `### Later: RA-22 Per Month Zones Summary …` section with a short `## Current task: RA-22 Zones Summary — feature/month-zones` section: spec + plan paths, decisions (last 30 days inside the lime card, design C, own pill, header option A, ≥ 1% rule), state (implemented / checks pass / not device-tested), Bar to do (JS only: `npx expo start --dev-client`, device test = Task 6), Jira RA-22 wording waiting for approval.

---

### Task 6: Device test (Bar)

JS only, no migration, no rebuild: `npx expo start --dev-client`.

- [ ] Dashboard → Last 30 days card shows Time in zones; % look right against 1–2 runs' Heart Rate screens.
- [ ] Pill → pick a type: only the zone bars change, the stats above don't.
- [ ] Pick a type with no HR runs in 30 days → "No heart-rate data in the last 30 days".
- [ ] All runs: each month header shows "● Zx nn% · ● Zy nn%"; changing the type filter changes it.
- [ ] Settings → change the zone method → both spots update.

---

## Commits (Bar runs them after review)

1. `src/utils/zones.ts`, `src/utils/zones.check.ts`, `src/utils/stats.ts` — logic
2. `src/components/RunPickerList.tsx`, `app/(tabs)/dashboard.tsx` — screens
3. spec, plan, `FRONTEND_SPEC.md`, `docs/HANDOFF.md` — docs
