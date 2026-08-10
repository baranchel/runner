# Chronodrom — Frontend Implementation Spec

Mobile-first running tracker app. Single screen, 420 × 900 px at design time; stretch to device width on real devices.

---

## Design Tokens

### Colors (oklch)
All colors use the oklch color space. Use a CSS utility or Tailwind plugin that supports it.

| Token | Value | Usage |
|---|---|---|
| `bg-app` | `oklch(0.10 0.004 285)` | Page background |
| `bg-card` | `oklch(0.15 0.004 285)` | App shell / nav bars |
| `bg-surface` | `oklch(0.19 0.006 285)` | Cards, inputs |
| `bg-elevated` | `oklch(0.22 0.008 285)` | Dropdowns, table headers |
| `bg-chart` | `oklch(0.18 0.006 285)` | Chart backgrounds |
| `border-subtle` | `oklch(0.24 0.008 285)` | Dividers |
| `border-default` | `oklch(0.26 0.008 285)` | Card borders |
| `border-strong` | `oklch(0.28 0.01 285)` | Input borders |
| `border-input-focus` | `oklch(0.30 0.01 285)` | Input border (un-active) |
| `text-primary` | `oklch(0.97 0.002 285)` | Body text |
| `text-secondary` | `oklch(0.70 0.012 285)` | Secondary labels |
| `text-muted` | `oklch(0.60 0.012 285)` | Metadata |
| `text-dim` | `oklch(0.58 0.012 285)` | Section labels |
| `text-faint` | `oklch(0.55 0.012 285)` | Timestamps |
| `text-ghost` | `oklch(0.50 0.012 285)` | Chevrons, disabled |
| `accent` | `oklch(0.74 0.17 300)` | Purple — links, active tabs |
| `accent-bg` | `oklch(0.64 0.19 300)` | Primary button background |
| `accent-hover` | `oklch(0.70 0.18 300)` | Primary button hover |
| `accent-dim` | `oklch(0.30 0.09 300)` | Avatar, active chip bg |
| `accent-muted` | `oklch(0.40 0.13 300)` | Active filter button |
| `danger` | `oklch(0.62 0.17 25)` | Error text, log out |
| `hr-line` | `oklch(0.62 0.17 25)` | Heart rate chart stroke |
| `elev-line` | `oklch(0.68 0.14 155)` | Elevation chart stroke |

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

Navigate from any run row.

**Back link**: "‹ Back" — 12 px, accent, navigates to Runs screen.

**Run Header**
- Type name — 20 px / 800
- Full date (e.g. "Aug 1, 2026") — 12 px, `text-faint`
- "Synced from Strava" — 12 px, `text-faint`

#### Stats Grid — 3 columns
8 stat cards (3-col grid, gap 10 px):
Distance · Time · Pace · Avg HR · Max HR · Elev gain · Cadence · Calories

Stat card style (same as dashboard but smaller):
```
border-radius: 10px
padding: 12px
label: 10.5px, text-dim
value: JetBrains Mono, 16px / 700
```

#### Charts — 3 charts
Each chart section:
- Section label — 12 px, uppercase, `text-dim`
- SVG `viewBox="0 0 300 100"`, 100% width, 90 px height
- Background card: `bg-chart`, border `border-default`, border-radius 10

**Pace chart**: fill area with type-color (opacity 0.15), stroke with type-color (width 2)

**Heart rate chart**: fill `oklch(0.62 0.17 25)` (opacity 0.15), stroke same (width 2)

**Elevation chart**: fill `oklch(0.68 0.14 155)` (opacity 0.18), stroke same (width 2)

Chart data is generated from stored run data — see Data Model.

#### Splits Table
Section label + table card (border `border-default`, border-radius 10, overflow hidden):

Header row (bg `bg-elevated`, 11 px, `text-dim`): Km · Pace · HR

Data rows (3-col grid `0.6fr 1fr 1fr`, border-top `border-subtle`, 13 px, JetBrains Mono):
One row per km of run distance.

#### Reclassify
Section label + horizontal wrap of type chips (same chip style, single-select, current type is active).
Tapping a chip immediately changes the run's type.

---

### 5. Compare

**Title**: "Compare runs" — 17 px / 700

**Selectors**: 2-column grid of `<select>` dropdowns; each option shows "Aug 1 · Long Run · 21.1km".

**Comparison table** (when both runs selected):
```
border: 1px solid border-default
border-radius: 10px
overflow: hidden
```
Header: Metric · A · B (3-col `1fr 0.8fr 0.8fr`, right-aligned A/B)

Rows (8 metrics): Distance · Duration · Pace · Avg HR · Max HR · Elevation · Cadence · Calories

**Winner highlighting**: the better value in each metric row gets `accent` color + font-weight 700. Lower-is-better for Pace and HR.

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

Charts are generated client-side from run data (no backend needed for chart series).

### Series generator
```ts
function genSeries(seedKey: string, n: number, base: number, variance: number, driftTotal: number): number[]
```
- Uses a deterministic LCG seeded by a hash of `seedKey` so the same run always produces the same chart.
- Generates `n` points starting near `base ± driftTotal/2`, drifting by `driftTotal/n` per step plus random variance.

### Per run — use these calls
```
pace series:      genSeries(run.id + 'pace', 16, timeSec/distanceKm, 14, 0)
heart rate:       genSeries(run.id + 'hr',   16, avgHr - 6,          8,  14)
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
