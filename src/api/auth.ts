// All auth operations. Each returns null on success or a message to show the user.
import type { Session } from '@supabase/supabase-js'
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
