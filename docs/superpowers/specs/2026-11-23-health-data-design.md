# Health Data on Insights (RA-29, Apple Health part) — Design

Branch `feature/health-data` · 2026-11-23 · approved in brainstorm with Bar. Mockup: `.superpowers/brainstorm/insights/insights-v2.html` (gitignored). Figma reference: "01 Data & insights" (node 2:226) — only its page heading and dark card style are used now.

## Goal

The Insights tab shows 25 Apple Health metrics as trend cards, grouped, each opening a detail chart. Everything is on by default; the user hides and reorders metrics with **Edit** on the tab. The choice is saved in the profile, so it follows the user to a new phone.

**Key decision:** read **live from Apple Health** every time; nothing is copied into Supabase or SQLite (except the hide/order choice). iCloud already syncs Health between the user's iPhones, HealthKit stays the single source, no new tables, no sensitive data in our cloud. Rejected: copying daily values into Supabase (new table + sync + migration for data we don't need yet).

**Out of scope (later):**
- Calculated insights (estimated VO2max, HRmax trend, aerobic efficiency, training load, RA-31 predictions) and the Figma weekly card / lime coaching card. Lime is reserved for them.
- Cadence + stride length per run → **RA-43**. First-run tour → **RA-44**.
- Imperial units (RA-6). Metric only.
- Re-design of the tab (Bar: "we will redesign it later").

## 1. Metrics

One catalogue, `src/insights/metrics.ts`, drives the tab, the detail screen, Edit and the permission list. Adding a metric later = one entry.

```ts
interface Metric {
  key: string                    // stable id, stored in profiles.insights_layout
  group: 'heart' | 'fitness' | 'form' | 'sleep' | 'body' | 'activity'
  label: string                  // card label
  unit: string                   // display unit ('' for counts)
  kind: 'line' | 'bars' | 'sleep' | 'events' | 'workouts'
  hk: string                     // HealthKit identifier (read permission)
  hkUnit?: string                // unit passed to HealthKit
  agg?: 'avg' | 'sum'            // line → avg per bucket, bars → sum per bucket
  meta: 'compare' | 'today' | 'date' | 'lastRun' | 'baseline'   // card's dim line, see §4
  decimals: number
  toDisplay?: (v: number) => number   // e.g. m/s → km/h, fraction → %
  explain: string                // detail screen "what this means" — facts only, no judging
}
```

Groups in fixed order, with their colour (all existing tokens; add them to `tokens.ts` as `groupColors`):

| group | title | colour |
|---|---|---|
| heart | Heart | `#d74f49` (hrLine) |
| fitness | Fitness | `#3bac68` (elevLine) |
| form | Running form (header note "Apple Watch") | `#dc6600` (iconOrange) |
| sleep | Sleep & recovery | `#6db8e8` (iconSky) |
| body | Body | `#00a6b8` (iconTeal) |
| activity | Activity (header note "daily totals") | `#e8a900` (iconGold) |

The 25 metrics (default order):

| key | group | label | HealthKit id (`HK…TypeIdentifier…`) | HK unit → display | kind / agg | card meta |
|---|---|---|---|---|---|---|
| restingHr | heart | Resting HR | Quantity RestingHeartRate | count/min → bpm | line/avg | compare |
| hrv | heart | HRV | Quantity HeartRateVariabilitySDNN | ms | line/avg | compare |
| cardioRecovery | heart | Cardio recovery | Quantity HeartRateRecoveryOneMinute | count/min → bpm | line/avg | date |
| walkingHr | heart | Walking HR | Quantity WalkingHeartRateAverage | count/min → bpm | line/avg | compare |
| hrEvents | heart | HR notifications | Category HighHeartRateEvent, LowHeartRateEvent, IrregularHeartRhythmEvent | — | events | count in 90 days + latest |
| vo2max | fitness | VO2max | Quantity VO2Max | ml/(kg*min) → ml/kg·min | line/avg | date |
| power | form | Running power | Quantity RunningPower | W | line/avg | lastRun |
| groundContact | form | Ground contact | Quantity RunningGroundContactTime | ms | line/avg | lastRun |
| vertOsc | form | Vertical osc. | Quantity RunningVerticalOscillation | cm | line/avg | lastRun |
| runSpeed | form | Running speed | Quantity RunningSpeed | m/s → km/h | line/avg | lastRun |
| sleep | sleep | Sleep last night | Category SleepAnalysis | → h:mm | sleep | 30-day avg |
| respiratory | sleep | Respiratory | Quantity RespiratoryRate | count/min → /min | line/avg | compare |
| spo2 | sleep | Blood oxygen | Quantity OxygenSaturation | % (fraction × 100) | line/avg | compare |
| wristTemp | sleep | Wrist temp | Quantity AppleSleepingWristTemperature | degC → ± °C | line/avg | baseline |
| weight | body | Weight | Quantity BodyMass | kg | line/avg | date |
| bodyFat | body | Body fat | Quantity BodyFatPercentage | % (fraction × 100) | line/avg | date |
| steps | activity | Steps | Quantity StepCount | count | bars/sum | today |
| activeKcal | activity | Active calories | Quantity ActiveEnergyBurned | kcal | bars/sum | today |
| exercise | activity | Exercise | Quantity AppleExerciseTime | min | bars/sum | today |
| walkRun | activity | Walk + run | Quantity DistanceWalkingRunning | m → km | bars/sum | today |
| flights | activity | Flights climbed | Quantity FlightsClimbed | count | bars/sum | today |
| standHours | activity | Stand hours | Category AppleStandHour (value = stood) | h | bars/sum (count per day) | today |
| restingKcal | activity | Resting energy | Quantity BasalEnergyBurned | kcal | bars/sum | today |
| daylight | activity | Time in daylight | Quantity TimeInDaylight | min | bars/sum | today |
| otherWorkouts | activity | Other workouts | Workout (all activity types except running) | → h:mm per week | workouts | this week + per type |

