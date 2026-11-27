# RA-22 Zones Summary — Design

Date: 2026-11-27 · Branch `feature/month-zones` · Jira RA-22 (parent RA-1 Zones and HR)

Mockups (gitignored): `.superpowers/brainstorm/1651-1795798211/content/` — `card-design.html` (option C chosen), `placement.html` (option 2 chosen), `month-header.html` (option A chosen).

## Goal

Show how running time was spread over the HR zones:

1. **Dashboard** — a "Time in zones" section inside the existing **Last 30 days** card.
2. **All runs** — each month header shows the month's top 2 zones.

Facts only: no targets, no good/bad judgement.

## Decisions (with Bar, 2026-11-27)

- **Period on the Dashboard = last 30 days**, the same window as the Last 30 days card (`getPeriodStats`), not the calendar month the ticket first said. Never near-empty at the start of a month. The All runs headers stay calendar months.
- **Inside the lime Last 30 days card**, below the stat grid. No comparison with the previous 30 days.
- **Design C:** one row per zone: zone number, bar, %. No zone names, no times.
- **Own run-type pill** on the section's header row (`All types` default, `Unclassified`, each type). It filters the zones only; the card's other stats always cover all runs.
- **Month header option A:** a new right-aligned line under the stats (and under the filtered-type line when a filter is on): `● Z2 64% · ● Z3 22%`.
- **% = share of total time in zones** (seconds summed over runs), so longer runs count more. Runs with no HR histogram are left out.
- **Second zone shown only when it rounds to ≥ 1%.** A month that is all Z2 shows `Z2 100%`.

## Logic

### `src/utils/zones.ts` (pure, self-checked in `zones.check.ts`)

```ts
/** Zone seconds summed over runs. null when no run has any HR time. */
export function sumZoneTimes(hists: (HrHist | null)[], s: Starts): ZoneSeconds | null

/** Rounded % per zone of total time in zones. */
export function zonePcts(z: ZoneSeconds): ZoneSeconds   // 5 numbers, may not sum to exactly 100

/** Up to 2 zones by time, biggest first, leaving out any that round to 0%. */
export function topZones(z: ZoneSeconds): { zone: number; pct: number }[]   // zone = 1..5
```

`sumZoneTimes` reuses `zoneTimes` per run. It takes histograms rather than `Run`s so `zones.ts` stays free of app types.

Self-check cases: the sum over 2 runs equals the per-zone sums; a `null` histogram is skipped; all `null` / all-zero → `null`; `zonePcts` rounding; `topZones` with a single 100% zone returns one entry; ties keep the lower zone first.

### `src/utils/stats.ts`

The "current 30 days" filter inside `getPeriodStats` is moved into an exported `inLast30Days(runs, today): Run[]`, and `getPeriodStats` calls it. A refactor only: card numbers don't change.

## UI

### Dashboard — `ThirtyDayCard` (`app/(tabs)/dashboard.tsx`)

Below the stat grid:

- `limeDivider`
- Row: eyebrow `TIME IN ZONES` (same style as `LAST 30 DAYS`), then on the right a pill with ink border/text: `<typeLabel> ▾` → `pickType(setZoneType)`.
- 5 rows: zone number (mono, ink), a track (`rgba(29,23,44,0.10)`) with a fill in `zoneColor(i)` at width `pct%`, then `pct%` (mono, ink).
- No HR time for the window + filter → one line instead of the bars, in ink: **"No heart-rate data in the last 30 days"**.

Data: `inLast30Days(runs, TODAY)` → filter by the pill (same matching as All runs: `null` = all, `UNCLASSIFIED` = `typeId === null`, else `typeId`) → `sumZoneTimes(runs.map(r => r.hrHist), useZoneStarts())` → `zonePcts`.

Pill state is `useState` in the card (resets on app restart).

To share the filter matching, `matchesType` in `RunPickerList.tsx` is exported.

### All runs — `MonthHeader` (`src/components/RunPickerList.tsx`)

- `RunSection` gets `zoneHists: (HrHist | null)[]`, filled in `buildSections` from the **filtered** runs of the month (all runs when no filter).
- `MonthHeader` calls `useZoneStarts()` → `sumZoneTimes` → `topZones`. When the list is non-empty it shows a new right-aligned row (`filteredRow` layout): for each zone a dot in `zoneColor`, then `Z<n> <pct>%` (mono 10, `textSecondary`), joined by ` · `.
- No HR in the month → no zone row.
- The Compare run picker uses the same `MonthHeader`, so it shows the zone line too (accepted: same component, same facts).

## Behaviour notes

- Changing the zone method (RA-9) updates both spots immediately: everything is computed from `hrHist` + `useZoneStarts()`.
- No schema change, no migration, no new dev build (JS only).
- Search / sub-filters (RA-35 / RA-17) will feed `buildSections` later; the header follows automatically because it uses the section's filtered runs.

## Testing

- `node src/utils/zones.check.ts` (new cases above).
- `npx tsc --noEmit`.
- Device (Bar): Dashboard section matches a hand check of 1–2 runs' Heart Rate screens; pill filters only the zones; a type with no HR runs shows the empty line; All runs headers show top zones and follow the type filter; changing the zone method updates both.

## Docs

- `FRONTEND_SPEC.md` — Dashboard Last 30 days card: Time in zones section; All runs month header: zone line.
- `docs/HANDOFF.md` — RA-22 status.
- Jira RA-22 — reword "current calendar month" → "last 30 days, inside the Last 30 days card", plus the empty-state text (draft shown to Bar first).
