import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { colors } from '../src/utils/tokens'
import { exchangeAuthCode, updatePassword } from '../src/api/auth'
import { PASSWORD_RULES, passwordValid } from '../src/utils/password'

// Opened by the reset email link: chronodrom://reset-password?code=…
// Always reachable in the gate, so it is not redirected away when the recovery session appears.
export default function ResetPassword() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  const [ready,    setReady]    = useState(false)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const started = useRef(false)  // the code is single-use; never exchange twice

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!code) { setError('Link expired. Request a new one'); return }
    exchangeAuthCode(code).then(err => (err ? setError(err) : setReady(true)))
  }, [code])

  const canSubmit = passwordValid(password) && password === confirm && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true); setError(null)
    const err = await updatePassword(password)
    setBusy(false)
    if (err) setError(err)
    else router.replace('/')  // logged in → dashboard
  }

  if (!ready) {
    return (
      <View style={[s.screen, { alignItems: 'center' }]}>
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

  return (
    <View style={s.screen}>
      <Text style={s.title}>Set a new password</Text>
      <TextInput style={s.input} placeholder="New password" placeholderTextColor={colors.textGhost}
        value={password} onChangeText={setPassword} secureTextEntry contextMenuHidden />
      <TextInput style={s.input} placeholder="Confirm new password" placeholderTextColor={colors.textGhost}
        value={confirm} onChangeText={setConfirm} secureTextEntry contextMenuHidden
        returnKeyType="done" onSubmitEditing={submit} />
      {PASSWORD_RULES.map(({ label, test }) => (
        <Text key={label} style={{ fontSize: 12, color: test(password) ? '#4ade80' : colors.textMuted }}>• {label}</Text>
      ))}
      {confirm.length > 0 && confirm !== password && <Text style={s.error}>Passwords don't match</Text>}
      {error && <Text style={s.error}>{error}</Text>}
      <TouchableOpacity style={[s.primaryBtn, !canSubmit && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit} activeOpacity={0.82}>
        <Text style={s.primaryBtnText}>{busy ? 'Saving…' : 'Save password'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp, justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  title:  { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  input:  { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 16, color: colors.textPrimary, fontSize: 15 },
  error:  { fontSize: 13, color: colors.danger },
  primaryBtn:     { backgroundColor: colors.accentBg, borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#f5eeff', fontSize: 15, fontWeight: '700' },
  link:   { fontSize: 14, color: colors.accent, textAlign: 'center' },
})
