// All auth operations. Each returns null on success or a message to show the user.
import type { Session } from '@supabase/supabase-js'
import * as AppleAuthentication from 'expo-apple-authentication'
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
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })
    if (!cred.identityToken) return authErrorMessage({ code: 'no_identity_token' })
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken })
    if (error) return authErrorMessage(error)
    // Apple sends the name only on the very first sign-in, so save it now or never.
    const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ')
    if (name) await supabase.auth.updateUser({ data: { name } })
    return null
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null  // user closed the sheet
    return authErrorMessage(e as AuthErrorLike)
  }
}

export async function signInWithGoogle(): Result {
  try {
    // Loaded lazily: the native module doesn't exist in Expo Go, and a top-level import would crash it.
    const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin')
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

/** Exchanges the ?code= from an email link for a session (PKCE). */
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
const whenActive = () =>
  AppState.currentState === 'active'
    ? Promise.resolve()
    : new Promise<void>(resolve => {
        const sub = AppState.addEventListener('change', s => { if (s === 'active') { sub.remove(); resolve() } })
      })

// No retry possible: a failed exchange deletes the stored PKCE verifier (auth-js), so the first try must count.
export const exchangeAuthCode = (code: string): Result =>
  run(async () => {
    await whenActive()
    return supabase.auth.exchangeCodeForSession(code)
  })
