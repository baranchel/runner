# Chronodrom — Claude Code Guide

## Project

iOS running tracker app. Reads workouts from Apple HealthKit, lets user classify runs by type, filter and compare. Built with Expo (React Native) on Windows via EAS cloud builds.

## Key Files

- `docs/HANDOFF.md` — **read at session start**: current task status, open bugs, decisions from previous sessions.
- `architecture.md` — tech stack, file structure, data model, phase roadmap. Keep updated when architectural decisions change.
- `FRONTEND_SPEC.md` — pixel-level UI spec (colors, typography, layouts, component styles). Source of truth for all visual decisions.
- `docs/superpowers/specs/2026-08-07-surge-implementation-design.md` — full design doc with all phase decisions and rationale.

## Stack (Phase 1)

- **expo-router** — file-based navigation. Screens live in `app/`. Tabs in `app/(tabs)/`.
- **Zustand** — global state. Stores in `src/store/`. One store per domain (runs, run types, user).
- **expo-sqlite** — offline copy + outbox. Schema, queries and sync in `src/db/` (self-check: `node src/db/sync.check.ts`).
- **Supabase** — auth + cloud Postgres. Client and all calls in `src/api/` only; screens/stores import from `src/api/auth.ts`, never `@supabase/supabase-js`. Keys in `.env` (local) and EAS env (builds).
- **@kingstinct/react-native-healthkit** — reads HealthKit workouts. Logic in `src/healthkit/`.
- **react-native-svg** — SVG area/line charts. Shared `Chart` component in `src/components/`.

## Development Workflow

- **Expo Go**: use for all UI work with mock data. Works on Windows → iPhone without any build step.
- **EAS dev build**: installed on Bar's iPhone (2026-11-18). Required for HealthKit and native Google/Apple sign-in. Run with `npx expo start --dev-client`. Rebuild (`eas build --profile development --platform ios`) only after adding native packages or changing `app.json`.
- **Auth email links**: Supabase rejects redirect addresses with an IP host, so in Expo Go use `npx expo start --tunnel` (`exps://`); the dev build uses `chronodrom://`. See `architecture.md` → Development Workflow.
- After switching branches, run `npm install` (branches have different dependencies).
- **EAS production**: `eas build --profile production --platform ios` → TestFlight.

## Design Tokens

Palette comes from the Strides Figma file (dark): https://www.figma.com/design/w6vPmzGQXWbzuI5wPj8S5o/Strides-App. See `FRONTEND_SPEC.md` → Design Tokens for the full table. Key values:
- Background: `#1d172c`
- Cards: `#271f39`
- Accent / text (lavender): `#c4a3ff`
- Highlight (lime): `#d9f879`, with `ink` `#1d172c` text on lavender/lime
- Body font: Inter. Numeric metrics: JetBrains Mono.

## Data Rules

- HealthKit is **read-only**. Never write back to it.
- Supabase Postgres is the source of truth (`supabase/schema.sql`). SQLite is the phone's offline copy of runs + run types plus the outbox (`pending_ops`). Every user change goes through `writeChange` in `src/db/queries.ts`, then `syncNow()` — see `architecture.md` → Sync.
- Manual edits live in `runs.edits` on top of HealthKit data; HealthKit sync must never overwrite them, nor `type_id` / `notes`.
- Deduplication: Apple Health runs use the HealthKit workout UUID as `runs.id`; imports use `writeChange('runs', 'insert', …)`, which inserts only if missing.
- `typeId` is nullable — null means unclassified.

## Conventions

- All monetary/distance/pace display respects `user.unit` ('km' | 'mi') (screens hardcode `'km'` until RA-6 adds the setting; the cloud `profiles.unit` column exists).
- Pace display: `fmtPace(secPerKm)` from `src/utils/format.ts`.
- Chart data is deterministic: same run always produces same chart via seeded LCG in `src/utils/chart.ts`.
- Run type colors: `oklch(0.66 0.17 <hue>)` where hue comes from `RunType.hue`.

## Git

Never run any git commands (git add, git commit, git push, git checkout, etc.). Bar handles all git operations himself. When files are ready to commit, say so and list what changed — nothing more.

## Branch-per-task rule

Every task is done on its own branch. At the start of every session and every new task:
1. Read `.git/HEAD` to check the current branch (file read, not a git command)
2. If on `main` or on the wrong branch for the current task, stop and tell Bar which branch to create or switch to before writing any code
3. Branch names follow the pattern: `feature/<short-task-name>` (e.g. `feature/mock-data`, `feature/app-shell`, `feature/dashboard`)
4. Never write code until the branch check passes

## Phases

- **Phase 1 (now)**: iOS, HealthKit, local SQLite, all screens
- **Phase 2 (started)**: Supabase Auth + Postgres (all calls in `src/api/` only — screens/stores never import Supabase). FastAPI only for the ML `POST /suggest-type` classifier. Strava OAuth.
- **Jira**: project "Run App" (key `RA`) at baranchel.atlassian.net. Tickets carry user stories; write a story into a ticket only after Bar approves the draft.
- **Phase 3**: Android (Health Connect + Google Maps), GPS route map on Run Detail
