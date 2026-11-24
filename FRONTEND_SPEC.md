# Chronodrom — Frontend Implementation Spec

Mobile-first running tracker app. Single screen, 420 × 900 px at design time; stretch to device width on real devices.

---

## Design Tokens

### Colors
Palette comes from the Strides Figma file (dark). Translucent lavender layers are
pre-blended over `bg-app` into solid hex (React Native has no oklch support).

| Token | Value | Usage |
|---|---|---|
| `bg-app` | `#1d172c` | Page background |
| `bg-card` | `#1d172c` | App shell / nav bars |
| `bg-surface` | `#271f39` (lavender 6%) | Cards, inputs |
| `bg-elevated` | `#2e2541` (lavender 10%) | Tiles, pills, dropdowns |
| `bg-chart` | `#241d34` (lavender 4%) | Chart backgrounds |
| `border-subtle` | `#362c4c` (lavender 15%) | Dividers |
| `border-default` | `#332947` (lavender 13%) | Card borders |
| `border-strong` | `#3e3356` (lavender 20%) | Input borders |
| `border-input-focus` | `#473a61` (lavender 25%) | Input border (un-active) |
| `text-primary` | `#c4a3ff` | Body text |
| `text-secondary` | `#ab8edf` (85%) | Secondary labels |
| `text-muted` | `#9a80ca` (75%) | Metadata |
| `text-dim` | `#957cc4` (72%) | Section labels |
| `text-faint` | `#8a72b5` (65%) | Timestamps |
| `text-ghost` | `#7964a0` (55%) | Chevrons, disabled |
| `accent` | `#c4a3ff` | Lavender — links, active tabs, hero card |
| `lime` | `#d9f879` | Highlight card, growth pill, best-day bar |
| `ink` | `#1d172c` | Text on lavender / lime cards |
| `accent-bg` | `oklch(0.64 0.19 300)` | Primary button background |
| `accent-hover` | `oklch(0.70 0.18 300)` | Primary button hover |
| `accent-dim` | `oklch(0.30 0.09 300)` | Avatar, active chip bg |
| `accent-muted` | `oklch(0.40 0.13 300)` | Active filter button |
| `danger` | `oklch(0.62 0.17 25)` | Error text, log out |
| `hr-line` | `oklch(0.62 0.17 25)` | Heart rate chart stroke |
| `elev-line` | `oklch(0.68 0.14 155)` | Elevation chart stroke |

### Zone colors (Z1–Z5)
Heart-rate zones ramp from yellow (low intensity) to red (high intensity). Used in zones table and HR visualization.

| Token | Value | Usage |
|---|---|---|
| `zone1` | `oklch(0.83 0.17 100)` | Z1 yellow — recovery |
| `zone2` | `oklch(0.75 0.16 75)` | Z2 amber — base |
| `zone3` | `oklch(0.67 0.16 55)` | Z3 orange — tempo |
| `zone4` | `oklch(0.60 0.18 35)` | Z4 red-orange — threshold |
| `zone5` | `oklch(0.55 0.20 27)` | Z5 strong red — max effort |

### Run-type Colors
Each run type has a hue; the color is `oklch(0.66 0.17 <hue>)`.

| Type | Hue |
|---|---|
| Long Run | 300 |
| Easy | 225 |
| Recovery | 155 |
| Tempo | 55 |
| Intervals | 20 |
| Fartlek | 95 |
| Hills | 340 |

Hue picker swatches: `[300, 225, 155, 55, 20, 95, 340, 270, 10, 190]`

### Buttons

Tokens in `src/utils/tokens.ts` → `buttons`.
- **Primary** — solid `lime`, `ink` text 13 / 700, radius 12. One per screen at most: "Compare ›" (All runs bar), Save (Edit run). The All runs compare toggle turns solid lime while selecting.
- **Secondary** — `lime` 1 px outline, `lime` text 11 / 600, radius 14, transparent fill: "See all →", "Zones →", filter pills (▾), Edit (run screen), "Choose from all runs ›".
- **Icon-only** (back ‹, compare icon) — dark `bg-surface` squares, `text-primary` icon.
- Lime fills that are *not* buttons (growth pill, takeaway / fastest-km cards) have no border and no arrow.

