// Insights tab: "what you can understand from your data" (RA-45). Coming soon until RA-45 ships.
// Spec: docs/superpowers/specs/2026-11-27-tab-layout-design.md
import { Image, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fonts } from '../../src/utils/tokens'

export default function Insights() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <Text style={s.title}>Insights</Text>
      <View style={s.center}>
        <View style={s.tile}><Image source={require('../../assets/tab-insights.png')} style={s.tileIcon} /></View>
        <Text style={s.head}>Coming soon</Text>
        <Text style={s.body}>Insights will explain what your running and health data mean, in plain words.</Text>
        <Text style={s.note}>Your health cards moved to the Health tab.</Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bgApp },
  title:     { fontFamily: fonts.body, fontSize: 25, fontWeight: '600', color: colors.textPrimary, paddingHorizontal: 24, paddingTop: 14 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  tile:      { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileIcon:  { width: 30, height: 30, tintColor: colors.lime },
  head:      { fontFamily: fonts.body, fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  body:      { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center' },
  note:      { fontFamily: fonts.body, fontSize: 12, color: colors.textGhost, textAlign: 'center' },
})