All identifiers were checked against `@kingstinct/react-native-healthkit` 16.2.0.

## 2. Reading Apple Health

`src/healthkit/insights.ts` (lazy module via `hk()`, read-only, every call `.catch` → no data):

- **line / bars:** `queryStatisticsCollectionForQuantity` with `discreteAverage` (line) or `cumulativeSum` (bars), one call per metric. iOS merges iPhone + Watch duplicates for us. Returns `{ date: 'YYYY-MM-DD', value }[]` (empty buckets dropped).
- **sleep:** `queryCategorySamples(SleepAnalysis)`. A night belongs to the date it ends. Asleep = core + deep + REM + unspecified; awake counted separately; inBed ignored. If several sources recorded the same night, use the Apple Watch source, else the source with the most asleep time. Per night: `{ date, asleep, core, deep, rem, awake }` (seconds).
- **events:** `queryCategorySamples` for the three HR event types → `{ start, type: 'high' | 'low' | 'irregular' }[]`.
- **workouts:** `queryWorkoutSamples`, running workouts skipped → per week `{ weekStart, byType: { [activityName]: seconds } }`.
- **stand hours:** category samples with value "stood", counted per day.

**Bucket size by period** (keeps every chart ≲ 90 points): Month and 3 months → day, Year → week, All → month. "All" starts at the oldest sample (HealthKit `startDate` of the first sample; fallback 5 years).

**Tab load:** one 90-day read for every visible metric, in parallel, kept in memory (`src/store/useInsightsStore.ts`, Zustand). Loaded on first tab focus, re-read on pull-to-refresh and when the app returns to the foreground after > 10 min. The detail screen reads its own period on demand (not cached beyond the screen).

## 3. Calculations (pure, no HealthKit)

`src/insights/summary.ts`, self-check `node src/insights/summary.check.ts`:

