# Chronodrom — Session Handoff (2026-11-25)

Read this first, together with `CLAUDE.md` and `architecture.md`. It captures the state of work and the decisions made in the previous Claude Code (CLI) session, which a new session cannot see.

## Working rules (from Bar — always apply)

- **Never run git commands.** Bar commits himself. When he says "ready to commit", write the commands for him to run: several commits split by subject, then push. Changes reach `main` through PRs, never a local merge. **No `Co-Authored-By` / AI attribution** in commit messages or PR descriptions.
- **Branch check first:** read `.git/HEAD` (file read, not git). Branch per task, `feature/<name>`. Wrong branch → stop and tell Bar.
- **Subagents:** Sonnet minimum, never Haiku.
- **Jira:** write a user story into a ticket only after Bar approves the draft.
- Keep `architecture.md` and `CLAUDE.md` updated after design decisions.
- Bar works on Windows (no Mac), tests on his iPhone via Expo Go / EAS dev build. Explain concepts alongside technical decisions.
- Never generate image assets — ask Bar for them.

## Next session: start here (updated 2026-11-27)

### Current stage

- **`main` has:** RA-29 Insights, RA-39 run type (`feature/run-type`) and RA-8 Shoes (`feature/shoes`), merged 2026-11-25 and device-tested. SQLite is **v9**.
- **RA-22 Zones Summary (`feature/month-zones`):** done, device-tested 2026-11-27, pushed; PR to `main` open/next. Start the next branch from `main` **after** that PR is merged (`npm install` after switching).
- **Shoes left-overs for Bar:** make sure both shoe migrations ran (`2026-11-24-shoes.sql`, then `2026-11-24-shoe-catalogue.sql`) and upload `hoka.png` + `topo-athletic.png` from `assets/brand-logos/` to the `brand-logos` bucket (the other 19 are up).
- **RA-24 white flash on logout:** no longer happens; Bar handles the ticket.
- **Git note:** Bar's `git pull` rebases by default. To bring `main` into a pushed branch use `git pull --no-rebase origin main`; never `--amend` a pushed commit.
- **Jira open:** RA-42 Run Sub-Type (reps × distance / distance / sets on the run), RA-43 cadence + stride on the run screen, RA-44 first-run tour, RA-45 Smart Insights (+ tab-restructure idea), RA-35 Search, RA-15 auto-suggest type, RA-6 units, RA-40 interval step names spike.

### Next task (Bar chose 2026-11-27): tab restructure

Brainstorm first (mockups, no code, no branch needed), then branch `feature/tab-layout` from `main` after the RA-22 PR is merged (it edits `dashboard.tsx` again). Then **RA-45 Smart Insights**. Idea in RA-45: Insights = insights only · Dashboard = health data + basic running · Running = extended running + last runs · More replaces You. It decides where the RA-29 cards, the Dashboard cards (New run, shoe alerts) and RA-44's tour go, so it's best settled before more Dashboard work.

### Other suggested tasks

1. **RA-42 Run Sub-Type**: builds on run types (reps × distance / distance / sets).
2. **RA-35 Search** in All runs (the box is a placeholder) / **RA-15 auto-suggest run type** (reuses `pickRunType` and the New run card).
3. **RA-43 cadence + stride**: stride needs a new Health type → new dev build.
4. Later: RA-6 units (km/mi), RA-44 app tour (after the tab layout is settled), RA-40 spike.

Shoes follow-ups (minor, no ticket yet): a deleted shoe stays on a second signed-in device until logout/in (no tombstone); moving a run off a shoe doesn't lower its alert levels; Metro "Require cycle" warning `useRunStore` ↔ `src/shoes/alerts.ts` (harmless).

## Done: RA-22 Zones Summary — `feature/month-zones` (device-tested 2026-11-27)

Claude session name: `feature/month-zones`.

- Spec `docs/superpowers/specs/2026-11-27-month-zones-design.md`, plan `docs/superpowers/plans/2026-11-27-month-zones.md`. Mockups (gitignored) `.superpowers/brainstorm/1651-1795798211/content/`.
- **Decisions with Bar (2026-11-27):** Dashboard part lives **inside the Last 30 days card** and covers the **last 30 days** (`inLast30Days`, same window as the card), not the calendar month; no comparison with the previous 30 days. Design C: one bar per zone, % only. Own run-type pill (zones only, resets on restart). All runs month header: new right-aligned line `● Z2 64% · ● Z3 22%` (option A), follows the type filter; second zone only when ≥ 1%. Compare picker shows the same header line.
- **State:** implemented, `zones.check` / `compare.check` / tsc pass. **Device-tested 2026-11-27 (Bar), all pass.** Committed and pushed; merge via PR.
- **Jira RA-22:** description updated 2026-11-27 (Bar approved): last 30 days inside the Last 30 days card, ≥ 1% rule, empty-state text.

Other open items: RA-35 Search (the All runs search box is a placeholder; wait for RA-39 merge, same file); RA-15 auto-suggest (reuses `pickRunType` and the Dashboard card, needs RA-39 in `main`).

## Big decisions made (2026-11-08)

