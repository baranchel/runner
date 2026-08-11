# Dashboard — Summary Card Design

**Date:** 2026-08-11
**Scope:** Summary card component only. Type filter chips and run list are out of scope for this iteration.

---

## Purpose

The summary card is the first thing the user sees after login. It answers: "How am I doing lately?" — at a glance, without any interaction.

---

## Data Window

- **Period:** rolling last 30 days (today − 30d inclusive)
- **Comparison:** previous 30 days (today − 60d to today − 31d)
- Always reflects **all runs** — not filtered by type

---

## Layout

One card (`bg-surface`, border `border-default`, border-radius 10, padding 14).

### Header row
```
Last 30 days                    vs prev 30 days
(12px, text-dim, uppercase)     (11px, text-faint, right-aligned)
```

### Stat columns — 3 equal columns

Each column is a vertical stack. Distance and Time each have a total (top) and average (bottom) with the label between them. The third column pairs run count and avg pace, which have no twin metric.

```
┌──────────────────────────────────────────┐
│  Last 30 days                vs prev 30d │
│                                          │
│   47.5 km   │   6h 12m   │   12  [🔢]  │
│   [↑] +8%   │   [↑] +12% │   [↑] +3    │
│  DISTANCE   │    TIME    │  ──────────  │
│   6.5 km    │   31 min   │  5:15 [⚡]  │
│   [─] same  │   [↑] +2m  │  [↑] faster │
└──────────────────────────────────────────┘
```

**Column 1 — Distance**
- Top: total distance (e.g. `47.5 km`), JetBrains Mono 20px/700
- Delta: icon + value (see Delta section below)
- Label: `DISTANCE` — 10px, `text-dim`, uppercase, centered
- Bottom: avg distance per run (e.g. `6.5 km`), JetBrains Mono 16px/600
- Delta: icon + value

**Column 2 — Time**
- Top: total time formatted as `6h 12m` or `38m` if under 1h, JetBrains Mono 20px/700
- Delta
- Label: `TIME` — same style as above
- Bottom: avg time per run (e.g. `31 min`), JetBrains Mono 16px/600
- Delta

**Column 3 — Runs / Pace**
- Top: run count (e.g. `12`) + `counter.png` icon (14×14, `text-secondary`, inline right of number), JetBrains Mono 20px/700
- Delta
- Horizontal rule: 1px `border-subtle`, 8px vertical margin
- Bottom: avg pace (e.g. `5:15`) + `pace.png` icon (14×14, `text-secondary`, inline right), JetBrains Mono 16px/600
- Delta (pace: faster = positive)

---

## Delta Indicators

Each stat has a delta line: icon + formatted change, 11px.

| Condition | Icon asset | Color |
|---|---|---|
| Improved (more distance/time/runs, or faster pace) | `up-arrow.png` | `elev-line` green (`#3bac68`) |
| Worse (less distance/time/runs, or slower pace) | `down-arrow.png` | `danger` red (`#d74f49`) |
| Flat (< 2% change, or 0 runs delta) | `straight-arrow.png` | `text-faint` (`#7d7d8f`) |

**Pace inversion — critical rule:** pace is stored as sec/km. A *lower* number = faster = better.
- Pace went down (e.g. 5:30 → 5:15) → runner got **faster** → `up-arrow.png` in green
- Pace went up (e.g. 5:15 → 5:30) → runner got **slower** → `down-arrow.png` in red

**Delta formatting:**
- Distance / time: show absolute delta (`+8.2 km`, `+1h 04m`)
- Runs: show absolute delta (`+3`, `−1`)
- Pace: show formatted delta (`+0:12/km` slower, `−0:08/km` faster) — but display direction inverted as above
- Flat threshold: < 2% change → straight arrow, no value shown (just icon)

**Zero previous period:** if prev 30d has 0 runs, skip deltas entirely — show nothing in the delta row (no divide-by-zero, no "N/A" clutter).

---

## Computed Values

All computed from `MOCK_RUNS` (and later from the HealthKit/SQLite store).

```ts
// Current period: runs where date >= today-30d
// Previous period: runs where today-60d <= date < today-30d

totalDistanceKm    = sum(run.distanceKm)
totalTimeSec       = sum(run.timeSec)
runCount           = runs.length
avgDistanceKm      = totalDistanceKm / runCount   (0 if runCount = 0)
avgTimeSec         = totalTimeSec / runCount
avgPaceSecPerKm    = totalTimeSec / totalDistanceKm  (0 if totalDistanceKm = 0)
```

Display respects `user.unit` from `useUserStore`:
- km mode: distances in km (1 decimal), pace as `m:ss/km`
- mi mode: distances × 0.621371 (1 decimal), pace × 1.60934

---

## Edge Cases

- **No runs in current period:** show all values as `─` or `0`, no deltas
- **No runs in previous period:** show current stats, no delta row
- **Unit toggle:** values update immediately (derived display, no refetch)

---

## Assets Used

| Asset | Usage |
|---|---|
| `assets/up-arrow.png` | Positive delta |
| `assets/down-arrow.png` | Negative delta |
| `assets/straight-arrow.png` | Flat delta |
| `assets/counter.png` | Inline with run count — accent purple (`#b887ff`) |
| `assets/pace.png` | Inline with avg pace — Tempo orange (`#dc6600`) |

---

## Out of Scope

- Type filter chips (next iteration)
- Run list / pagination (next iteration)
- Weekly stats grid from original spec (replaced by this 30-day card)
