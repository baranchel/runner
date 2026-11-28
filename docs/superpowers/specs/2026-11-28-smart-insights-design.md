# Smart Insights (RA-45) — design (2026-11-28)

Branch `feature/smart-insights`. Brainstormed with Bar on 2026-11-27/28. Mockups were shown inline in the chat (feed, running insight screen, lime layout A vs B); there are no mockup files. Builds on the RA-45 part of `2026-11-27-tab-layout-design.md` (vision, voice, guideline rule), which still applies; this spec adds everything else.

## Goal

Replace the Insights tab's Coming soon screen with a feed that tells the user, in plain words, what their runs and Apple Health data show: what changed, by how much, what it usually means, and (where one exists) a general guideline.

## Decisions

| Topic | Decision |
|---|---|
| Insights in v1 | 13: R1–R6 running, H1–H7 health (R7 estimated VO2max dropped). |
| Wording | **Option A**: rule-based sentence builder on the phone. No AI, no calls, no cost, offline, private. |
| Later (B) | Only the wording step is swapped: either a paid cloud LLM or a free open model on the phone (e.g. llama.cpp via `llama.rn`), decided then. Both get the same Findings; our guidelines go in the prompt; output is checked against the same banned-word list; on failure the A sentence is used. |
| RA-15 auto run type | Not an LLM: a tiny on-device classifier (decision tree / nearest neighbours) on per-run features from `src/facts/`. |
| Refresh | **Daily edition**: numbers update immediately (new run, new Health data); the wording is fixed for the day and changes the next day. |
| Nothing changed | **Always shown** with *steady* wording, ranked lower. Hidden only when there is too little data. |
| Tap | Health insights → existing `app/insight/[key].tsx`. Running insights → one new shared screen `app/insight-run/[key].tsx`. |
| Lime | **Layout A**: one lime hero card; the top running card and the top health card get a lime outline when notable. Never three solid lime cards in a row. |

## Architecture

```
runs (SQLite) ─┐                ┌─> ranking ─┐
               ├─> facts layer ─┤            ├─> feed (Insights tab)
Health (live) ─┘   src/facts/   └─> wording ─┘    + running insight screen
                                    src/insights/phrases.ts
```

- **`src/facts/`** (new, pure, no React Native): numbers only, no wording. Per-run features (pace, zone seconds via `zoneTimes`, load, max HR, steps-day flag) and per-period series (monthly efficiency pace, weekly Z2 share, weekly load, runs per week, longest run per month, highest HR per month). Reusable by RA-15 later. Self-check `node src/facts/facts.check.ts`.
- **`src/insights/rules.ts`** (new, pure): one rule per insight. Input: facts + Health `MetricData` + zone starts + today. Output: `null` (too little data) or a **Finding**:
  ```ts
  interface Finding {
    key: InsightKey            // 'efficiency' | 'z2Share' | 'load' | 'longest' | 'streak' | 'hrMax' | 'restingHr' | 'hrv' | 'sleep' | 'steps' | 'vo2max' | 'stepsRunDays' | 'sleepBeforeSlow' | merged keys
    side: 'running' | 'health'
    direction: 'up' | 'down' | 'steady' | 'record' | 'streak'
    score: number              // |change| ÷ steady threshold; < 1 = steady; records/streaks = 2
    boost: boolean             // resting HR / HRV health signal
    values: Record<string, number | string>   // slot values: from, to, delta, period, since, weeks…
    series: Point[]            // sparkline + detail chart
    runIds?: string[]          // running insights: the runs it is based on
    method?: string            // running insights: "How this is worked out" text
  }
  ```
  Self-check `node src/insights/rules.check.ts`.
- **`src/insights/rank.ts`** (or inside `rules.ts` if small): links, ordering, hero / accent marking.
- **`src/insights/phrases.ts`** (new, pure): Finding + date → `{ eyebrow, headline, meaning?, guideline? }`. Self-check `node src/insights/phrases.check.ts`.
- **Data:** nothing new stored, no Supabase or SQLite change. Runs from `useRunStore`; Health from `useInsightsStore` (already 91 days daily). **One extra read:** 365 days of daily steps (H4 record), kept in memory in `useInsightsStore` like the rest. The feed is computed in memory (`useMemo`) on the tab.

## Rules