1. **Phase 2 started: Supabase** for auth + cloud Postgres. FastAPI kept only for the future ML `/suggest-type` classifier. Supabase project ref `cbbalftydzsfbqategub` (Frankfurt, free tier). Keys live in `.env` (gitignored): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (publishable key — never the secret/service_role key).
2. **Boundary rule:** only `src/api/` imports `@supabase/supabase-js`. Screens/stores import from `src/api/auth.ts`.
3. **DB stores a full copy of every run** (summary, splits, segments, zones, weather) forever — ~1–2 KB/run, no 1-year window. Raw HR/GPS streams not stored yet (decide in Phase 3).
4. **Offline support** is required (RA-34).
5. **Login:** email+password with confirmation, native Google, native Apple (App Store 4.8 requires Apple when Google is offered), in-app account deletion (App Store 5.1.1). DOB removed from signup — it moves to the personal-info form.
6. **Onboarding flow (target):** Signup → Health permission (RA-3) → Personal info form prefilled from HealthKit (RA-11) → Dashboard.
7. GitHub CI workflow disabled (manual-trigger only) in `.github/workflows/ci.yml` — Bar has no GitHub subscription.

## Roadmap (foundation order)

| # | Branch | Jira | Status |
|---|---|---|---|
| 1 | `feature/user-auth` | RA-18 Login | **Done**, merged |
| 2 | `feature/manage-db` | RA-34 Manage DB | **Done**, merged 2026-11-20 (see RA-34 section) |
| 3 | `feature/healthkit` | RA-3 Apple Connectivity | **Committed, not merged** — only test left: a new run (2026-11-21) via pull to refresh. Pass → merge into `main`. |
| 4 | `feature/add-personal-info` | RA-11 Personal Info + RA-10 Edit Profile | **Done 2026-11-21, device-tested, committed** (see section below). Branched from `feature/healthkit`. |
| 5 | `feature/hr-zones` | RA-9 Custom HR Zones (4 methods + preview) + most of RA-21 | **Done 2026-11-22, device-tested, matches Fitness; real HR chart fix included.** Committed + pushed, Jira updated. PR after `feature/add-personal-info`. |
| 6 | `feature/run-type` | RA-39 Set Run Type Manually (+ new-run card, bulk Set type) | **Done, fully device-tested** (real new Watch run passed 2026-11-24). Merged 2026-11-25. See section below. |
| 7 | `feature/shoes` | RA-8 Shoes (catalogue, logos, defaults, alerts, delete) | **Done**, merged 2026-11-25, device-tested. See section below. |

**Merge order (stacked branches):** `feature/healthkit` → `main` (Bar, 2026-11-22, after the new-run test), then `feature/add-personal-info` → `main`, then `feature/hr-zones` → `main`. Each branch contains the one before it, so merging in this order keeps every PR small. A fix needed in an earlier branch goes on that branch, then gets merged forward into the later ones.

## Jira

Site `baranchel.atlassian.net`, project **Run App** (key `RA`), cloudId `0b1d9b12-7ac5-4f49-9460-7a62e28ffb36`. Accessed through the claude.ai Atlassian connector.
- **All tickets have content (2026-11-18 session with Bar).** Key decisions captured in the tickets:
  - New story **RA-38 Insights** (Insights tab): RA-29 More Health Data + RA-31 VO2max moved under it. Apple Health metrics first, calculated metrics/race predictions at the end.
  - **Merged/dropped (Bar closes them in Jira):** RA-19 → RA-6 Preferences; RA-30 → RA-12 My Devices; RA-32 dropped (goals live in RA-23, the app never plans runs).
  - RA-21: changing zones recalculates past runs (HR re-read from Apple Health). Zone names will be renamed later.
  - RA-9: 4 zone methods (% HRmax default, Karvonen, LTHR, manual), always 5 zones, chart preview per method.
  - RA-11: required first/last name + DOB; everything else optional and prefilled from Health.
  - RA-8 Shoes: own brand/model/recommended-km catalogue in Supabase (no public API exists), default shoe per run type, 90% alert.
  - RA-15: suggest type with confirm/change, learns per user; past-runs backfill undecided.
  - RA-20 social and RA-31 predictions are end-of-roadmap. RA-4 Design stays open until the end.

## Done: RA-18 User Auth — `feature/user-auth` (merged)

- Spec: `docs/superpowers/specs/2026-11-08-user-auth-design.md`
- Plan: `docs/superpowers/plans/2026-11-08-user-auth.md` (6 tasks), executed with subagent-driven development (implementer → spec review → code-quality review per task, then stop for Bar to test and commit).

### Supabase dashboard setup already done by Bar
- Site URL `chronodrom://`; Redirect URLs `chronodrom://**`, `exp://**`
- Email confirmation ON (built-in mailer, low rate limit — fine for now)
- `public.delete_account()` SQL function created
- Google Cloud project created; OAuth client IDs:
  - iOS: `150562947459-mr8v6bn2bkmerq1b7cb2n72om2evk8jq.apps.googleusercontent.com`
  - Web (for Supabase): `150562947459-3d95s7d53cvgfoj7v7ik2qdncgv5gfeb.apps.googleusercontent.com`
  - (Supabase Google/Apple provider config is plan Task 5 Step 2 — not confirmed done yet.)
- Bar has a paid Apple Developer account.