### Typography
```
font-family: 'Inter', system-ui, sans-serif       — all body text
font-family: 'JetBrains Mono', monospace          — all numeric metrics
```
Load from Google Fonts: `Inter` weights 400/500/600/700/800 + `JetBrains Mono` weights 400/500/600/700.

---

## App Shell

```
┌─────────────────────────┐
│  Top Nav (58 px)        │
├─────────────────────────┤
│                         │
│  Scrollable content     │
│  padding: 20px 18px     │
│                         │
├─────────────────────────┤
│  Bottom Tab Bar (64 px) │
└─────────────────────────┘
```

### Top Nav
- Height: 58 px, `bg-card`, border-bottom `border-subtle`
- Left: hamburger (3 × 18 px bars, `oklch(0.90 0.005 285)`, gap 4 px) + Chronodrom logo (icon + wordmark at 15 px/800 weight)
- Right: avatar circle 30 × 30 px, `accent-dim` bg, shows first initial of user name

### Bottom Tab Bar
Four equal tabs: **Dashboard · Runs · Compare · Settings**
- Active: color `accent`, top-border `accent` (2 px)
- Inactive: color `text-ghost`, no top border
- Font: 11.5 px / 600

### Hamburger Side Drawer
- Overlay: `oklch(0.05 0 0 / 0.55)` covers full screen, z-index 40, tap to close
- Panel: 250 px wide, slides from left, `oklch(0.17 0.006 285)`, border-right `border-strong`, z-index 41
- Header: logo row, border-bottom `border-subtle`
- Menu items (13.5 px / 600, 12 px 20 px padding):
  - Dashboard, Runs, Compare, Settings, Manage run types, Connected apps
  - Log out (color: `danger`)
  - Active item: `oklch(0.24 0.06 300)` background, `oklch(0.90 0.05 300)` text

---

## Screens

### 1. Auth — Not Authenticated

Shown when the user is not logged in. Centered vertically, 40 px horizontal padding.

**Header**
- Lightning bolt SVG (40 × 40, `accent`)
- "Chronodrom" — 22 px / 800
- "Every run, decoded." — 12 px, `text-ghost`

**Login form** (default mode)
- Title: "Log in" — 17 px / 700
- Email input
- Password input (type password)
- Error message (12 px, `danger`) — shown only when `authError` is set
- "Log in" button (primary style)
- "No account? Sign up" link at bottom center

**Sign up form** (switched via link)
- Title: "Create account"
- Full name input (additional field above email)
- Email + Password inputs
- Error message
- "Create account" button
- "Have an account? Log in" link

**Input style**
```
background: bg-surface
border: 1px solid border-input-focus
border-radius: 8px
padding: 12px 14px
color: text-primary
font-size: 14px
```

**Primary button style**
```
background: accent-bg
border: none
border-radius: 8px
padding: 13px
color: oklch(0.98 0.01 300)
font-size: 14px / 700
hover: accent-hover
```

**Validation**
- Login: both email + password required
- Sign up: name + email + password required
- Show inline error if empty on submit

---

### 2. Dashboard

Main screen after login. Scrollable column, gap 20 px.

#### 2a. Weekly Stats Grid
Label: "This week" — 12 px, `text-dim`, uppercase, letter-spacing 0.6 px

2 × 2 grid (gap 10 px) of stat cards:
- Distance
- Time
- Runs (count)
- Avg pace

**Stat card style**
```
background: bg-surface
border: 1px solid border-default
border-radius: 10px
padding: 14px
label: 11px, text-dim
value: JetBrains Mono, 22px / 700, margin-top 4px
```

Values: computed from runs in the last 7 days.

#### 2b. Filter by Type Chips
Label: "Filter by type" — section label style

Horizontal wrap of chips, one per run type. Each chip shows `name` + muted run count.

Tapping a type chip navigates to the Runs screen pre-filtered to that type.

**Chip style (active)**
```
padding: 6px 12px
border-radius: 16px
font-size: 12px / 600
background: oklch(0.40 0.13 <hue>)
color: oklch(0.97 0.01 <hue>)
border: 1px solid transparent
```
**Chip style (inactive)**
```
background: transparent
color: text-secondary
border: 1px solid border-input-focus
```

