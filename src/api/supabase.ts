// The only place the Supabase client is created. Nothing outside src/api/ imports this.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, processLock } from '@supabase/supabase-js'
import { AppState } from 'react-native'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: AsyncStorage,      // session survives app restarts
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,  // we handle deep links ourselves
      flowType: 'pkce',           // email links come back with ?code=…
      lock: processLock,
    },
  },
)

// Refresh tokens only while the app is in the foreground (Supabase RN guide).
AppState.addEventListener('change', state => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