### Task status
- **Task 1 — DONE**, reviewed, tested on iPhone (commit status unknown — ask Bar). Supabase client, error mapping (+ `node src/api/authErrors.check.ts` self-check), `useAuthStore`, auth gate. Deviation from plan after review: `app/_layout.tsx` always renders the `Stack`; a `SplashGate` component holds the splash; guards are `!loading && !session` / `!loading && !!session`; `app/index.tsx` returns null while loading.
- **Task 2 — DONE (2026-11-18), tested on iPhone end to end** (signup → email → link → logged in, via `npx expo start --tunnel`). Custom SMTP set up (Gmail app password, smtp.gmail.com:587, email rate limit 30/h). TEMP logs removed. History of the bug below.
- (old) Task 2 — implemented + reviewed, was blocked on device test. Email signup (no DOB), login, resend, "check your email", `app/auth-callback.tsx`. Review fixes applied: `EMAIL_NOT_CONFIRMED` shared constant; signup resend double-tap guard. Commit status unknown — ask Bar.
  - **Open bug:** the confirmation email link had `redirect_to=chronodrom://` (the Site URL fallback) instead of the Expo Go URL `exp://<ip>:8081/--/auth-callback`, so Safari errored. Supabase rejected the requested redirect even though `exp://**` is in the allow-list.
  - **Suggested fix (waiting for Bar's result):** add the exact Expo Go address from the Metro line (`Metro waiting on exp://192.168.x.x:8081`) as `exp://192.168.x.x:8081/--/**` in Redirect URLs, verify entries have no spaces and are saved, then sign up again / resend. If still failing: get the Metro line + a screenshot of the Redirect URL list; consider logging `Linking.createURL('auth-callback')` from `signUp`.
  - **2026-11-16 update (desktop session):** Bar added `exp://192.168.68.62:8081/--/**` to Redirect URLs (list now: `chronodrom://**`, `exp://**`, that one). Temporary log in `src/api/auth.ts` `linkTo()` printed `exp://192.168.68.62:8081/--/auth-callback`, which matches the allow-list. The email Bar tapped still said `redirect_to=chronodrom://`, but Supabase was rate-limiting ("too many attempts"), so no new email was sent. That link was most likely from an older email sent before the entry was added. **Next:** once the rate limit resets, check that Metro still shows the same IP, sign up with a new `+alias`, and check `redirect_to=` in the email. If it works, remove the `// TEMP` log in `linkTo()`. If it still says `chronodrom://`, collect the full link and the `[auth]` log line.
  - **2026-11-18 ROOT CAUSE FOUND:** Supabase rejects every redirect whose host is an IP address (`exp://192.168.68.61…`, `exp://10.…`, `exp://8.8.8.8…`), whatever the allow-list says. Hostnames pass `exp://**` (`exp://localhost…`, `exp://x.exp.direct/--/…`, `chronodrom://auth-callback` all accepted). Proven without sending email: `GET /auth/v1/verify?token=pkce_invalidprobe&type=signup&redirect_to=<url>` replies 303 to the accepted redirect, or to `chronodrom:` when the URL is rejected. **Fix:** test email links with `npx expo start --tunnel` (Expo 58 tunnel URL is `exps://<name>.on.expo.app/--/auth-callback`, so Redirect URLs needs `exps://**` as well as `exp://**`. The tunnel also needs `ws` ^8 in devDependencies because of a ws 7/8 clash in Expo's packages) or in the EAS dev build (`chronodrom://auth-callback`). No code change needed. The IP-specific Redirect URL entries are useless and can be deleted.
  - **State at end of 2026-11-18:** `exps://**` added to Redirect URLs and verified accepted (probe). Redirect URLs are now `chronodrom://**`, `exp://**`, `exps://**` (+ old IP entries, safe to delete). Last real email (11:43) was sent before `exps://**` existed, then the built-in mailer hit its limit (429). **Next:** Bar sets up custom SMTP (Gmail app password for dev: smtp.gmail.com:587; Resend + own domain before launch, because the built-in mailer only delivers to Supabase team members) and raises Rate Limits → emails/hour. Then with `npx expo start --tunnel` running, sign up once with a new alias, check `redirect_to=exps://…`, tap it, and confirm the dashboard opens logged in. Then remove the `// TEMP` log in `src/api/auth.ts` → Task 2 done.
  - **2026-11-18 later:** Email link now opens auth-callback in Expo Go (redirect fixed, password login works over tunnel). The code exchange failed: iOS cancelled the request (`fetch failed: cancelled`) while the app was waking from Safari, and auth-js **deletes the PKCE verifier on any failed exchange** (GoTrueClient `_exchangeCodeForSession` catch block), so no retry is possible. Fix in `src/api/auth.ts`: `whenActive()` waits for `AppState` `active` before exchanging. `pkce_code_verifier_not_found` now has its own message. **Untested:** waiting for the email rate limit. Check the `[auth] AppState before exchange =` log. Remove all `// TEMP` logs in `auth.ts` once it works.
  - **Before launch:** warning `WebCrypto API is not supported` means PKCE falls back to `plain` instead of `S256`. Add a WebCrypto polyfill (e.g. `expo-crypto` / `react-native-get-random-values`, check the Supabase RN guide).
  - Note: confirmed in `node_modules/@supabase/auth-js` that `resend()` does send the PKCE code challenge in v2.119 — resent emails are fine.
- **Task 3** forgot/reset password — implemented as written in the plan (2026-11-18): `app/forgot-password.tsx`, `app/reset-password.tsx`, `resetPassword`/`updatePassword` in `src/api/auth.ts`. Reuses `exchangeAuthCode`, so it gets the wait-for-active fix. tsc passes. **Device-tested 2026-11-18:** forgot → email → link → new password → logged in. Old password rejected and reused link checks also pass (Bar). Old IP Redirect URL entries deleted. WebCrypto/PKCE `plain` fallback deferred (Bar).
- **Task 4** delete account — implemented as written in the plan (2026-11-18): `deleteAccount()` in `src/api/auth.ts`, Settings has a "type DELETE" confirm. `public.delete_account()` confirmed to exist and to refuse anonymous callers (anon RPC → 42501 permission denied). tsc passes. **Device-tested 2026-11-18:** account deleted and gone from Supabase. Cancel button made bigger with more space above it (Bar's request).
- **Task 5** native Google + Apple + EAS dev build — code done (2026-11-18): packages installed (`expo-apple-authentication`, `@react-native-google-signin/google-signin` v17, `expo-dev-client`), `app.json` (usesAppleSignIn + Google `iosUrlScheme`, which the plugin requires), `eas.json`, Google IDs in `.env`, `signInWithApple`/`signInWithGoogle` in `auth.ts`, Apple button above Google on login + signup (Bar's new design leaves out these screens, so the layout is my call). Supabase Google + Apple providers confirmed enabled (`/auth/v1/settings`). tsc + `expo config` pass. **DONE 2026-11-18:** EAS set up (projectId in app.json, env vars in EAS `development`, iPhone registered, Developer Mode on), dev build installed. All 4 device tests pass: Apple, Google, cancel shows no error, email link via `chronodrom://` in the dev build. Run with `npx expo start --dev-client`. Before the first TestFlight build: add the same 4 env vars with `--environment production`.
- **Task 6** docs update — DONE (2026-11-18): `architecture.md` (file tree, dependencies, dev workflow incl. email-link/tunnel/SMTP rules) and `CLAUDE.md` (Supabase stack line, dev build, tunnel, npm install after a branch switch).
- **Final review (2026-11-18):** 7 findings. 6 fixed: double-tap guard on the social buttons, 10 s timeout in `whenActive`, Apple name save retried once, "needs the dev build" message for Google in Expo Go, self-check cases, misplaced comment. Re-tested on device by Bar.
- **Hardening (2026-11-18):** `expo-crypto` added. `src/api/supabase.ts` maps `globalThis.crypto` (getRandomValues + subtle.digest) onto expo-crypto, so PKCE uses real randomness + S256 instead of Math.random + `plain`. Apple sign-in sends a nonce (SHA-256 to Apple, raw to Supabase). tsc passes. **Needs a new dev build** (expo-crypto is native), then re-test: Apple sign-in, one email link, and check that the `WebCrypto API is not supported` warning is gone.
- Rebuilt + re-tested 2026-11-18: Apple (with nonce) and email link work, WebCrypto warning gone. Removed the deprecated `lock: processLock` option (supabase-js 2.119 coordinates refreshes without a lock). `onAnimatedValueUpdate` warnings are React Native noise, not auth.
- **RA-18 complete. Next:** Bar commits + merges, then RA-34 (`feature/manage-db`).

After all tasks: final whole-branch code review, then the finishing-a-development-branch flow (Bar handles git).

## Done: RA-34 Manage DB — `feature/manage-db` (merged 2026-11-20)

- Spec `docs/superpowers/specs/2026-11-18-manage-db-design.md`, plan `docs/superpowers/plans/2026-11-18-manage-db.md`. Design: Supabase = truth, SQLite copy + outbox, `syncNow()` push→pull; edits in `runs.edits`; 7 default types per user (DB trigger); dev "Load sample runs" button in Settings.
- **2026-11-20:** Tasks 1–9 implemented (subagents), tsc clean, `node src/db/sync.check.ts` passes. Opus review of the sync core found 1 critical + 3 important issues, all fixed: `runs` PK is `(user_id, id)` (a second account on one phone would silently lose its runs), metric columns `double precision` (HealthKit sends fractions), pending inserts no longer block pulled rows, keyset paging + 60 s overlap on pull, epoch guard so a logout mid-sync can't leak rows into the next user.
- **2026-11-20 device-tested (dev build), all pass:** schema applied (anon gets `permission denied`, 7 types per existing account via backfill), seed → 47 runs, re-seed no duplicates, all screens on real data, offline edit → synced as `edits: {"distanceKm": 8}` with `distance_km` untouched, logout/login restores history from the cloud, unsynced-changes warning, second account isolated, delete account cascades.
- **Final review (2026-11-20):** no critical issues. Fixed: a forced sign-out (rejected refresh token) no longer wipes unsent edits (only explicit logout / delete calls `clearAll()`); Edit Run sends only the fields the user touched; `fmtMMSS` rounds first (no "3:60"); logout double-tap guard + "Syncing…". Left as is (minor): the type filter label reads `getState()` (stale if a type is renamed mid-session), `MOCK_RUNS` ships in the prod bundle until RA-3 removes the seed, no dedicated empty state on Dashboard "Recent runs" / All runs ("No runs match this filter.").
- Re-tested after the final-review fixes (edit stores only the changed field, logout OK). Committed, PR merged into `main` 2026-11-20. Bar moves RA-34 to Done in Jira.
- **Test on the first TestFlight/preview build:** open the app with no internet (airplane mode) → saved runs show, an edit made offline survives a restart and syncs when back online. Can't be tested in the dev build: it loads its JS from Metro, so it won't open without Wi-Fi.
- **Decide in RA-3:** `runs.date` is a `date` (no start time) — consider `timestamptz` before real HealthKit data arrives (touches every screen that uses `run.date`). HealthKit → Run mapping must give `id` = workout UUID.

## Current task: RA-3 Apple Connectivity — `feature/healthkit`

Claude session name: `feature/healthkit`.

- **2026-11-20:** spec `docs/superpowers/specs/2026-11-20-healthkit-design.md`, plan `docs/superpowers/plans/2026-11-20-healthkit.md`. Tasks 1–8 done (subagents + review), tsc clean, both self-checks pass (`node src/healthkit/import.check.ts`, `node src/db/sync.check.ts`). Dev seed + `src/mockData.ts` removed. Design summary in `architecture.md` → HealthKit import.
- **Bar to do before testing, in this order:** (1) run `supabase/migrations/2026-11-20-started-at.sql` in the Supabase SQL Editor **before the new build first opens** — a push rejected for the missing column is marked `failed` for good (never retried), so those runs would stay local-only; (2) delete the old dev sample runs from the cloud (`delete from public.runs where started_at is null;` — every row before RA-3 is seed data); (3) new dev build `eas build --profile development --platform ios` (HealthKit is native) and reinstall.
- **Final review (Opus) fixes applied:** HealthKit UUIDs are uppercase but Postgres returns uuids lowercase → every run would have shown twice; now lowercased everywhere (+ check). Import stops if a logout happens mid-import (epoch guard, like sync) and a new login starts its own import. HealthKit errors can no longer leave index / the Health screen stuck. `importNewRuns()` now syncs first itself (callers simplified), so cloud runs are known before dedupe. All progress listeners get updates. Unit `"meters"` (what the library really sends) handled.
- **Device test round 1 (2026-11-20):** import works. Compared one run with Fitness → now matched exactly: splits come from Apple's own km **segment events** (type 7; km + mile chains, km chain = ceil(km) links) minus pause/resume time; HR avg/min/max from the workout's HR statistic (`getStatistic`); new `calories` column (active kcal, `totalEnergyBurned`; migration `2026-11-20-calories.sql`, SQLite v3); Fitness truncates (time, elevation, temperature, calories), we do too; date uses `HKTimeZone`. Real run is now a fixture in `import.check.ts`. Re-import needed for existing rows (`delete from public.runs;` then log out/in).
- **Intervals (done, option 1 chosen by Bar):** custom-workout steps are HealthKit **activities** (start/end/duration only — the library exposes no step names). Saved as `segments` labelled "Step N" + "Open" (time after the last step); time = activity duration (pause-free), distance = distance samples in range, HR = mean; colour by pace group (biggest pace gap ≥ 30 s/km splits rep/rest, else all main). Segment tables now show `seg.label`. Debug logger removed. Note: Fitness shows the *goal* time for time-goal steps (e.g. 2:30 vs our 2:29).
- **Precise distances (2026-11-20, Bar's ask):** `fmtDistance` is the only distance format app-wide (dashboard, cards, Compare, Run Detail, splits, intervals): "374 m" under 1 km, else 2 decimals ("9.07 km", whole km stays "1 km"), 0 stays "0 km". JS only, no rebuild.
- **Jira created 2026-11-20:** RA-39 Set Run Type Manually, RA-40 Real Interval Step Names (spike, native patch), RA-41 Guess Interval Step Names (optional, rules → ML with RA-15).
- **Left as is (minor):** Watch samples that sync after the workout object are missed (anchor moves on; RA-21 re-reads HR); first import pushes one HTTP upsert per run (RA-34 design), fine for now.
- **Committed 2026-11-20** (6 commits, tree clean; not merged). Device-tested so far: import, Fitness match (17 Nov run), intervals, precise distances, "Not now" reinstall path (2026-11-21; Dashboard shows the cloud runs after login, as it should).
- **Next:** only a new run via pull to refresh (2026-11-21) is left; Bar is skipping the other Task 9 items (duplicates after reopen, Watch+other-app, offline, older runs' weather, non-Watch run). Edit+type-kept waits for RA-39. If the new run fails, fix it on `feature/healthkit` (switch back), then merge.
- **For RA-11 (next branch):** `readBodyData()` in `src/healthkit/bodyData.ts` already reads DOB, sex, height, body mass, resting HR, VO2max (permission already asked in RA-3) — now used by the personal-info form. (Done in RA-11: `MOCK_HR_MAX` replaced by `effectiveHrMax`.)
- **Jira follow-ups (draft wording first, Bar approves):** new ticket for interval **segments** from HealthKit (left null in RA-3); note on **RA-12** about letting the user pick which source wins when the same run is in Health twice.
- **Untested on device:** shape of workout metadata (elevation/weather), `productType` Watch detection, humidity scale (0–1 vs 0–100 handled both ways).

Inputs that shaped the design (kept for reference):
- **Package:** `@kingstinct/react-native-healthkit` is in the stack (`CLAUDE.md`) but **not installed yet**. It's native → needs `app.json` HealthKit entitlement + usage strings and a **new EAS dev build** (`eas build --profile development --platform ios`). Logic goes in `src/healthkit/` (empty folder).
- **Onboarding (target):** Signup → Health permission (RA-3) → Personal info form (RA-11) → Dashboard.
- **Import must use the RA-34 data layer:** map each HKWorkout → `Run`, `id` = HealthKit workout UUID, save with `writeChange('runs', 'insert', runToRow(run))` (insert-if-missing: never overwrites type/notes/edits), then `useRunStore.getState().load()` + `syncNow()`. HealthKit is read-only.
- **Replace the dev seed:** remove the `__DEV__` "Load sample runs" button (Settings) + `seedSampleRuns` / `seedRows` / mock import in `useRunStore` — this also drops `MOCK_RUNS` from the prod bundle.
- **Decide early:** `runs.date` is a `date` (no start time). Consider `timestamptz` before real data arrives — touches every screen that uses `run.date` and needs a Supabase migration (the cloud `runs` table only holds sample data now, so dropping/recreating it is cheap).
- Metric columns are `double precision`, so fractional HealthKit values are fine. Splits / segments / zones / weather come from HealthKit samples — decide what is computed at import time vs on demand (raw HR/GPS streams are not stored, Phase 3 decision).
- (Done in RA-11) `MOCK_HR_MAX` replaced by `effectiveHrMax` in `src/utils/profile.ts`.

Open items carried over: RA-24 white flash on logout (below); first TestFlight build must check offline app start (see RA-34 section).

## Open bugs — RA-24 Bug Fixes (`feature/bug-fixes`, not started)

- **White flash on logout (found 2026-11-20).** Logging out shows a white screen for a moment before the login screen. Cause: when the tabs are removed, the app briefly falls back to `app/index.tsx` (which redirects to login); during that switch the bottom layer is React Navigation's default theme background (`#f2f2f2`), because only the screens paint `colors.bgApp`. Fix: in `app/_layout.tsx` wrap the `Stack` in `<ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bgApp, card: colors.bgCard } }}>` (`import { DarkTheme, ThemeProvider } from 'expo-router'` — Expo 58 bundles React Navigation inside expo-router; there is no separate `@react-navigation/native` package). JS-only, no rebuild. Not caused by RA-34 (navigation untouched there).

## Current task: RA-11 + RA-10 — `feature/add-personal-info`

Claude session name: `feature/add-personal-info`.

- Spec `docs/superpowers/specs/2026-11-21-personal-info-design.md`, plan `docs/superpowers/plans/2026-11-21-personal-info.md` (10 tasks). Decisions with Bar: RA-9 gets its own spec; metric only until RA-6; profile goes through the sync layer (offline); signup has First + Last name; required fields marked with a red `*` text (not an icon); Sex dropdown Male / Female / Prefer not to say; label "VO2max (if known)".
- **2026-11-21:** Tasks 1–9 implemented (Sonnet implementers, Opus review per batch; no Critical/Important left). tsc clean; `profile.check`, `sync.check`, `import.check` pass. Review fixes applied: offline-created profile gets `unit = 'km'`; Health screen opened from Settings goes back instead of stacking a second tab bar; the Health prompt no longer waits for the profile sync; opening the DOB picker no longer fills 1 Jan 1990 by itself.
- **Bar to do:** (1) run `supabase/migrations/2026-11-21-profile.sql` in the SQL Editor **before** opening the new code — a profile push rejected for missing columns is marked `failed` for good and the edit is lost; (2) JS only, no rebuild: `npx expo start --dev-client`; (3) device test = plan Task 10.
- **Device-tested 2026-11-21 (dev build), all pass:** existing account → form once (name split, Health prefill) → dashboard; edit from Settings + HRmax on the zones screen; new `+alias` signup with first/last name. A second account on the same phone skips the Health screen: iOS shows its Health prompt once per install, not per account (`needsHealthPrompt` = false). Expected; the new account still imports this phone's Health runs (clearAll resets the anchor).
- **Known limits (accepted):** the first full import runs before the form, so past runs keep zones from 190 / 220 − age until RA-21. In edit mode an optional field left empty is prefilled from Health again. Google names are split from `full_name` at the first space (editable).

## Done: RA-39 Set Run Type Manually — `feature/run-type` (merged 2026-11-25)

Claude session name: `feature/run-type`.

- Spec `docs/superpowers/specs/2026-11-22-run-type-design.md`, plan `docs/superpowers/plans/2026-11-22-run-type.md`. Mockups (gitignored) `.superpowers/brainstorm/886-1795350874/content/` (`run-type-picker.html`, `new-run-prompt-v2.html`, `bulk-set-type.html`). Jira RA-39 updated with the added acceptance criteria (Bar approved).
- **Decisions with Bar:** picker = native iOS sheet (option A, reuses the All runs filter's `pick()`; no colours); classifying old runs is optional; **runs that started after the account was created must be answered** (a type or Unclassified) via a lime Dashboard card (option B, never a forced pop-up); a run made while logged out also asks after the next login; bulk **Select** mode in All runs with Select all + an **Unclassified** filter option, and "Set all N ›" on the card for users back from a long logout.
- **Implementation (Sonnet implementers, Opus review per batch):** `runs.needs_type` (SQLite v7 + cloud), `needsType()` (trims Supabase microseconds so Hermes can parse), `useRunStore.setType(ids, typeId)`, `pickRunType()`, Run Detail pill, Dashboard `NewRunCard`, All runs mode `none | compare | bulk`. Checks: `sync.check` (needs_type round-trip + re-import tripwire), `import.check` (`needsType` cases), tsc clean.
- **Bar to do:** (1) run `supabase/migrations/2026-11-22-needs-type.sql` in the SQL Editor **before** opening the new code (a push rejected for the unknown column is marked `failed` for good); (2) `npx expo start --dev-client` (JS only, no rebuild); (3) device test = plan Task 8.
- **Known limits (accepted):** one outbox op + one HTTP update per run in a bulk set; after `delete from public.runs;` (dev re-import) every run since the account was created asks again.
- **Device-tested 2026-11-22 (Bar):** pill, Unclassified filter, bulk Set type, offline change, card via faked `needs_type`, re-login: all pass. Real new Watch run tested 2026-11-24: the card appeared by itself. All tests pass.
- **Search** in All runs is a placeholder (RA-35), not an RA-39 bug.
- **Follow-up:** RA-3's left-over test "an edit and the type are kept after a re-import" can now be run.

## Done: RA-8 Shoes — `feature/shoes` (merged 2026-11-25)

Claude session name: `feature/shoes`. Stacked on `feature/run-type` (needs its SQLite v8 and `setType`).

- Spec `docs/superpowers/specs/2026-11-23-shoes-design.md`, plan `docs/superpowers/plans/2026-11-24-shoes.md` (13 tasks; Task 13 = Bar's device test). Design summary in `architecture.md` → Shoes, UI in `FRONTEND_SPEC.md` → Shoes.
- **Decisions with Bar (spec):** own catalogue in Supabase, 21 brands / 284 models (brand sites + RunRepeat; Karhu from memory); recommended km by kind of shoe (max-cushion 750, daily 700, trail 650, tempo 550, race 400), editable per shoe; shoe colour for pairs of the same model; alerts: 90% pop-up + Dashboard card, 100% pop-up (Retire / Close) + card; default shoe per run type only fills a run with no shoe; past-runs step with an editable distance → `extra_km`; no delete, no photos.
- **Changes vs the plan:** `ShoeCard` lives in `src/components/ShoeCard.tsx`. `editShoe()` (`src/shoes/alerts.ts`) is the one save path for editing an existing shoe (lowers remembered alert levels, then runs the 90 / 100% check). The store refuses invalid shoe writes (`shoeProblem` in `shoes.ts`), so a bad op never enters the outbox. `setType` writes the default shoe as its own outbox op. HealthKit inserts leave `shoe_id` out when null. The catalogue fetch times out after 8 s. `compare.check` runs with `npx tsx src/utils/compare.check.ts`.
- **State (2026-11-24):** implemented, Opus review twice with fixes applied, `npx tsc --noEmit` clean, all self-checks pass. **Not committed, not device-tested.**
- **Bar to do:**
  1. Run `supabase/migrations/2026-11-24-shoes.sql`, then `2026-11-24-shoe-catalogue.sql`, in the Supabase SQL Editor **before** opening the new code. The first is **not re-runnable** (creates fail the second time); a push rejected for a missing table / column is marked `failed` for good.
  2. Optional: upload brand PNGs to Storage bucket `brand-logos` (file = brand name lowercase, non-alphanumerics → `-`: `nike.png`, `new-balance.png`, `inov-8.png`, `la-sportiva.png`). Without them the app shows initials.
  3. No new dev build (JS only): `npx expo start --dev-client`.
  4. Device test = plan Task 13.
- **Merge order:** the `feature/run-type` PR first (normal merge commit, **not squash**, since shoes is stacked on its commits), then the `feature/shoes` PR against `main`.
- **Device test round 1 (2026-11-24, Bar):** looks good. Changes asked and made: (1) after adding a shoe, a "Default for which runs?" checklist (future runs only), shown again when the shoe on a run changes (replaces the single yes/no prompt); (2) Delete shoe on the Edit screen and by swiping a row left in My Shoes (`ReanimatedSwipeable`; outbox gets a `delete` op kind, shoes only); (3) the keyboard no longer hides the Limit field (`automaticallyAdjustKeyboardInsets`). Opus-reviewed; blank page after deleting from a Dashboard-opened shoe page fixed. Re-test these three.
- **Round 2 (2026-11-24, Bar):** the red Delete showed behind a tapped card (the card dims on press) → opaque backing, now only visible on swipe; Edit shoe gets a "Default for" row that opens the defaults checklist to add/remove types; full swipe (past half the row) asks to delete on release, iOS-style. Re-test all three.
- **Logos (2026-11-25):** 21 brand logos in `assets/brand-logos/` (Hoka and Topo Athletic added by Bar), shown on a white circle (`ShoeLogo`). Bar uploaded 19 PNGs; hoka.png and topo-athletic.png still to upload to the `brand-logos` bucket.
- **Follow-ups (minor):** a deleted shoe stays on a second signed-in device until logout/in (no tombstone). Metro "Require cycle" warning between `useRunStore` and `src/shoes/alerts.ts` (harmless). Moving a run off a shoe does not lower the shoe's alert levels.

## Current task: RA-9 Custom HR Zones — `feature/hr-zones`

Claude session name: `feature/hr-zones`.

- Spec `docs/superpowers/specs/2026-11-21-hr-zones-design.md`, plan `docs/superpowers/plans/2026-11-21-hr-zones.md` (8 tasks). Mockup (gitignored) `.superpowers/brainstorm/372-1795260023/content/zones-full-v6.html`.
- **Key decision (Bar approved):** runs store `hr_hist` (seconds per bpm) instead of zone totals; zones are computed on screen from it + the profile's zone settings, so changing the method updates every past run instantly (offline, every device). This covers RA-21's recalculation without re-reading Apple Health.
- **UI decisions with Bar:** always-vertical 4 columns (% Max "Default", Reserve, LTHR, Manual) with radio dots; card shows ranges for presets, "starts at" −/+ controls for Manual (hint text: only "Set the heart rate (bpm) where each zone starts."); confirm pop-up with the ranges + "All your past runs will be updated…". Onboarding: Health + import → Personal info → HR zones → Dashboard.
- **Refinement vs spec:** resting HR (Reserve) and LTHR fields are always shown, prefilled (else a saved LTHR couldn't be edited).
- **2026-11-21:** Tasks 1–7 implemented (Sonnet implementers, Opus review per batch). tsc clean; `zones.check`, `import.check`, `sync.check`, `profile.check`, `compare.check` pass. SQLite v5 migration runs in one transaction.
- **Bar to do:** (1) run `supabase/migrations/2026-11-21-hr-zones.sql` in the SQL Editor **before** opening the new code; (2) `delete from public.runs;` (old runs have no histogram); (3) `npx expo start --dev-client` (JS only), log out and in; (4) device test = plan Task 8.
- **Fitness match (2026-11-21, device):** first test was ~1 min off per zone. Two fixes in `hrStats` (`mapWorkout.ts`), found with a temp import log comparing 4 counting rules: (1) HR during pauses is not counted (the Watch keeps measuring while paused); (2) bpm is **floored**, not rounded, in `hr_hist` (Watch HR is often fractional; 156.6 must stay below a zone starting at 157). Now within 3 s per zone of Fitness on the 15 Nov 13.51 km run (9:32 / 1:24:44 / 19:27 vs 9:30 / 1:24:41 / 19:26). Forward weighting confirmed. Zone time column widened for times over 1 h.
- **Jira RA-9 + RA-21 edited 2026-11-21** (Bar approved the drafts).
- **Bug fixed 2026-11-22 — Run Detail HR chart showed fake data:** `hrSeries` (`src/utils/chart.ts`) was a mock-data leftover that stretched a random seeded line between min/max HR, so it looked too low. Now the import saves `hr_curve` (80 × [min, max] bpm over active time, paused HR left out) and both HR charts draw it. No HR → no chart. `hrSeries` / `genSeries` removed. SQLite v6, `supabase/migrations/2026-11-22-hr-curve.sql`; checks in `import.check.ts`.
  - **Bar to do:** (1) run `2026-11-22-hr-curve.sql` in the SQL Editor before opening the new code; (2) `delete from public.runs;`; (3) `npx expo start --dev-client`, log out and in (re-import); (4) check the HR chart on Run Detail and the Heart Rate screen looks like the Fitness HR chart.

## Current task: RA-29 Health Data on Insights — `feature/health-data`

Claude session name: `feature/health-data`.

- **2026-11-23 brainstorm with Bar:** spec `docs/superpowers/specs/2026-11-23-health-data-design.md`, mockup `.superpowers/brainstorm/insights/insights-v2.html` (gitignored). 25 Apple Health metrics on the Insights tab, read live (nothing stored except the hide/order choice in `profiles.insights_layout`), all on by default, Edit on the tab hides/reorders. One colour per group from existing tokens; lime kept for future calculated insights. Figma "01 Data & insights" (2:226) is a weekly summary, so only its heading + card style are used; Bar will redesign later.
- **Jira created 2026-11-23:** RA-43 Cadence + Stride Length on Run Screen (split out of RA-29), RA-44 First-Run App Tour.
- **Spec approved 2026-11-23.** Plan `docs/superpowers/plans/2026-11-23-health-data.md` (12 tasks; Task 12 = Bar's device test). Its pure code + `summary.check.ts` were dry-run in a scratch copy: all pass. Deliberate simplifications listed at the top of the plan (sleep detail = bars, "All" = 10 years).
- **Jira 2026-11-23:** RA-45 Smart Insights (subtask of RA-38): two sections, Running insights + Health insights, lime cards, facts only. Calculated metrics moved there from RA-29 (comment on RA-29).
- **Tab restructure idea (Bar, 2026-11-23, not decided; noted in RA-45):** Insights = insights only (RA-45) · Dashboard = health data (the RA-29 cards) + basic running data · Running = extended running data + last runs · More (replaces You) = Compare, Settings, the rest. If adopted, the RA-29 cards move from the Insights tab to the Dashboard. This branch still builds them on the Insights tab.
- **Execution (subagent-driven):** tasks 1–11 done (screens, docs), Opus review fixes applied; tsc clean, all self-checks pass. Task 12 (device test) is Bar's.
- **Device fixes 2026-11-23 (Bar confirmed both):** (1) Edit → Done failed with `no such column: insights_layout` — the phone was at user_version 7 without the column (fast refresh mid-edit); `schema.ts` now checks the real column (`PRAGMA table_info`) and adds it if missing. (2) Native iOS `Switch` hung from the top of each Edit row; it now sits in a fixed-height centred box (`switchBox`). Bar wants the native iOS switch, not a custom toggle.
- **Bar to do:**
  1. Run `supabase/migrations/2026-11-23-insights-layout.sql` in the Supabase SQL Editor **before** opening the new code.
  2. Build a new dev client: `eas build --profile development --platform ios` (new Health types in `app.json`), install, `npx expo start --dev-client`.
  3. Device test: plan Task 12 steps 3–8 (`docs/superpowers/plans/2026-11-23-health-data.md`).

## Personal Info feature (RA-11 + RA-9) — earlier notes

Bar's request: right after signup the user fills a personal-details form. Everything available from Apple Health is prefilled and editable. Includes running HR zones — automatic (from age / HRmax) or built manually. Must be stored in the cloud DB so another device doesn't need to refill it. Many features depend on this data.
- HealthKit can provide: DOB, biological sex, height, weight, resting HR, VO2max. No HRmax — can estimate from the highest HR in past workouts (often better than `220 − age`).
- (Done) `MOCK_HR_MAX` replaced by the per-user value (`effectiveHrMax`).
- Resume this brainstorm only after RA-18, RA-34 and RA-3 are done.
