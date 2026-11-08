# User Auth (RA-18) — Design

**Branch:** `feature/user-auth`
**Jira:** [RA-18 Login](https://baranchel.atlassian.net/browse/RA-18) (parent RA-2 User Management)
**Date:** 2026-11-08

## Goal

Replace the mock login/signup with real accounts on **Supabase Auth**: email + password
(with email confirmation), native Google and native Apple sign-in, password reset,
persistent session, logout, and in-app account deletion.

This is the first step of the Phase 2 foundation. Order of the foundation work:
1. **RA-18 User auth** (this spec)
2. RA-34 Manage DB (`feature/manage-db`)
3. RA-3 Apple Connectivity (`feature/healthkit`)
4. RA-11 + RA-9 Personal info & zones (`feature/add-personal-info`)

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Backend is **Supabase** (Auth + Postgres). FastAPI is kept only for the future ML `/suggest-type` service. | Auth, DB and per-user security out of the box; cross-device works immediately. Data is plain Postgres, so it stays portable. |
| 2 | **Email confirmation required** before first login, using Supabase's built-in mailer. | Blocks typo'd emails that would make password reset impossible. Built-in mailer's rate limit is fine while there is one user; swap to a custom SMTP (e.g. Resend) before real users. |
| 3 | **DOB removed from signup.** Signup = name, email, password. | Google/Apple never provide DOB; RA-11's personal-info form collects it (prefilled from HealthKit) for every login method. |
| 4 | **Native** Google and Apple sign-in (ID-token flow), not browser OAuth. | One tap, native feel, matches Apple's HIG. Requires the EAS dev build (needed for HealthKit anyway). |
| 5 | **Delete account** in Settings. | Required by App Store guideline 5.1.1(v) for any app with account creation. |
| 6 | Sign in with Apple included alongside Google. | Required by App Store guideline 4.8 whenever a third-party login is offered. |
| 7 | All Supabase calls live in `src/api/`. Screens and stores never import `@supabase/supabase-js`. | A future move to FastAPI only rewrites `src/api/`. |
| 8 | Login screen layout for the Google/Apple buttons is **not** designed here — placeholder buttons only. | Bar will design the screen later. |

## Structure

### New packages

- `@supabase/supabase-js` — Supabase client
- `@react-native-async-storage/async-storage` — session persistence
- `expo-apple-authentication` — native Sign in with Apple
- `@react-native-google-signin/google-signin` — native Google sign-in

### New files

```
.env                       EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY
src/api/supabase.ts        creates the client (AsyncStorage session, autoRefreshToken,
                           persistSession, detectSessionInUrl: false, flowType: 'pkce')
src/api/auth.ts            signUp, signIn, resendConfirmation, signInWithGoogle,
                           signInWithApple, handleAuthLink, resetPassword,
                           updatePassword, signOut, deleteAccount
src/store/useAuthStore.ts  { session, loading }; initialised from getSession(),
                           kept current via onAuthStateChange
app/forgot-password.tsx    enter email → "if an account exists, we sent a link"
app/reset-password.tsx     opened by the reset link → set new password
app/auth-callback.tsx      deep-link target for email-confirmation links;
                           calls handleAuthLink(url) then lets the gate route
```

Values:
- `EXPO_PUBLIC_SUPABASE_URL=https://cbbalftydzsfbqategub.supabase.co`
- `EXPO_PUBLIC_SUPABASE_KEY=<publishable key>` — public by design; RLS protects data.
  The secret / `service_role` key is never used in the app.

### Changed files

- `app/_layout.tsx` — **auth gate**. Keeps the splash screen up until the stored session is
  loaded (no flash of the wrong screen), then uses expo-router `Stack.Protected`:
  - `guard={!!session}` → `(tabs)`, `run/*`, `settings/*`
  - `guard={!session}` → `login`, `signup`, `forgot-password`
  - always reachable: `auth-callback`, `reset-password`
- `app/index.tsx` — removed; the gate decides the landing screen.
- `app/login.tsx` — wire email/password; add placeholder Apple + Google buttons;
  "Forgot password?" link.
- `app/signup.tsx` — remove DOB field and date picker; wire `signUp()`; after submit show the
  "Check your email" state with **Resend**.
- `app/(tabs)/settings.tsx` — **Log out** and **Delete account** (confirmation: type `DELETE`).
- `app.json` — `ios.usesAppleSignIn: true`; `expo-apple-authentication` and
  `@react-native-google-signin/google-signin` config plugins.

### Concept: session

After login Supabase issues a short-lived **access token** (sent with every request) and a
long-lived **refresh token** (used to get a new access token when it expires). Both are
stored in AsyncStorage, which is what keeps the user logged in across app restarts.
Logging out deletes them.

## Flows

1. **Sign up (email)** — `signUp({ email, password, options: { data: { name },
   emailRedirectTo: <callback URL> } })` → screen switches to "Check your email — we sent
   a confirmation link to <email>" with **Resend**. Name is stored in `user_metadata.name`
   (RA-34 copies it into `profiles`). Already-registered email → "This email already has an
   account. Log in?"
2. **Confirm email** — link opens `chronodrom://auth-callback?code=…` →
   `exchangeCodeForSession(code)` → logged in → gate routes to the dashboard (RA-3 / RA-11
   later insert Health permission + personal-info steps here). Expired/used link →
   "Link expired" with resend.
3. **Log in (email)** — `signInWithPassword` → dashboard. Wrong password or unknown email →
   one message: "Email or password is incorrect". Unconfirmed email → "Please confirm your
   email first" with resend.
4. **Google / Apple** — native sheet → ID token → `signInWithIdToken({ provider, token })`
   → logged in (first time also creates the account; no confirmation needed). Apple returns
   the user's name only on the first sign-in → save it immediately with
   `updateUser({ data: { name } })`. User cancels the sheet → silently do nothing.
5. **Forgot password** — enter email →
   `resetPasswordForEmail(email, { redirectTo: chronodrom://reset-password })` → always
   "If an account exists, we sent a reset link" → link opens `reset-password` directly,
   which calls `handleAuthLink(url)` (code → session) → user enters new password →
   `updateUser({ password })` (same 4 rules as signup) → dashboard. Because
   `reset-password` is always reachable, the gate does not redirect away when the
   recovery session appears.
6. **Stay logged in** — on start, gate loads the stored session. Token auto-refresh runs
   while the app is in the foreground (start/stop refresh on `AppState` changes, per the
   Supabase RN guide). Invalid refresh token (e.g. account deleted elsewhere) → signed out →
   login.
7. **Log out** — `signOut()` → session removed → login.
8. **Delete account** — confirmation screen ("permanently deletes your account and all your
   data — type DELETE") → `rpc('delete_account')` → `signOut()` → login.
   Future RA-34 tables reference `auth.users(id) ON DELETE CASCADE`, so user data goes
   with the account.

**Errors** — `src/api/auth.ts` maps Supabase errors to the user-facing messages above; any
network failure → "No connection, try again". Unknown errors show a generic message and are
logged with `console.warn`.

**Offline** — login/signup need internet. An existing stored session works offline. Offline
data is RA-34's concern.

## Supabase setup (one-time, in the dashboard)

1. **Authentication → URL Configuration**
   - Site URL: `chronodrom://`
   - Redirect URLs: `chronodrom://**` and, for Expo Go development, `exp://**`
2. **Authentication → Providers → Email** — "Confirm email" ON (default).
3. **SQL Editor** — create the delete function:
   ```sql
   create or replace function public.delete_account()
   returns void
   language sql
   security definer
   set search_path = ''
   as $$
     delete from auth.users where id = auth.uid();
   $$;
   revoke execute on function public.delete_account() from public, anon;
   grant execute on function public.delete_account() to authenticated;
   ```
   `security definer` lets it delete from `auth.users`; `auth.uid()` restricts it to the
   caller's own account.
4. **Google** — Google Cloud Console: create OAuth client IDs (iOS client for the bundle
   `com.chronodrom.app`, plus a Web client whose ID Supabase checks the token against).
   Supabase → Providers → Google: enable, add the client IDs, enable "Skip nonce check"
   only if the native SDK requires it.
5. **Apple** — Apple Developer: enable the "Sign in with Apple" capability on the App ID
   `com.chronodrom.app`. Supabase → Providers → Apple: enable, add `com.chronodrom.app`
   as an authorized client ID.

Exact click-paths go in the implementation plan.

## Build order

1. Supabase client + `useAuthStore` + auth gate + logout
2. Email signup / login + confirmation deep link
3. Forgot / reset password
4. Delete account
5. Google + Apple (requires EAS dev build from here)

## Testing

No test framework in the project; this feature is wiring. Verification is:

1. `npx tsc --noEmit` passes after each step.
2. Manual checklist on device:

**Expo Go**
- [ ] Fresh install → Login screen; dashboard never flashes
- [ ] Sign up → "Check your email" → email arrives
- [ ] Tap confirmation link → app opens logged in → dashboard
- [ ] Wrong password → "Email or password is incorrect"
- [ ] Log in before confirming → "Please confirm your email first"
- [ ] Kill and reopen app → still logged in
- [ ] Forgot password → email → link → new password → logged in
- [ ] Log out → Login; reopen → still logged out
- [ ] Delete account → type DELETE → Login; old password no longer works
- [ ] Airplane mode on Login → "No connection, try again"

**EAS dev build**
- [ ] Apple → Face ID sheet → logged in; name saved on first sign-in
- [ ] Google → account picker → logged in
- [ ] Cancel either sheet → nothing happens, no error
- [ ] Google with the same email as an existing email/password account → same account,
      not a duplicate

## Out of scope

- Login screen visual design for social buttons (Bar designs later)
- Custom SMTP for auth emails (before real users)
- `profiles` table and all app data tables (RA-34)
- Health permission + personal-info onboarding steps after signup (RA-3, RA-11)
- Background token refresh while the app is closed (not needed; refresh happens on open)