- `latest(points)` → last point.
- `compare(points, today)` → mean of the last 30 days minus mean of the 30 days before; null if either window is empty.
- `dailyAvg(points, today)` → mean of the last 30 days' totals (days with data only).
- `baseline(points)` → latest minus the 90-day mean (wrist temperature is shown as a change from the user's own average, like Apple).
- `stats(points)` → min / avg / max for the detail screen.
- `bucketFor(period)` → 'day' | 'week' | 'month'.
- `weekTotal(workouts, today)` for "this week".
- Formatting reuses `src/utils/format.ts`; new helper `fmtHMM(sec)` → "7:12" for sleep / workout time lives there too.

## 4. Screens

### Insights tab — `app/(tabs)/insights.tsx`

- Heading (Figma style): "Your body, over time." + dim "From Apple Health · last 30 days". **Edit** = lime outline button, top right.
- Groups in fixed order; header = 9 px rounded square in the group colour + title (17/600) + optional dim note.
- Two-column grid of cards (`bgSurface`, `borderDefault`, radius 16). Full width: HR notifications, VO2max, Sleep, Other workouts.
- Card: label (10 px caps, group colour mixed toward lavender), value in JetBrains Mono 26 lavender + unit (Inter 12 muted), dim meta line, sparkline of the last 30 days at the bottom.
  - **line:** group-colour line + 12 % fill, last point = dot in group colour.
  - **bars:** one bar per day, past days 40 % opacity, today solid.
  - **sleep:** last night's stages as one stacked bar (sky shades `#3a4a6b` awake, `#4f86b8` core, `#6db8e8` deep, `#a6d8f5` REM) + legend with times.
  - **events / workouts:** text only (count + latest; this week + per type).
- Meta line by `meta`: `compare` "−2 vs prior 30 days" · `today` "today · avg 9,610" · `date` "20 Nov" (date of latest reading) · `lastRun` "avg, last run" (latest day with data) · `baseline` "vs your average".
- **A metric with no data in the 90-day window is hidden.** A group with no visible card is hidden.
- Pull to refresh.
- **No Health access / Expo Go / nothing at all:** one centred message: "Allow Apple Health access to see your data here." + "Open Settings" (lime outline) → `Linking.openSettings()`. (iOS never says what was refused, so this shows when every metric is empty.)
- Lime appears nowhere on this tab except the Edit outline (lime is for the future insight cards).

### Detail — `app/insight/[key].tsx`

- Back button + metric label. Big value (Mono 44) + unit, dim "Latest, <date time>".
- Segmented switch Month / 3 months / Year / All (default 3 months).
- `TrendChart` in `bgChart` box: line (group colour, fill, last-point dot, 3 dashed gridlines with Mono labels at the right, 3 date labels below) or bars. Sleep = stacked bars per night. Events = list (date, time, type) instead of a chart. Workouts = weekly bars + per-type totals for the period.
- Min / Avg / Max tiles (not for events).
- "What this means" card = `metric.explain`. Then "From Apple Health. Read-only."
- No touch scrubbing in this version (the run charts have it; add when asked).

### Edit — `app/insights-edit.tsx`

- Title "Edit insights", sub "Drag to reorder. Switch off to hide.", **Done** = the screen's one solid-lime primary.
- Per group: rounded list, row = drag handle, name, switch. A metric with no data shows "No data in Health" (dim) and stays hidden on the tab even when switched on.
- Reorder **within a group** only (groups stay in fixed order). Drag with `react-native-gesture-handler` + `react-native-reanimated` (both already installed) — no new package.
- Done → save through `writeChange('profiles', 'update', …)` then `syncNow()`; back to the tab.

### Components

`Sparkline` (line / bars) and `TrendChart` added to `src/components/Chart.tsx`, reusing `buildChartPaths` from `src/utils/chart.ts` where it fits. Real data only — no generated series.

## 5. Data: hide / order choice

| column | cloud (`public.profiles`) | phone (SQLite `profiles`) |
|---|---|---|
| `insights_layout` | `jsonb`, nullable | `TEXT` (JSON col) |

Shape: `{ "hidden": ["walkingHr", …], "order": ["restingHr", "hrv", …] }`. null = defaults (all shown, catalogue order).
- Stores **hidden**, not shown → metrics added later appear for everyone.
- Keys in `order` that no longer exist are ignored; catalogue keys missing from `order` keep their catalogue position after the ordered ones in their group.
- Update `supabase/schema.sql`, add `supabase/migrations/2026-11-23-insights-layout.sql`, SQLite v7 (`ALTER TABLE profiles ADD COLUMN insights_layout TEXT`), `ProfileRow.insights_layout`; read/written as JSON exactly like `zone_bounds` (the profile's existing JSON column).
- Pure helper `visibleMetrics(layout, metrics)` in `summary.ts` → ordered visible list; covered by the self-check.

## 6. Permissions

- `READ` in `src/healthkit/permissions.ts` gets every `hk` id from the catalogue (built from `METRICS`, not a second hand-written list).
- After the update `needsHealthPrompt()` is true again for existing users, so `app/index.tsx` shows the Health screen once at launch. iOS then asks only about the new types. Accepted (Bar), no extra code.
- `app.json` usage string mentions sleep and heart data alongside runs.
- **Needs a new EAS dev build.**

## 7. Testing

- `node src/insights/summary.check.ts`: compare / dailyAvg / baseline / stats, bucket choice, sleep night grouping + source choice, `visibleMetrics` (hidden, unknown keys, new keys).
- Existing checks still pass (`sync.check`, `import.check`, `zones.check`, `profile.check`, `compare.check`). tsc clean.
- **Device (dev build), Bar:** run the migration first → new build → Health prompt shows once with the new types → tab shows his real data; values match the Health app for resting HR, HRV, VO2max, weight, steps (today), last night's sleep; a metric without data is hidden; Edit hide + reorder survives an app restart and log out/in; detail periods switch; Health access off in iOS Settings → the "Allow access" message.

## Bar to do

1. Run `supabase/migrations/2026-11-23-insights-layout.sql` in the SQL Editor **before** opening the new code (a rejected profile push is marked failed for good).
2. `eas build --profile development --platform ios`, reinstall.
3. Device test (§7).
