import { AppState } from 'react-native'
import { create } from 'zustand'
import { onSessionChange, type Session } from '../api/auth'
import { clearAll, getMeta, setMeta } from '../db/queries'
import { onPulled, syncNow } from '../db/sync'
import { useRunStore } from './useRunStore'
import { useRunTypeStore } from './useRunTypeStore'

type AuthState = { session: Session | null; loading: boolean }

export const useAuthStore = create<AuthState>(() => ({ session: null, loading: true }))

function loadStores() {
  useRunTypeStore.getState().load()
  useRunStore.getState().load()
}
onPulled(loadStores)

// Supabase calls must not run inside its auth callback (it holds a lock) → start sync on the next tick.
const syncSoon = () => setTimeout(syncNow, 0)

let currentUser: string | null | undefined  // undefined = first event not seen yet

// Supabase fires INITIAL_SESSION right away (from AsyncStorage), then every sign-in/out/refresh.
onSessionChange(session => {
  const userId = session?.user.id ?? null
  if (userId !== currentUser) {
    currentUser = userId
    if (userId) {
      // The phone holds one user's data. Another owner (e.g. app killed mid-logout) → start clean.
      if (getMeta('owner') !== userId) { clearAll(); setMeta('owner', userId) }
      loadStores()  // synchronous, so screens have data on their first render
      syncSoon()
    } else {
      // Only the in-memory copy. The SQLite copy (and its outbox) survives a forced sign-out
      // (e.g. rejected refresh token) so unsent edits push after the same user logs back in;
      // an explicit logout / delete wipes it in Settings, and another user is caught by the owner check.
      useRunStore.getState().reset()
      useRunTypeStore.getState().reset()
    }
  }
  useAuthStore.setState({ session, loading: false })
})

AppState.addEventListener('change', state => {
  if (state === 'active' && currentUser) syncNow()
})
