import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { colors } from '../src/utils/tokens'
import { exchangeAuthCode } from '../src/api/auth'

// Opened by the email-confirmation link: chronodrom://auth-callback?code=…
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)  // the code is single-use; never exchange twice

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!code) { setError('Link expired. Request a new one'); return }
    exchangeAuthCode(code).then(err => (err ? setError(err) : router.replace('/')))
  }, [code])

  return (
    <View style={s.screen}>
      {error ? (
        <>
          <Text style={s.error}>{error}</Text>
          <TouchableOpacity onPress={() => router.replace('/')} activeOpacity={0.7}>
            <Text style={s.link}>Back to log in</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  error:  { color: colors.danger, fontSize: 15, textAlign: 'center' },
  link:   { color: colors.accent, fontSize: 14 },
})
