import { StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fonts } from '../../src/utils/tokens'

// Placeholder until the Figma "Data & insights" screen is built.
export default function Insights() {
  return (
    <SafeAreaView style={s.safe}>
      <Text style={s.title}>Insights</Text>
      <Text style={s.sub}>Coming soon</Text>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bgApp, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontFamily: fonts.body, fontSize: 19, fontWeight: '600', color: colors.textPrimary },
  sub:   { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
})
