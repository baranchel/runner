// All auth operations. Each returns null on success or a message to show the user.
import type { Session } from '@supabase/supabase-js'
import * as Linking from 'expo-linking'
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
const linkTo = (path: string) => {
  const url = Linking.createURL(path)
  console.log('[auth] emailRedirectTo =', url) // TEMP: debugging RA-18 redirect bug, remove after
  return url
}

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

export const resendConfirmation = (email: string): Result =>
  run(() => supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: linkTo('auth-callback') } }))

/** Exchanges the ?code= from an email link for a session (PKCE). */
export const exchangeAuthCode = (code: string): Result =>
  run(() => supabase.auth.exchangeCodeForSession(code))
