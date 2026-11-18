import { create } from 'zustand'
import { onSessionChange, type Session } from '../api/auth'

type AuthState = { session: Session | null; loading: boolean }

export const useAuthStore = create<AuthState>(() => ({ session: null, loading: true }))

// Supabase fires INITIAL_SESSION right away (from AsyncStorage), then every sign-in/out/refresh.
onSessionChange(session => useAuthStore.setState({ session, loading: false }))
