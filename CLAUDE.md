# SURGE — Claude Code Guide

## Project

iOS running tracker app. Reads workouts from Apple HealthKit, lets user classify runs by type, filter and compare. Built with Expo (React Native) on Windows via EAS cloud builds.

## Key Files

- `architecture.md` — tech stack, file structure, data model, phase roadmap. Keep updated when architectural decisions change.
- `FRONTEND_SPEC.md` — pixel-level UI spec (colors, typography, layouts, component styles). Source of truth for all visual decisions.
- `docs/superpowers/specs/2026-08-07-surge-implementation-design.md` — full design doc with all phase decisions and rationale.

## Stack (Phase 1)

- **expo-router** — file-based navigation. Screens live in `app/`. Tabs in `app/(tabs)/`.
- **Zustand** — global state. Stores in `src/store/`. One store per domain (runs, run types, user).
- **expo-sqlite** — local persistence. Schema + queries in `src/db/`.
- **@kingstinct/react-native-healthkit** — reads HealthKit workouts. Logic in `src/healthkit/`.
- **react-native-svg** — SVG area/line charts. Shared `Chart` component in `src/components/`.

## Development Workflow

- **Expo Go**: use for all UI work with mock data. Works on Windows → iPhone without any build step.
- **EAS dev build**: required for HealthKit. Run `eas build --profile development --platform ios` once, install `.ipa` on iPhone. Live reload continues over Wi-Fi after that.
- **EAS production**: `eas build --profile production --platform ios` → TestFlight.

## Design Tokens

All colors use oklch. See `FRONTEND_SPEC.md` → Design Tokens for the full table. Key values:
- Background: `oklch(0.10 0.004 285)`
- Cards: `oklch(0.19 0.006 285)`
- Accent (purple): `oklch(0.74 0.17 300)`
- Body font: Inter. Numeric metrics: JetBrains Mono.

## Data Rules

- HealthKit is **read-only**. Never write back to it.
- SQLite stores only: run type classification, notes, and RunType definitions.
- Deduplication: check `healthkitUuid` before inserting a run from HealthKit.
- `typeId` is nullable — null means unclassified.

## Conventions

- All monetary/distance/pace display respects `user.unit` ('km' | 'mi') from `useUserStore`.
- Pace display: `fmtPace(secPerKm)` from `src/utils/format.ts`.
- Chart data is deterministic: same run always produces same chart via seeded LCG in `src/utils/chart.ts`.
- Run type colors: `oklch(0.66 0.17 <hue>)` where hue comes from `RunType.hue`.

## Git

Never run any git commands (git add, git commit, git push, git checkout, etc.). Bar handles all git operations himself. When files are ready to commit, say so and list what changed — nothing more.

## Phases

- **Phase 1 (now)**: iOS, HealthKit, local SQLite, all screens
- **Phase 2**: FastAPI Python backend (`POST /suggest-type` ML classifier), Strava OAuth
- **Phase 3**: Android (Health Connect + Google Maps), GPS route map on Run Detail
