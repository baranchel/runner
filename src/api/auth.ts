// All auth operations. Each returns null on success or a message to show the user.
import type { Session } from '@supabase/supabase-js'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import * as Linking from 'expo-linking'
import { AppState } from 'react-native'
import { supabase } from './supabase'
import { authErrorMessage, type AuthErrorLike } from './authErrors'

export type { Session }
type Result = Promise<string | null>

async function run(op: () => Promise<{ error: unknown }>): Result {
  try {
    const { error } = await op()
    return error ? authErrorMessage(error as AuthErrorLike) : null
  } catch (e) {
    return authErrorMessage(e as AuthErrorLike)
  }
}

/** Calls cb with the current session immediately (INITIAL_SESSION) and on every change. */
export function onSessionChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session))
  return () => data.subscription.unsubscribe()
}

export const signOut = (): Result => run(() => supabase.auth.signOut())

// Expo Go → exp://<ip>:8081/--/<path>; dev/prod build → chronodrom://<path>
// Supabase rejects redirects whose host is an IP, so Expo Go email tests need `expo start --tunnel`.
const linkTo = (path: string) => Linking.createURL(path)

export async function signUp(name: string, email: string, password: string): Result {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: linkTo('auth-callback') },
    })
    if (error) return authErrorMessage(error)
    // With email confirmation on, an existing email returns a user with no identities (no error).
    if (data.user && data.user.identities?.length === 0) return authErrorMessage({ code: 'user_already_exists' })
    return null
  } catch (e) {
    return authErrorMessage(e as AuthErrorLike)
  }
}

export const signIn = (email: string, password: string): Result =>
  run(() => supabase.auth.signInWithPassword({ email, password }))

// Native sign-in sheets return an ID token that Supabase verifies (no email, no redirect).
// Both need the EAS dev build: Expo Go has no Google module, and its bundle ID fails Apple's check.

export async function signInWithApple(): Result {
  try {
    // Nonce: Apple puts SHA-256(nonce) into the token; Supabase hashes the raw nonce and compares,
    // so a copied token can't be replayed without this attempt's secret.
    const nonce = Crypto.randomUUID()
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce),
    })
    if (!cred.identityToken) return authErrorMessage({ code: 'no_identity_token' })
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce })
    if (error) return authErrorMessage(error)
    // Apple sends the name only on the very first sign-in, so save it now or never.
    const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ')
    if (name) {
      // ponytail: one retry only; a name lost after that needs the profile form (RA-11) to recover.
      const save = () => supabase.auth.updateUser({ data: { name } })
      const first = await save()
      if (first.error && (await save()).error) console.warn('Apple name not saved', first.error)
    }
    return null
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null  // user closed the sheet
    return authErrorMessage(e as AuthErrorLike)
  }
}

export async function signInWithGoogle(): Result {
  // Loaded lazily: the native module doesn't exist in Expo Go, and a top-level import would crash it.
  let google: typeof import('@react-native-google-signin/google-signin')
  try {
    google = await import('@react-native-google-signin/google-signin')
  } catch {
    return authErrorMessage({ code: 'needs_dev_build' })
  }
  const { GoogleSignin, isSuccessResponse } = google
  try {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    })
    const res = await GoogleSignin.signIn()
    if (!isSuccessResponse(res)) return null  // cancelled
    const token = res.data.idToken
    if (!token) return authErrorMessage({ code: 'no_identity_token' })
    return run(() => supabase.auth.signInWithIdToken({ provider: 'google', token }))
  } catch (e) {
    return authErrorMessage(e as AuthErrorLike)
  }
}

export const resendConfirmation = (email: string): Result =>
  run(() => supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: linkTo('auth-callback') } }))

/** Permanently deletes the current user (and, via ON DELETE CASCADE, their data). */
export async function deleteAccount(): Result {
  try {
    const { error } = await supabase.rpc('delete_account')
    if (error) return authErrorMessage(error)
    await supabase.auth.signOut({ scope: 'local' })  // user no longer exists server-side; just clear the device
    return null
  } catch (e) {
    return authErrorMessage(e as AuthErrorLike)
  }
}

export const resetPassword = (email: string): Result =>
  run(() => supabase.auth.resetPasswordForEmail(email, { redirectTo: linkTo('reset-password') }))

export const updatePassword = (password: string): Result =>
  run(() => supabase.auth.updateUser({ password }))

// Opening an email link wakes the app from Safari; iOS cancels requests sent before it is active.
// Gives up waiting after 10 s so the screen shows a result (or an error) instead of spinning forever.
const whenActive = () =>
  AppState.currentState === 'active'
    ? Promise.resolve()
    : new Promise<void>(resolve => {
        const done = () => { sub.remove(); clearTimeout(timer); resolve() }
        const sub = AppState.addEventListener('change', s => { if (s === 'active') done() })
        const timer = setTimeout(done, 10_000)
      })

/** Exchanges the ?code= from an email link for a session (PKCE). */
// No retry possible: a failed exchange deletes the stored PKCE verifier (auth-js), so the first try must count.
export const exchangeAuthCode = (code: string): Result =>
  run(async () => {
    await whenActive()
    return supabase.auth.exchangeCodeForSession(code)
  })
