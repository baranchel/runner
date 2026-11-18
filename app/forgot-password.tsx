import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '../src/utils/tokens'
import { resetPassword } from '../src/api/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent,  setSent]  = useState(false)

  const submit = async () => {
    if (!email.trim() || busy) return
    setBusy(true); setError(null)
    const err = await resetPassword(email.trim())
    setBusy(false)
    if (err) setError(err)
    else setSent(true)  // same message whether or not the account exists
  }

  return (
    <View style={s.screen}>
      <Text style={s.title}>Reset password</Text>
      {sent ? (
        <Text style={s.body}>If an account exists for {email.trim()}, we sent a reset link. Open it on this phone.</Text>
      ) : (
        <>
          <Text style={s.body}>Enter your email and we'll send you a link to set a new password.</Text>
          <TextInput
            style={s.input}
            placeholder="your@email.com"
            placeholderTextColor={colors.textGhost}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          {error && <Text style={s.error}>{error}</Text>}
          <TouchableOpacity style={s.primaryBtn} onPress={submit} activeOpacity={0.82}>
            <Text style={s.primaryBtnText}>{busy ? 'Sending…' : 'Send reset link'}</Text>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={s.link}>Back to log in</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp, justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  title:  { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  body:   { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  input:  { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 16, color: colors.textPrimary, fontSize: 15 },
  error:  { fontSize: 13, color: colors.danger },
  primaryBtn:     { backgroundColor: colors.accentBg, borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#f5eeff', fontSize: 15, fontWeight: '700' },
  link:   { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
})
