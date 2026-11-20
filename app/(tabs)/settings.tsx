import { useState } from 'react'
import { Alert, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, fonts } from '../../src/utils/tokens'
import { signOut, deleteAccount } from '../../src/api/auth'
import { clearAll, pendingCount } from '../../src/db/queries'
import { syncNow } from '../../src/db/sync'
import { useRunStore } from '../../src/store/useRunStore'

export default function Settings() {
  const [error,      setError]      = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed,      setTyped]      = useState('')
  const [busy,       setBusy]       = useState(false)

  const seedSampleRuns = useRunStore(s => s.seedSampleRuns)

  const [loggingOut, setLoggingOut] = useState(false)

  // gate redirects to login on success; an explicit logout wipes the phone's copy
  const doLogOut = async () => {
    const err = await signOut()
    if (!err) clearAll()
    setError(err)
  }

  // Try to upload first; warn if changes would be lost.
  const logOut = async () => {
    if (loggingOut) return
    setError(null); setLoggingOut(true)
    await syncNow()
    setLoggingOut(false)
    if (pendingCount() === 0) return doLogOut()
    Alert.alert(
      'Unsynced changes',
      "Some changes haven't reached the cloud yet. Logging out now will lose them.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out anyway', style: 'destructive', onPress: doLogOut },
      ],
    )
  }

  const seed = () => {
    const err = seedSampleRuns()
    Alert.alert(err ?? 'Sample runs added')
  }

  const remove = async () => {
    if (typed !== 'DELETE' || busy) return
    setBusy(true); setError(null)
    const err = await deleteAccount()
    setBusy(false)
    if (err) setError(err)  // on success the gate redirects to login
    else clearAll()
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Settings</Text>

      {__DEV__ && (
        <TouchableOpacity style={s.btn} onPress={seed} activeOpacity={0.82}>
          <Text style={s.btnText}>Load sample runs (dev)</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={s.btn} onPress={logOut} activeOpacity={0.82}>
        <Text style={s.btnText}>{loggingOut ? 'Syncing…' : 'Log out'}</Text>
      </TouchableOpacity>

      {!confirming ? (
        <TouchableOpacity style={s.btn} onPress={() => setConfirming(true)} activeOpacity={0.82}>
          <Text style={[s.btnText, { color: colors.danger }]}>Delete account</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.dangerBox}>
          <Text style={s.body}>This permanently deletes your account and all your data. This can't be undone.</Text>
          <Text style={s.body}>Type DELETE to confirm.</Text>
          <TextInput style={s.input} value={typed} onChangeText={setTyped}
            autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor={colors.textGhost} />
          <TouchableOpacity style={[s.dangerBtn, typed !== 'DELETE' && { opacity: 0.5 }]}
            onPress={remove} disabled={typed !== 'DELETE' || busy} activeOpacity={0.82}>
            <Text style={s.dangerBtnText}>{busy ? 'Deleting…' : 'Delete my account'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setConfirming(false); setTyped('') }} activeOpacity={0.7}>
            <Text style={s.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && <Text style={s.error}>{error}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: 24, paddingTop: 80, gap: 14 },
  title:     { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 22, fontWeight: '700', marginBottom: 10 },
  btn:       { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  btnText:   { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600' },
  dangerBox: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 16, gap: 10 },
  body:      { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  input:     { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, color: colors.textPrimary, fontSize: 15 },
  dangerBtn: { backgroundColor: colors.danger, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  dangerBtnText: { color: '#fff', fontFamily: fonts.body, fontSize: 15, fontWeight: '700' },
  cancel:    { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 12, marginTop: 6 },
  error:     { color: colors.danger, fontFamily: fonts.body, fontSize: 13 },
})
