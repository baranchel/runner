import { useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MOCK_RUNS } from '../../src/mockData'
import type { Run } from '../../src/types'
import { TYPE_MAP } from '../../src/components/RunPickerList'
import { COMPARE_METRICS, betterValue } from '../../src/utils/compare'
import { fmtDateFull } from '../../src/utils/format'
import { colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'

const UNIT = 'km' as const

// table head cell for one run: type (in its color) + date; tap opens Run Detail
function RunHeadCell({ run }: { run: Run }) {
  const router = useRouter()
  const type = run.typeId ? TYPE_MAP[run.typeId] : undefined
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost
  return (
    <TouchableOpacity style={s.headCell} activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}`)}>
      <View style={[s.headBar, { backgroundColor: typeColor }]} />
      <Text style={s.headType} numberOfLines={1}>{type?.name ?? 'Unclassified'}</Text>
      <Text style={s.headDate}>{fmtDateFull(run.date)}</Text>
    </TouchableOpacity>
  )
}

// centered value; the better one (toggle on) sits in an accent pill
function ValueCell({ text, better }: { text: string; better: boolean }) {
  return (
    <View style={s.valCell}>
      <View style={[s.valPill, better && s.valPillBetter]}>
        <Text style={[s.valText, better && s.valTextBetter]}>{text}</Text>
      </View>
    </View>
  )
}

export default function CompareResult() {
  const { a, b } = useLocalSearchParams<{ a?: string; b?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [highlight, setHighlight] = useState(false)

  const runA = MOCK_RUNS.find(r => r.id === a)
  const runB = MOCK_RUNS.find(r => r.id === b)

  const backButton = (
    <TouchableOpacity onPress={() => router.back()} style={[s.backFab, { top: insets.top + 12 }]} activeOpacity={0.7}>
      <Text style={s.backFabIcon}>‹</Text>
    </TouchableOpacity>
  )

  if (!runA || !runB) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Text style={s.notFound}>Run not found</Text>
        {backButton}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>Highlight better results</Text>
          <Switch
            value={highlight}
            onValueChange={setHighlight}
            trackColor={{ true: colors.accentBg, false: colors.borderFocus }}
            ios_backgroundColor={colors.borderFocus}
          />
        </View>

        <View style={s.table}>
          <View style={[s.row, s.headRow]}>
            <View style={s.metricCell} />
            <RunHeadCell run={runA} />
            <RunHeadCell run={runB} />
          </View>
          {COMPARE_METRICS.map((m, i) => {
            const va = m.get(runA)
            const vb = m.get(runB)
            const better = highlight ? betterValue(m, runA, runB) : null
            return (
              <View key={m.label} style={[s.row, i % 2 === 1 && s.rowAlt]}>
                <Text style={s.metricCell}>{m.label}</Text>
                <ValueCell text={va == null ? '—' : m.fmt(va, UNIT)} better={better === 'a'} />
                <ValueCell text={vb == null ? '—' : m.fmt(vb, UNIT)} better={better === 'b'} />
              </View>
            )
          })}
        </View>
      </ScrollView>
      {backButton}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { padding: spacing.screenH, paddingTop: 72, gap: spacing.gap },

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

  toggleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },

  table: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  rowAlt:  { backgroundColor: colors.bgCard },
  headRow: {
    backgroundColor: colors.bgElevated,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },

  // equal-width columns: metric label | run 1 | run 2
  metricCell: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  headCell:   { flex: 1, alignItems: 'center', gap: 3 },
  headBar:    { width: 24, height: 4, borderRadius: 2, marginBottom: 4 },
  headType:   { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  headDate:   { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },

  valCell:       { flex: 1, alignItems: 'center' },
  valPill:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  valPillBetter: { backgroundColor: colors.accentDim },
  valText:       { fontFamily: fonts.mono, fontSize: 14, color: colors.textPrimary },
  valTextBetter: { color: colors.accent, fontWeight: '700' },

  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 80 },
})
