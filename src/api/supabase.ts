// The only place the Supabase client is created. Nothing outside src/api/ imports this.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import * as Crypto from 'expo-crypto'
import { AppState } from 'react-native'

// React Native has no WebCrypto. Without it auth-js makes the PKCE verifier with Math.random and sends
// it unhashed ('plain'). Map the two calls it uses onto expo-crypto so it uses real randomness + SHA-256.
if (!globalThis.crypto?.subtle) {
  ;(globalThis as { crypto: unknown }).crypto = {
    getRandomValues: Crypto.getRandomValues,
    subtle: { digest: (alg: string, data: BufferSource) => Crypto.digest(alg as Crypto.CryptoDigestAlgorithm, data) },
  }
}

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
    },
  },
)

// Refresh tokens only while the app is in the foreground (Supabase RN guide).
AppState.addEventListener('change', state => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
