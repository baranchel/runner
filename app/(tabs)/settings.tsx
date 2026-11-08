import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, fonts } from '../../src/utils/tokens'
import { signOut } from '../../src/api/auth'

export default function Settings() {
  const [error, setError] = useState<string | null>(null)

  const logOut = async () => { setError(null); setError(await signOut()) }  // gate redirects to login on success

  return (
    <View style={s.container}>
      <Text style={s.title}>Settings</Text>

      <TouchableOpacity style={s.btn} onPress={logOut} activeOpacity={0.82}>
        <Text style={s.btnText}>Log out</Text>
      </TouchableOpacity>

      {error && <Text style={s.error}>{error}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: 24, paddingTop: 80, gap: 14 },
  title:     { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 22, fontWeight: '700', marginBottom: 10 },
  btn:       { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  btnText:   { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600' },
  error:     { color: colors.danger, fontFamily: fonts.body, fontSize: 13 },
})
