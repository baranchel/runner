import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../../../src/mockData'
import { SplitsTable } from '../../../src/components/SplitsTable'
import { fmtDateFull } from '../../../src/utils/format'
import { colors, fonts, spacing } from '../../../src/utils/tokens'

const UNIT = 'km' as const
const TYPE_MAP = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))

export default function SplitsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const run = MOCK_RUNS.find(r => r.id === id)

  if (!run) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Text style={s.notFound}>Run not found</Text>
      </SafeAreaView>
    )
  }

  const type = run.typeId ? TYPE_MAP[run.typeId] : null

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Splits</Text>
        <Text style={s.subtitle}>{type?.name ?? 'Unclassified'} · {fmtDateFull(run.date)}</Text>
        <SplitsTable run={run} unit={UNIT} />
      </ScrollView>

      {/* floating back button — matches the run detail screen */}
      <TouchableOpacity onPress={() => router.back()} style={[s.backFab, { top: insets.top + 12 }]} activeOpacity={0.7}>
        <Text style={s.backFabIcon}>‹</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { padding: spacing.screenH, paddingTop: 72, gap: spacing.gap },

  title:    { fontFamily: fonts.body, fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2, marginBottom: 4 },

  backFab: {
    position: 'absolute',
    left: spacing.screenH,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  backFabIcon: {
    fontFamily: fonts.body,
    fontSize: 28,
    lineHeight: 30,
    color: colors.textPrimary,
    marginTop: -3,
    marginLeft: -2,
  },

  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
})
