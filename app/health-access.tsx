import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { importNewRuns } from '../src/healthkit/importRuns'
import { requestHealthAccess, skipHealth } from '../src/healthkit/permissions'
import { buttons, colors, fonts } from '../src/utils/tokens'

// After login: why we need Apple Health → iOS prompt → first import → Dashboard.
// (RA-11's personal-info form will slot in before the Dashboard.)
export default function HealthAccess() {
  const router = useRouter()
  const [progress, setProgress] = useState<string | null>(null)

  const connect = async () => {
    if (progress) return
    setProgress('Waiting for Apple Health…')
    try {
      await requestHealthAccess()
      setProgress('Importing your runs…')
      await importNewRuns((done, total) => setProgress(`Importing ${done} / ${total} runs`))
    } finally {
      router.replace('/(tabs)/dashboard')  // never strand the user here (both calls already swallow errors)
    }
  }

  const later = () => { skipHealth(); router.replace('/(tabs)/dashboard') }

  return (
    <View style={s.container}>
      <Text style={s.title}>Connect Apple Health</Text>
      <Text style={s.body}>
        Chronodrom builds your run history from Apple Health: your runs, heart rate, splits and body data.
        It only reads — it never writes to Apple Health.
      </Text>
      <TouchableOpacity style={[buttons.primary, s.cta]} onPress={connect} activeOpacity={0.82}>
        <Text style={[buttons.primaryText, s.ctaText]}>{progress ?? 'Connect'}</Text>
      </TouchableOpacity>
      {!progress && (
        <TouchableOpacity onPress={later} activeOpacity={0.7}>
          <Text style={s.later}>Not now</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: 24, justifyContent: 'center', gap: 18 },
  title:     { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 25, fontWeight: '600' },
  body:      { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  cta:       { marginTop: 12, paddingVertical: 15, alignSelf: 'stretch' },
  ctaText:   { fontSize: 15 },
  later:     { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },
})