#### 2c. Recent Runs
Label: "Recent runs" — section label style. "See all →" link at top-right (navigates to Runs screen).

List of 4 most recent runs. Each item:
```
background: bg-surface
border: 1px solid border-default
border-radius: 10px
padding: 12px
cursor: pointer → navigates to Run Detail
```
Layout:
- Left: 8 × 36 px type-color bar (border-radius 4 px)
- Center: type name (14 px / 600) + date (11 px, `text-faint`); line 2: distance · pace · duration (12 px, `text-muted`)
- Right: chevron `›` in `text-ghost`

---

### 3. Runs (Run List)

**RunCard** (`src/components/RunCard.tsx`, shared by Dashboard recent runs, All runs, the compare picker and Run Detail's compare sheet): `bg-surface`, radius 18, padding 12. Type tile 48×48 (type color at 25% + 14 px dot) · name 13 / 600 · "date · type" 10 `text-dim` · "8.0 km  ·  44m  ·  5:35/km" mono 10 · right: 44 px reserved slot for achievement badges (RA-37, empty for now). Selection mode adds a lime check circle.

#### Header
"Runs (N)" — 17 px / 700, N = filtered count in muted text. "Reset" link at top-right clears all filters.

#### Type Filter Chips
Horizontal wrap of type chips (same chip style as Dashboard 2b), but multi-select toggle — tap to add/remove from filter.

#### Date Preset Chips
Row: **All time · 7 days · 30 days · 90 days**

Active preset style:
```
background: oklch(0.30 0.09 300)
color: oklch(0.90 0.05 300)
border: 1px solid transparent
```
Inactive: same as type chip inactive.

#### Filter Panel
Card (`bg-chart`, border `border-default`, border-radius 10, padding 14 px):

Three dropdown filter buttons in a row:
- **Distance** (< 5 km / 5–10 km / 10–15 km / 15–20 km / 20+ km)
- **Pace** (Sub 4:30 / 4:30–5:30 / 5:30–6:30 / 6:30+)
- **Duration** (< 30 min / 30–60 / 60–90 / 90+)

**Filter button (inactive)**
```
border: 1px solid border-input-focus
background: bg-surface
color: text-secondary
border-radius: 8px
padding: 8px 12px
font-size: 12.5px / 600
```
**Filter button (active — 1+ options selected)**
```
border: 1px solid oklch(0.45 0.14 300)
background: oklch(0.30 0.09 300)
color: oklch(0.90 0.05 300)
```
Label shows count: "Distance (2)".

**Dropdown menu** (absolute, top 100%, left 0, z-index 20):
```
background: oklch(0.22 0.008 285)
border: 1px solid oklch(0.32 0.01 285)
border-radius: 8px
padding: 8px
box-shadow: 0 8px 20px oklch(0 0 0 / 0.45)
```
Each option: checkbox (14 × 14, checked = `accent-bg` bg) + label.

**Sort select** (below dropdowns):
```
background: bg-elevated
border: 1px solid border-input-focus
border-radius: 7px
padding: 8px 10px
font-size: 12px
```
Options: Newest first / Oldest first / Longest first / Shortest first / Fastest pace first

#### Run List Items
Same card style as Dashboard recent runs, plus HR shown: `distance · pace · duration · HR <avgHr>`.

"No runs match these filters." — centered, muted, when empty.

---

### 4. Run Detail

Navigate from any run row. No Figma frame exists for this screen; it reuses the Strides language (Dashboard hero card, dark stat cards, lime highlight, Compare table style).

**Floating buttons** (stay pinned while scrolling): back ‹ top-left; compare icon + "Edit" top-right. Rounded squares 46×44, radius 15, `bg-surface`, soft shadow. Edit text 14 / 600 `text-primary`.

**Header**: type-color dot + "TEMPO · NOV 14, 2026" (10 / 600, `text-secondary`); run name 25 / 600; "Synced from Apple Health" 12 `text-secondary`.

**Hero** — lavender card (`accent`, radius 26, padding 22), ink text and ink-tinted icons: "DISTANCE" label with icon, distance mono 56 / 600 + unit; row of Time · Avg pace · Avg HR (icon + 10 px label, mono 16 / 600 value).

**Stat grid** — 2 columns, gap 10. Cards `bg-surface`, radius 18, padding 14: lavender-tinted icon + uppercase label (10 / 600, `text-secondary`), mono 18 / 600 value, optional 10 px `text-muted` sub. Cards: Pace range · HR range · Elevation · Calories · Weather (sub: humidity) · Primary zone (sub: zone name · minutes).

**Lime highlight** — "Fastest km: km N · m:ss/km" (full kms only), ink 14 / 600, radius 17. Placeholder until Run Insights (RA-36).

**Sections** — title 19 / 600 with an optional "See all →" / "Zones →" pill (`bg-surface`, radius 14). Order: Splits (first 5, → splits screen) · Structure (interval runs, first 5, → segments screen) · Pace chart · Heart rate chart (→ zones screen) · Map placeholder.

**Tables** (Splits, Structure): no box; header row 10 / 600 uppercase `text-secondary`; rows with 1 px `border-subtle` top divider, mono 12 / 500 `text-primary` (split # in `text-secondary`; segment type keeps its colored dot + label).

**Charts** keep their own colors (blue pace bars, red HR range bars) inside `bg-surface` cards, radius 18. Scrubbing unchanged; swipe-back is disabled so scrubbing doesn't pop the screen.

---

### 5. Compare

Original design: `docs/superpowers/specs/2026-11-01-compare-runs-design.md`. Restyled to the Strides Figma (frame "Dark · 04 Run comparison").

**Entry points**
- **All runs tab**: compare button in the Figma "+" slot (46×44, radius 15, `bg-elevated`; lime with ink icon while selecting) toggles selection mode; run cards show check circles (lime when on); max 2 (3rd tap → alert "You can compare only 2 runs. Uncheck one first."). With 2 checked, a bottom bar shows "<date> vs <date>", lime "Compare ›", and ✕. Selection persists until ✕ or button re-tap.
- **Run Detail**: top-right row of floating buttons — compare icon, then Edit. Compare → page sheet of other runs of the same type (RunCard rows); tap one → comparison. "Choose from all runs ›" → All runs in selection mode with this run checked.
- **Compare tab** and **`/compare/result?a=&b=`** render the same `CompareView`; result pre-fills both runs (newer run = A) and adds a floating back button.

**CompareView** (one screen; results appear once both runs are picked)
- Header: "See how you’re growing." 25 / 600, subtitle "Two runs. A little more perspective." 12 `text-secondary`.
- Distance label (10 / 600, only with both runs): "SAME DISTANCE · A FAIR COMPARISON" when distances match at 0.1 km; "SIMILAR DISTANCE" within 10%; else "DIFFERENT DISTANCES".
- Run cards A/B: `bg-surface`, radius 20, padding 15, min height 110. "RUN A" (10 / 600) with type-color dot, ▾ right; date 21 / 600; "8.0 km · 5:35/km" mono 11. Empty: "Pick a run". Tap → page sheet "Select run A" with RunPickerList (type pill, month headers, RunCards; other slot's run at 35% opacity). Before both are picked: "Pick two runs to compare."
- Pace by kilometre: lavender card (`accent`, radius 26, padding 20), ink text. Legend: run A solid line, run B 55% line. Per-split pace from `splits`; Run A solid 2.5 px with dots, Run B dashed 2 px at 55%; faster = higher; 3 gridlines at 20 s steps around the data; x labels 1…N (every other when N > 10); the shorter run's line ends early.
- Headline "<A date> vs <B date>" 17 / 600, then "Highlight better results" + Switch (lime track), off by default.
- Table, no box: head row = A and B dates (10 / 600, tap → Run Detail); rows with 1 px `border-subtle` top divider, label 12 / 500 `text-secondary`, A value mono 12 / 600 `text-primary`, B value mono 12 / 500 `text-secondary`; missing → "—". Rows (10): Distance · Time · Avg Pace · Avg HR · Max HR · Elevation · Cadence · Calories · Primary Zone · Weather.
- **Highlighting** (toggle on): per row only, the better value turns lime / 700. Higher is better: Distance, Elevation, Cadence. Lower: Time, Pace, Avg HR, Max HR. Never: Calories, Primary Zone, Weather. Ties and missing values never highlight. Rule lives in `src/utils/compare.ts`.
- Takeaway: lime card, radius 17, ink 14 / 600. Fact only, no verdict: "<A date> was N sec/km faster|slower", or "Same average pace".

---

### 6. Settings

**Title**: "Settings" — 17 px / 700

**User card** (bg-surface, border-default, border-radius 10, padding 14):
- Name — 14 px / 600
- Email — 12 px, `text-dim`

**Units toggle**
Label: "Units" — section label style

Two pills in a row (equal width):
- Kilometers / Miles
- Active: `oklch(0.30 0.09 300)` bg, `oklch(0.90 0.05 300)` text
- Inactive: `bg-surface`, `oklch(0.65 0.012 285)` text
- Border: `border-strong`

**Nav rows** (tap to navigate):
- "Manage run types" → Manage Types screen
- "Connected apps" → Connected Apps screen

Each row: bg-surface card, flex justify-between, label (14 px / 600) + sub-label (12 px, `text-dim`) + chevron.

**Log out button**:
```
background: none
border: 1px solid oklch(0.34 0.01 285)
color: oklch(0.72 0.012 285)
border-radius: 8px
padding: 12px
font-size: 13px / 600
hover: border-color + text-color → danger
```

---

### 7. Manage Run Types

**Back link**: "‹ Back to settings"

**Title**: "Run types" — 17 px / 700

#### Types List
Each type row (bg-surface, border-default, border-radius 10, padding 11 12):
- Color dot: 12 × 12 px circle, type-color
- **View mode**: name (13 px / 600) + run count (11 px, `text-faint`) + "Edit" link (12 px, `text-muted`) + "Delete" link
  - Delete is `danger` + pointer if count = 0; `oklch(0.40 0.01 285)` + not-allowed if count > 0
- **Edit mode**: text input (pre-filled with name) + "Save" link (`accent`)

#### Add Type Form
Card (`bg-chart`, border-default, border-radius 10, padding 14):
- Section label: "Add type"
- Name input (13 px)
- Color swatch row: 10 circles (24 × 24, all HUE_SWATCHES). Selected swatch has a white 2 px border.
- "Add type" button (primary style, 13 px)

---

### 8. Connected Apps

**Back link**: "‹ Back to settings"

**Title**: "Connected apps" — 17 px / 700

**Description**: "Runs sync automatically after each workout — no live tracking here, just clean data once you're done." (12 px, `text-muted`, line-height 1.5)

#### App Rows (Strava · Apple Health · Garmin Connect · Coros)

Each row (bg-surface, border-default, border-radius 10, padding 13):
- Name — 14 px / 600
- Status label — 11.5 px, `text-faint`:
  - Connected: "Synced Aug 5 · 6:20 PM"
  - Syncing: "Syncing…"
  - Not connected: "Not connected"
- **Sync/Connect pill** (`accent` text, border `oklch(0.34 0.09 300)`, border-radius 14, 11.5 px / 600):
  - Connected: label "Sync" (tap triggers sync, shows "…" during sync, then updates timestamp)
  - Not connected: label "Connect" (tap marks as connected)
- **Toggle switch** (38 × 22, border-radius 12):
  - On: `accent-bg` bg, knob at right (left: 18 px)
  - Off: `border-input-focus` bg, knob at left (left: 2 px)
  - Knob: 18 × 18 px circle, `oklch(0.97 0.002 285)`, transition left 0.15 s

---

## Data Model

### Run Type
```ts
interface RunType {
  id: string          // e.g. 'long', 'easy', 'tempo'
  name: string        // e.g. 'Long Run'
  hue: number         // oklch hue for color generation
}
```

### Run
```ts
interface Run {
  id: string
  typeId: string      // references RunType.id
  date: string        // ISO date 'YYYY-MM-DD'
  distanceKm: number
  timeSec: number
  avgHr: number
  maxHr: number
  elevGain: number    // meters
  cadence: number     // steps per minute
  source: 'strava' | 'apple_health' | 'garmin'
}
```

### Derived / computed fields (frontend only)
| Field | Formula |
|---|---|
| pace (sec/km) | `timeSec / distanceKm` |
| pace display | `mm:ss/km` or `mm:ss/mi` depending on unit setting |
| distance display | `distanceKm` or `distanceKm × 0.621371` |
| calories | `round(distanceKm × 62)` |
| splits | 1 row per `round(distanceKm)`, pace/HR generated from run seed |

### User
```ts
interface User {
  name: string
  email: string
  unit: 'km' | 'mi'
}
```

### Connected App
```ts
interface ConnectedApp {
  id: string
  name: string
  connected: boolean
  lastSync: string | null   // ISO datetime
  syncing: boolean
}
```

---

## Sorting & Filtering Logic

### Sort options
| Value | Behaviour |
|---|---|
| `date_desc` | newest first (default) |
| `date_asc` | oldest first |
| `dist_desc` | longest distance first |
| `dist_asc` | shortest distance first |
| `pace_asc` | fastest pace first (lowest sec/km) |

### Filters — all combined with AND
- **Type**: multi-select — run must match one of selected typeIds (empty = all)
- **Distance buckets**: multi-select — run.distanceKm must fall in one of selected ranges
- **Pace buckets**: multi-select — run pace (sec/km) must fall in one of selected ranges
- **Duration buckets**: multi-select — run.timeSec must fall in one of selected ranges
- **Date preset**: `7d` / `30d` / `90d` = run date within N days of today; `all` = no filter

### Distance bucket definitions
| id | label | min km | max km |
|---|---|---|---|
| `lt5` | < 5 km | 0 | 5 |
| `5to10` | 5–10 km | 5 | 10 |
| `10to15` | 10–15 km | 10 | 15 |
| `15to20` | 15–20 km | 15 | 20 |
| `20plus` | 20+ km | 20 | ∞ |

### Pace bucket definitions (sec/km)
| id | label | min | max |
|---|---|---|---|
| `sub430` | Sub 4:30/km | 0 | 270 |
| `430to530` | 4:30–5:30/km | 270 | 330 |
| `530to630` | 5:30–6:30/km | 330 | 390 |
| `630plus` | 6:30+/km | 390 | ∞ |

### Duration bucket definitions (seconds)
| id | label | min | max |
|---|---|---|---|
| `lt30` | < 30 min | 0 | 1800 |
| `30to60` | 30–60 min | 1800 | 3600 |
| `60to90` | 60–90 min | 3600 | 5400 |
| `90plus` | 90+ min | 5400 | ∞ |

---

## Chart Data Generation

The HR chart draws real data only: `run.hrCurve` (80 × [min, max] bpm, built at import) in `HrRangeBarsChart`; no curve → no chart. `genSeries` below is the original mock-data design and is no longer in the code.

### Series generator
```ts
function genSeries(seedKey: string, n: number, base: number, variance: number, driftTotal: number): number[]
```
- Uses a deterministic LCG seeded by a hash of `seedKey` so the same run always produces the same chart.
- Generates `n` points starting near `base ± driftTotal/2`, drifting by `driftTotal/n` per step plus random variance.

### Per run — use these calls
```
pace series:      genSeries(run.id + 'pace', 16, timeSec/distanceKm, 14, 0)
elevation:        genSeries(run.id + 'elev', 16, 0, elevGain*0.06, elevGain)
```

### SVG path builder
```
viewBox: 0 0 300 100   (always)
padding inside: 10px top/bottom

x = (i / (n-1)) * 300
y = 100 - 10 - ((v - min) / range) * 80

area path: M x0,90 L <points> L xLast,90 Z
polyline: space-separated "x,y" pairs
```

---

## Navigation State Machine

```
notAuthed  ──login/signup──► authed

authed views (controlled by `view` state):
  dashboard  ◄──tab──► runlist  ◄──tab──► compare  ◄──tab──► settings
  runlist ──tap run──► detail ──back──► runlist
  settings ──tap──► managetypes  ──back──► settings
  settings ──tap──► connected    ──back──► settings
  dashboard ──chip tap──► runlist (pre-filtered)
  dashboard ──"See all"──► runlist
  runlist (selection mode, 2 checked) ──"Compare ›"──► compareResult ──back──► runlist
  detail ──compare icon──► sheet ──tap run──► compareResult ──back──► detail
  detail ──compare icon──► sheet ──"Choose from all runs"──► runlist (selection mode, run pre-checked)
  compare (pick A/B → results inline)
  compareResult ──tap run header──► detail ──back──► compareResult
```

Hamburger menu provides alternative navigation to all primary views. Closing happens on overlay tap or on any item click.

---

## Formatting Helpers

```ts
// Duration: h:mm:ss or m:ss
fmtDuration(sec: number): string

// Pace: m:ss
fmtPace(secPerKm: number): string

// Date short: "Aug 5"
fmtDate(iso: string): string

// Date full: "Aug 5, 2026"
fmtDateFull(iso: string): string
```

Miles conversion:
- Display distance: `km × 0.621371`
- Display pace: `secPerKm × 1.60934` (pace per mile takes longer)

---

## Implementation Order (suggested for parallel work)

1. **Design tokens + shell** — colors, fonts, app container, top nav, bottom tab bar
2. **Auth screens** — login + signup forms with validation
3. **Dashboard** — weekly stats grid, type chips, recent run rows
4. **Run List** — filter panel (chips, dropdowns, sort), run rows, empty state
5. **Run Detail** — stats grid, 3 SVG charts, splits table, reclassify chips
6. **Compare screen** — selectors, comparison table with winner highlighting
7. **Settings** — units toggle, nav rows, logout
8. **Manage Types** — list with edit/delete, add form with color swatches
9. **Connected Apps** — app rows with sync button + animated toggle switch
10. **Navigation wiring** — connect all screens, hamburger drawer, back links

---

## Shoes (RA-8)

Spec: `docs/superpowers/specs/2026-11-23-shoes-design.md`. Entry: Settings → "My shoes" row. All km (no mi until RA-6).

- **Shoe colours** (`shoeColors` in `src/utils/tokens.ts`): black `#1a1a1a` · white `#f2f2f2` · grey `#8c8c8c` · red `#d74f49` · orange `#dc6600` · yellow `#e8c200` · green `#3bac68` · blue `#3d7be0` · purple `#9e6ce7` · pink `#d63f7a` · multi = split dot, lavender `accent` / `lime`. `ColorDot`: round, 2 px `bgSurface` ring; on the logo it sits bottom-right (offset −2).
- **Logo (`ShoeLogo`):** round, default 38, `bgElevated` fill, brand PNG from the `brand-logos` bucket; missing file → brand initials, Inter 700 `textPrimary`, size × 0.34.
- **ShoeCard** (My shoes, shoe page): `bgSurface`, 1 px `borderDefault`, radius 16, padding 12. Row: logo + colour dot · name Inter 14 / 600 `textPrimary` (display name = own name, else "Pegasus · Orange") · sub Inter 11 `textMuted` "Brand Model · default: Easy, Long Run". Meter bar 6 high, radius 3, `bgElevated` track, `accent` fill; text "312 / 700 km" mono 12 `textSecondary`. From 90 %: fill and a "92%" tag (mono 11, `iconOrange` on 15 % `iconOrange`, radius 8) turn orange. Retired shoes never turn orange.
- **My shoes** (`app/shoes/index`): ‹ Back, title "My shoes" 22 / 700, primary "+ Add". Cards gap 10, content padding 18. Empty: "No shoes yet. Add your first pair." Bottom link "Retired (n) ›" (13, `textGhost`, uppercase) opens the same list titled "Retired shoes" (no + Add).
- **Add / Edit shoe** (`app/shoes/edit`): title 22 / 700 + outline Cancel + primary Save. Fields (label 11 `textMuted`, field `bgElevated`, 1 px `borderStrong`, radius 12, min height 44): Brand (row with logo, ›; opens `ListPicker`, last item "Other…" → text field) · Model (that brand's models, "Other…" last) · Colour (optional): 11 swatches 24, selected = 2 px `lime` ring, tap again clears · Name (optional) · In use from ("Today" default, spinner date picker, max today) · Limit (mono, "km" suffix) with hint 11 `textGhost` "Recommended for Pegasus: 700 km" (typed model: "Typical for running shoes: 700 km"). Offline: orange `iconOrange` note "Catalogue unavailable — type brand and model." and typed fields. Edit adds an outline "Retire shoe" / "Un-retire" button at the bottom (retire asks for confirmation).
- **ListPicker:** modal list, logo on the left for brands, "Other…" last.
- **Past runs** (`app/shoes/past-runs`): title "Runs since <date>" 22 / 700, sub 13 `textMuted`. Rows: 20 px checkbox (radius 5; ticked = `accent` fill, `ink` ✓), "date · type" 14, distance mono 13 `textSecondary`; hairline `borderSubtle` dividers; all ticked at start. Then "Distance on this shoe" mono field (follows the ticked sum until typed), hint "From 7 runs. Change it to add km run without the app." Primary "Done".
- **Shoe page** (`app/shoes/[id]`): ‹ Back, outline Edit. ShoeCard, 2 × 2 stat tiles (`bgSurface`, `borderDefault`, radius 14, padding 12; label 11 `textMuted`, mono 18 value): Total distance · Runs · Average pace · Last used. Note 12 `textGhost`: "In use from <date> · includes N km run without the app"; "Retired" when retired.
- **Run Detail shoe pill:** under the type pill, `bgElevated`, radius 10, padding 10 / 4, Inter 12 `textSecondary`: "Shoe: Pegasus · Orange ▾" or "Shoe: none ▾". Tap → native sheet: "No shoe" + active shoes (✓ on the current one). After picking a shoe on a run that has a type, unless it is already the type's default: alert "Use <shoe> as the default for <type> runs?" — No / Yes.
- **Dashboard shoe warning card:** one per active shoe from 90 % (again at 100 %) until dismissed. Fill `#3a2414` (`iconOrange` blended over `bgApp`), 1 px `iconOrange` border, radius 18, padding 14. Title Inter 14 / 700 `#ffd0ad`: "<name> is at 92%" / "<name> has reached its limit"; ✕ right in `#ffb27a`. Body 13 `#ffb27a`: "644 / 700 km · Time to get a new pair." plus an underlined "Retire" link (confirm alert). Tap the card → shoe page. These three oranges are inline in `dashboard.tsx`, not tokens.
- **Pop-ups (native alerts):** 90 %: title "<name> is at 92%", text "644 / 700 km. Time to get a new pair.", OK. 100 %: "<name> has reached its limit", "702 / 700 km", buttons Close / Retire. One pop-up per level per shoe.

## Insights tab (RA-29)

Heading + dark card style from Figma "01 Data & insights"; Bar will redesign later. Mockup: `.superpowers/brainstorm/insights/insights-v2.html` (gitignored).

- **Heading:** "Your body, over time." Inter 26 / 700, line 30; sub "From Apple Health · last 30 days" Inter 13 `textDim`. Outline "Edit" button top right (hidden when there is no Health data).
- **Group header:** 9 × 9 dot (radius 3, group colour) + title Inter 17 / 600; optional note on the right, Inter 11 `textFaint`. Gap between groups 22.
- **Card:** `bgSurface`, 1 px `borderDefault`, radius 16, padding 12/12/10, two per row (48.5 %, gap 10), min height 128; wide cards (HR notifications, VO2max, Sleep, Other workouts) full width. Label Inter 10 / 600 uppercase, tracking 0.6, `groupLabelColors`. Value JetBrains Mono 26 / 600 + unit Inter 12 `textMuted`. Meta Inter 11 `textFaint`, one line.
- **Sparkline:** lines for rate-like metrics (resting HR, HRV, weight…), bars for totals (steps, stand hours); group colour, last bar full opacity, the rest 40 %. Height 30 (wide 40). Sleep card has a stage bar (awake / core / deep / REM in `sleepColors`) with a legend instead.
- **Group colours** (`groupColors`): heart `#d74f49` · fitness `#3bac68` · running form `#dc6600` · sleep `#6db8e8` · body `#00a6b8` · activity `#e8a900`. Lime is reserved for insight cards (RA-45).
- **Detail (`insight/[key]`):** back button + metric name, big value (Mono 44), segmented control Month / 3 months / Year / All (default 3 months), `TrendChart` in a `bgChart` box, Min / Avg / Max tiles, explanation card, "From Apple Health. Read-only."
- **Edit (`insights-edit`):** grouped list of rows (48 high): ≡ reorder handle (three 18×2 lines, `textDim`), name, native switch. Drag reorders inside the group only, live: the dragged row lifts (`bgElevated`, scale 1.03, shadow) and the other rows slide out of its way while dragging. Metrics with no Health data are dimmed with "No data in Health". Outline "Cancel" drops all changes; primary "Done" saves.
