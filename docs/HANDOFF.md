# Chronodrom — Session Handoff (2026-11-16)

Read this first, together with `CLAUDE.md` and `architecture.md`. It captures the state of work and the decisions made in the previous Claude Code (CLI) session, which a new session cannot see.

## Working rules (from Bar — always apply)

- **Never run git commands.** Bar commits himself. When something is ready, list the files + a suggested commit message.
- **Branch check first:** read `.git/HEAD` (file read, not git). Branch per task, `feature/<name>`. Wrong branch → stop and tell Bar.
- **Subagents:** Sonnet minimum, never Haiku.
- **Jira:** write a user story into a ticket only after Bar approves the draft.
- Keep `architecture.md` and `CLAUDE.md` updated after design decisions.
- Bar works on Windows (no Mac), tests on his iPhone via Expo Go / EAS dev build. Explain concepts alongside technical decisions.
- Never generate image assets — ask Bar for them.

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
| 1 | `feature/user-auth` | RA-18 Login | **In progress** (see below) |
| 2 | `feature/manage-db` | RA-34 Manage DB | Not started (story written) |
| 3 | `feature/healthkit` | RA-3 Apple Connectivity | Not started (story written) |
| 4 | `feature/add-personal-info` | RA-11 Personal Info + RA-9 Custom HR Zones (+ RA-10 Edit Profile) | Brainstorm paused; stories not yet written |

## Jira

Site `baranchel.atlassian.net`, project **Run App** (key `RA`), cloudId `0b1d9b12-7ac5-4f49-9460-7a62e28ffb36`. Accessed through the claude.ai Atlassian connector.
- User stories written so far: **RA-18, RA-34, RA-3.**
- Remaining tickets have titles only. Plan: write stories for RA-11/RA-9 at the end of their design session; others later, one at a time, asking Bar what he meant.

## Current task: RA-18 User Auth — `feature/user-auth`

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

## Personal Info feature (RA-11 + RA-9) — notes so far

Bar's request: right after signup the user fills a personal-details form. Everything available from Apple Health is prefilled and editable. Includes running HR zones — automatic (from age / HRmax) or built manually. Must be stored in the cloud DB so another device doesn't need to refill it. Many features depend on this data.
- HealthKit can provide: DOB, biological sex, height, weight, resting HR, VO2max. No HRmax — can estimate from the highest HR in past workouts (often better than `220 − age`).
- `src/utils/zones.ts` has `MOCK_HR_MAX = 190` — to be replaced by the per-user value.
- Resume this brainstorm only after RA-18, RA-34 and RA-3 are done.