Shared:
- Each rule has a minimum amount of data; below it the card is hidden; above it the card always shows.
- **Score** = size of the change ÷ the rule's steady threshold. Score < 1 → `steady`. Records and streaks score 2.
- **Boost:** resting HR up ≥ 5 bpm, or HRV down ≥ 15%, sets `boost` → ranked above everything else.
- **"Your normal"** (health): mean of the 30 days **before** the last 7 (days 8–37).
- **Z2** = the user's own zones (`useZoneStarts()`), never a fixed bpm.
- Windows are counted back from today, today included.

| # | Key | Compares | Minimum data | Steady when | Guideline |
|---|---|---|---|---|---|
| R1 | `efficiency` | Median pace of runs ≥ 2 km whose avg HR is in Z2: last 30 days vs days 61–90 | 3 such runs in each window | < 5 s/km | — |
| R2 | `z2Share` | % of running time in Z2 (`sumZoneTimes`): last 30 days vs prior 30 | 3 runs with HR in each | < 5 points | "Many endurance training plans keep about 80% of running easy." |
| R3 | `load` | Load of the last 7 days vs mean weekly load of the 4 weeks before. Load = Σ minutes in zone × zone number (Z1 = 1 … Z5 = 5) | runs spanning 5 weeks | ± 15% | — |
| R4 | `longest` | Longest run in the last 30 days. `record` when it is the longest since an earlier date ("since March"; "ever" if no longer run exists) | 1 run in 30 days, 60 days of history | no record | — |
| R5 | `streak` | Weeks in a row (Mon–Sun, current week counts once it reaches the target) with ≥ usual runs/week (median of the last 8 full weeks, min 1) | 4 weeks of history | streak < 3 weeks | — |
| R6 | `hrMax` | Highest HR this calendar month vs highest of the 3 months before. Score × 0.5 (ranked low) | 3 months of runs with HR | ± 3 bpm | — |
| H1 | `restingHr` | Mean of last 7 days vs normal | 5 of 7 days, 20 of 30 | ± 2 bpm | — |
| H2 | `hrv` | Mean of last 7 days vs normal (in %) | 5 of 7, 20 of 30 | ± 10% | — |
| H3 | `sleep` | Mean asleep per night, last 7 nights vs normal | 5 of 7, 20 of 30 | ± 20 min | "Adults are generally advised to get 7 or more hours of sleep a night." (CDC / AASM) |
| H4 | `steps` | Daily mean, last 30 days vs prior 30. `record` when it is the highest or lowest 30-day mean of the last 12 months ("your most active month since June") | 20 days in each 30-day window | ± 10% | — (no official steps number) |
| H5 | `vo2max` | Latest reading vs oldest reading within 90 days | 2 readings ≥ 60 days apart | ± 0.5 | — |
| H6 | `stepsRunDays` | Mean steps on run days vs non-run days, last 30 days | 4 days of each | < 1,000 | — |
| H7 | `sleepBeforeSlow` | Mean sleep the night before runs slower than the median pace of their run type vs before the other runs, last 91 days | 10 runs with a sleep night before (unclassified runs grouped together) | < 30 min | — |

**Links** (one merged card replaces both; score = the higher of the two; boost carries over):
- `restingHr` + `sleep`: resting HR not steady and up, sleep not steady and down.
- `load` + `hrv`: load not steady and up, HRV not steady and down.

**Known limits (accepted):** R1 ignores heat and hills (median softens one-offs). H6 includes the run's own steps; its meaning line says so. H7 is a link, never a cause: wording says "on nights before", never "because".

## Ranking and layout (layout A)

1. Boosted findings first (by score), then the rest by score.
2. **Hero** = the first finding → full lime card (`highlight` bg, `ink` text, slightly larger headline). The hero shows even when every finding is steady.
3. The rest: **running group, then health group**, each sorted by score, separated by extra spacing, no headers. The hero is not repeated.
4. **Accent:** the first card of each group gets a lime outline (1 px `highlight` border), lime eyebrow, lime evidence numbers and lime sparkline — only when its score ≥ 1. Otherwise all cards are plain dark (`bgCard`).
5. So at most one solid lime card and two outlined ones per screen. Update the lime rule in `CLAUDE.md` and `FRONTEND_SPEC.md`: lime fill = the single most important card; a lime outline = the next level.

## Wording engine (option A)

