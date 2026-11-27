# Tab layout — design (2026-11-27)

Branch `feature/tab-layout`. Brainstormed with Bar on 2026-11-27. Mockups were shown inline in the chat (Dashboard in 6 scenarios, Insights feed + Coming soon, More); there are no mockup files.

## Goal

Restructure the bottom tabs so that each tab has one clear job, before more Dashboard / Insights work lands (RA-45, RA-23, RA-44).

## Tab bar

Left → right: **Insights · Health · Dashboard · Runs · More**. The app opens on **Dashboard** (middle).

| Tab | Job | Comes from |
|---|---|---|
| Insights | What you can understand from your data (RA-45) | New. Until RA-45 ships: Coming soon screen |
| Health | Apple Health metric cards | Today's Insights tab (RA-29), moved as is |
| Dashboard | Running only: summary, new run, last runs | Today's "Running" tab |
| Runs | Browse, search, filter, Set type, compare | Today's "All runs" tab |
| More | Profile card + settings | Today's "You" tab |

- **Compare tab is removed.** You compare from Runs (compare button → pick 2) or from Run detail. `CompareView` stays (used by `/compare/result`).
- Opening on the middle tab: `initialRouteName="dashboard"` on `<Tabs>`, plus `app/index.tsx` already redirects to `/(tabs)/dashboard`.
- **Icons** (the bar has labels only today): one icon per tab. The middle tab gets a distinct "home" look so it reads as the main tab: icon in a filled lavender (`accent`) circle with an `ink` glyph when active. Icon source (Bar, 2026-11-27): **PNG icons**, same style as `assets/compare.png` (black outline on transparent, 512 × 512), drawn with `<Image>` + `tintColor` (active `accent`, inactive `textGhost`; middle tab active = `ink` glyph in the lavender circle). **Runs** reuses `assets/icon.png` (the runner, also the app icon — if the app icon changes, copy the runner to its own file). Bar provides `assets/tab-insights.png`, `assets/tab-health.png`, `assets/tab-dashboard.png`, `assets/tab-more.png`. More rows: `heart-rate.png` exists for Heart-rate zones; `shoe.png`, `apple-health.png`, `logout.png`, `delete.png` from Bar, otherwise those rows go without an icon. Coming soon tile uses `tab-insights.png`. `@expo/vector-icons` is not installed and is not added.
- Rejected: 4 tabs with All runs inside Dashboard (Bar wants it one tap away); names Running / All runs (too alike), History, Today.

## Lime rule (changes CLAUDE.md + FRONTEND_SPEC.md)

Old: lime is reserved for insight cards. **New: lime marks the most important card(s) on a screen**, on any tab. Lavender (`accent`, ink text) stays the second highlight colour (This week card, reached target, profile card).

## Dashboard

Running only. Top → bottom:

1. **Target card** — only when the user has a target. **Waits for RA-23** (targets are not built); this branch builds nothing for it.
   - In progress: lime. Eyebrow "NOVEMBER TARGET", "3 days left" right; mono "112 / 150 km"; ink progress bar; "75% · 38 km to go".
   - Reached: filled lavender + ink text + "✓ Reached" ink pill; "Reached on 24 Nov". How long "reached" stays → RA-23.
2. **New run card** (RA-39) — **turns dark**: `bgSurface` background, 1 px lime border, text `textPrimary`, lime "Choose type ▾" button with ink text, "Set all N ›" link in lime. Keeps lime for the summary. Bar may later turn this into a notification (not decided, own ticket).
3. **Shoe alert cards** (RA-8) — unchanged, same place.
4. **Last 30 days** (lime) — unchanged content. **Moves above This week.** It is the Dashboard's main idea.
5. **This week** (lavender) — unchanged.
6. **Recent runs** — last **4**; header link "See all →" becomes **"All runs ›"** and opens the Runs tab.

With a target reached there are two lavender cards (target, week) with the lime card between them. Accepted; if it looks heavy on device, This week goes dark while a target is reached.

**New user (no runs):** the cards keep showing zeros, and Recent runs shows one line instead of the list: "Your first run from Apple Health will show up here." (`textSecondary`, centered).

## Insights

### This branch
The tab shows a **Coming soon** screen: title "Insights", centered bulb icon in a `bgSurface` tile, "Coming soon", "Insights will explain what your running and health data mean, in plain words." and a small line "Your health cards moved to the Health tab." No data loading.

