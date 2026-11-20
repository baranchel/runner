import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { CompareView } from '../../src/components/CompareView'
import { useRunStore } from '../../src/store/useRunStore'
import { colors, fonts, spacing } from '../../src/utils/tokens'

// Entry from All runs' "Compare ›" and Run Detail's sheet: same view, runs pre-filled.
export default function CompareResult() {
  const { a, b } = useLocalSearchParams<{ a?: string; b?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const runs = useRunStore(s => s.runs)

  // newer run is always A
  const [runA, runB] = [runs.find(r => r.id === a), runs.find(r => r.id === b)]
    .sort((x, y) => (y?.date ?? '').localeCompare(x?.date ?? ''))

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {runA && runB
        ? <CompareView initialA={runA} initialB={runB} topPad={68} />
        : <Text style={s.notFound}>Run not found</Text>}
      <TouchableOpacity onPress={() => router.back()} style={[s.backFab, { top: insets.top + 12 }]} activeOpacity={0.7}>
        <Text style={s.backFabIcon}>‹</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  backFab: {
    position: 'absolute', left: spacing.screenH, width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  backFabIcon: { fontFamily: fonts.body, fontSize: 28, lineHeight: 30, color: colors.textPrimary, marginTop: -3, marginLeft: -2 },
  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 80 },
})