- **Slots:** `[subject] [change] [size] [timeframe]` → headline; evidence line from `values` (e.g. "5:41 → 5:29 /km"); eyebrow = metric · period ("EFFICIENCY · 3 MONTHS").
- **Phrase sets per insight × direction**, 6–8 phrasings each, plus number-first variants ("12 s/km quicker at the same heart rate") and own sets for the two merged cards. Several hundred short strings in `phrases.ts`.
- **Meaning line:** per insight × direction, voice B ("…usually means your aerobic base is growing"), 2–3 versions each. Left out for steady findings where it adds nothing (decided per insight, in the phrase table).
- **Guideline line:** fixed text, only R2 and H3, source in a code comment. Never rotated.
- **Daily edition:** phrasing index = hash(`YYYY-MM-DD` + key). Cards are worded in feed order; if a card's opening (first slot phrasing) was already used today, the next index is taken. Same date → same text.
- **Voice rules:** facts + what it usually means; never a verdict, never advice, health careful (nothing medical). The phrase lists are the only words that can appear.
- **Banned-word scan** (`phrases.check.ts`, reused by B later; whole words, case-insensitive): should, need, must, good, bad, great, poor, risk, warning, danger, injury, illness, sick, healthy, unhealthy, recommend, try.
- **Numbers:** `fmtPace`, `fmtDistance`, `fmtHMM`, `fmtNum`; km until RA-6.

## Screens

**Insights tab** (`app/(tabs)/insights.tsx`, replaces Coming soon)
- Title "Insights", subtitle "What your data says this week" (`textSecondary`).
- Card: eyebrow · headline · meaning (if any) · guideline (if any) · evidence (JetBrains Mono) left + sparkline right · `›`. Styles per layout A above.
- Pull to refresh → `useInsightsStore.load(true)` + recompute. Running cards render from SQLite without waiting for Health; health cards appear when Health has loaded.
- **No card has enough data:** one line, centred, `textSecondary`: "Insights appear once you have a few weeks of runs and Apple Health data."
- **Health not allowed / no Health data at all:** running cards only, plus a row "Allow Apple Health to see health insights ›" → iOS Settings (`Linking.openSettings()`, same as the Health tab: iOS never asks twice).
- Steps windows (H4, H6) end **yesterday**: today's step count is still growing.
- Remove the "Your health cards moved to the Health tab." line with the Coming soon screen.

**Running insight screen** (`app/insight-run/[key].tsx`, new, shared by R1–R6 and the `load`+`hrv` merged card)
- Back arrow + eyebrow; headline; meaning line (same text as the card that day).
- Big chart of `series` with the shared `Chart` component (bucket per insight: month for R1/R4/R6, week for R2/R3/R5).
- "How this is worked out: …" (`method`, e.g. "Median pace of runs of 2 km or more whose average HR was in your Z2 (136–150 bpm).").
- "Runs it's based on": existing run rows for `runIds`, newest first; tap → Run detail.
- Health insights open `app/insight/[key].tsx` (`restingHr`, `hrv`, `sleep`, `steps`, `vo2max`; `stepsRunDays` → steps; `sleepBeforeSlow` → sleep; `restingHr`+`sleep` → restingHr).

## Testing

- `node src/facts/facts.check.ts`: per-run features and series on fixture runs (Z2 detection with given zone starts, load, weeks, medians).
- `node src/insights/rules.check.ts`: each rule's minimum data (null below), steady/up/down/record/streak, thresholds, score, boost, both links, ranking, hero + accent marking.
- `node src/insights/phrases.check.ts`: every phrase fills all its slots (no leftover `{…}`), banned-word scan over every string, same date → same text, two cards on one day never share an opening, guideline only on R2/H3.
- `npx tsc --noEmit`.
- Device test (Bar): real data feed, tap-through to both detail screens, pull to refresh, next-day wording change, Health access denied path.

## Docs to update in this branch

- `CLAUDE.md`: Insights line (feed, `src/facts/`, checks), lime rule (fill vs outline).
- `FRONTEND_SPEC.md`: Insights feed, card styles, running insight screen; lime rule.
- `architecture.md`: `src/facts/`, rules / phrases, B and RA-15 notes.
- `docs/HANDOFF.md`.
- **Jira RA-45** (draft for Bar's approval first): two sections → one feed; "facts only" → voice B; lime only for these cards → layout A; weekly overview dropped; list of the 13 insights; option A now, B later.

## Out of scope

- Option B (any LLM), RA-15 classifier.
- R7 estimated VO2max, coaching / suggestions, notifications.
- Storing insights or their history; mi units (RA-6).