### RA-45 design (recorded here, built in RA-45)
- **Vision:** "this is what you can understand from your data" — the user's data told in a friendlier way, with analysis.
- **No weekly overview** — it duplicates Dashboard's This week. Insights only holds things the app works out.
- **One feed, no headers:** the top 2–3 most notable insights (running or health) as **lime** cards; then the rest as **dark** (`bgSurface`) cards, running first, then health, separated only by extra spacing. A top insight is not repeated below. An insight with too little data is not shown.
- **Ranking:** score = how far the value is from the user's own normal (e.g. vs their 30-day average). A short list of health signals (resting HR well above normal, HRV well below) gets a fixed boost to the top. No ML.
- **Card:** eyebrow (metric · period, e.g. "RESTING HR · 7 DAYS") · headline fact (one sentence) · meaning line · guideline line · evidence ("58 → 65 bpm") + sparkline · › opens the related chart. Meaning and guideline lines appear only where they add something, decided per insight type (not by position).
- **Voice:** fact + what it usually means ("…usually means your aerobic base is growing"). Never a verdict on the user, never advice. Coaching/suggestions: Bar decides later. RA-45's "facts only" rule changes to this.
- **Health stays careful:** fact + neutral meaning, nothing that sounds medical.
- **Guideline line:** only where a widely accepted guideline exists (sleep hours, steps, maybe easy-run share); about people in general ("Adults are generally advised to get 7 or more hours"), never "you should"; written in advance per insight type from a small checked list with the source noted in code; never generated. None for resting HR / HRV.

## Health

Today's Insights screen, **moved as is**: title "Your body, over time.", 6 groups (Heart, Fitness, Running form, Sleep & recovery, Body, Activity), Edit (hide / reorder), detail screens. Only the tab label and file name change. Internal names (`useInsightsStore`, `src/insights/`, `app/insight/[key].tsx`, `app/insights-edit.tsx`, `profiles.insights_layout`) stay — renaming them buys nothing.

## Runs

Today's All runs screen, **unchanged**. Tab label "Runs", screen title stays "All runs". The compare button next to search is now the main way into compare.

Not in this branch: **Group by month / all time** — written into RA-17 (Add Sub-Filter) on 2026-11-27. Search stays RA-35.

## More

Replaces You. Title "More". Top → bottom:

1. **Profile card** — filled lavender, ink text, radius 20: initials circle (46, ink fill, lavender text) · first + last name (15 / 700) · "Personal info" (11, ink 75%) · ›. Tap → Personal info (edit mode). Achievements and goals get added to the card later (RA-23 / RA-37).
2. **Grouped rows** (iOS style): small grey uppercase label above each group, rows in one `bgSurface` block radius 14 with 1 px dividers, icon (accent) · label · ›.
   - **Training:** Heart-rate zones
   - **Gear:** My shoes (later: My devices, RA-12)
   - **Connections:** Apple Health (shows "Connected", or opens Connect Apple Health) (later: Strava)
   - **App:** later Preferences (RA-6), App tour (RA-44) — hidden while empty
   - **Account:** Log out · Delete account (danger colour; same type-DELETE confirm as today)

The card replaces the old Personal info row. A group with no rows is not shown.

## Files (this branch)

| File | Change |
|---|---|
| `app/(tabs)/_layout.tsx` | New order, labels, `initialRouteName`, icons, middle-tab style |
| `app/(tabs)/insights.tsx` → `app/(tabs)/health.tsx` | Moved as is |
| `app/(tabs)/insights.tsx` | New: Coming soon screen |
| `app/(tabs)/compare.tsx` | Deleted |
| `app/(tabs)/settings.tsx` → `app/(tabs)/more.tsx` | Profile card + grouped rows |
| `app/(tabs)/dashboard.tsx` | Card order, dark New run card, "All runs ›", empty-state line |
| `CLAUDE.md`, `FRONTEND_SPEC.md`, `architecture.md` | Lime rule, tab bar, file tree |

Existing links keep working: `/runs` (Dashboard "Set all", Run detail "Choose from all runs"), `/(tabs)/dashboard` (`app/index.tsx`), `/insight/<key>`, `/insights-edit`, `/compare/result`. Check for any link to `/compare` (tab), `/settings` or `/insights` that meant the old screens.

## Out of scope

RA-45 insight logic, RA-23 target card, RA-17 Group by, RA-35 search, notifications for new runs, achievements and goals on the profile card.

## Testing

No new pure logic → no new self-check. `npx tsc --noEmit` passes; existing self-checks still pass. Device test (Expo Go): app opens on Dashboard; all 5 tabs open; Dashboard card order and dark New run card (with a run that needs a type); "All runs ›" opens Runs; Set all / Choose from all runs still land in Runs in the right mode; Health cards, Edit and detail screens work; Insights shows Coming soon; More profile card opens Personal info; all More rows work, incl. Log out and Delete account cancel.
