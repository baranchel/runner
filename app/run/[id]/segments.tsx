import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../../../src/mockData'
import { SEGMENT_DISPLAY } from '../../../src/components/SegmentsTable'
import { fmtDistance, fmtMMSS, fmtPace } from '../../../src/utils/format'
import { colors, fonts, runTypeColor } from '../../../src/utils/tokens'

const UNIT = 'km' as const
const TYPE_MAP = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))

const ROW_H = 54
const HEADER_H = 38
const PINNED_W = 128
// scrollable metric columns
const COL = { dist: 92, time: 80, pace: 108, hr: 112 }

export default function SegmentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const run = MOCK_RUNS.find(r => r.id === id)

  if (!run || !run.segments) {
    return (
      <View style={[s.screen, s.center]}>
        <Text style={s.notFound}>Segments not found</Text>
      </View>
    )
  }

  const type = run.typeId ? TYPE_MAP[run.typeId] : null
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost
  const segments = run.segments

  return (
    <View style={s.screen}>
      {/* header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} activeOpacity={0.7}>
          <Text style={s.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Segments</Text>
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={s.tableRow}>
          {/* pinned: index + name */}
          <View>
            <View style={{ height: HEADER_H }} />
            {segments.map((seg, i) => {
              const display = SEGMENT_DISPLAY[seg.type] ?? { label: seg.type, color: () => colors.textMuted }
              const dotColor = display.color(typeColor)
              return (
                <View key={i} style={[s.pinRow, i > 0 && s.sep]}>
                  <Text style={s.idx}>{i + 1}</Text>
                  <View style={[s.dot, { backgroundColor: dotColor }]} />
                  <Text style={[s.name, { color: dotColor }]} numberOfLines={1}>{display.label}</Text>
                </View>
              )
            })}
          </View>

          {/* scrollable: metrics */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.scrollArea}>
            <View>
              <View style={[s.metricRow, { height: HEADER_H }]}>
                <Text style={[s.hdr, { width: COL.dist }]}>Distance</Text>
                <Text style={[s.hdr, { width: COL.time }]}>Time</Text>
                <Text style={[s.hdr, { width: COL.pace }]}>Pace</Text>
                <Text style={[s.hdr, { width: COL.hr }]}>Heart Rate</Text>
              </View>
              {segments.map((seg, i) => {
                const pace = seg.distanceKm > 0 ? seg.timeSec / seg.distanceKm : 0
                return (
                  <View key={i} style={[s.metricRow, i > 0 && s.sep]}>
                    <Text style={[s.val, { width: COL.dist, color: colors.iconGold }]}>{fmtDistance(seg.distanceKm, UNIT)}</Text>
                    <Text style={[s.val, { width: COL.time, color: colors.iconTeal }]}>{fmtMMSS(seg.timeSec)}</Text>
                    <Text style={[s.val, { width: COL.pace, color: colors.iconOrange }]}>{pace > 0 ? fmtPace(pace, UNIT) : '—'}</Text>
                    <Text style={[s.val, { width: COL.hr, color: colors.hrLine }]}>{seg.avgHr != null ? `${seg.avgHr} bpm` : '—'}</Text>
                  </View>
                )
              })}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  center: { alignItems: 'center', justifyContent: 'center' },
  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  closeBtn: {
    position: 'absolute',
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon:   { fontFamily: fonts.body, fontSize: 16, color: colors.textPrimary },
  headerTitle: { fontFamily: fonts.body, fontSize: 18, fontWeight: '800', color: colors.textPrimary },

  body:      { flex: 1, paddingHorizontal: 18 },
  tableRow:  { flexDirection: 'row' },
  scrollArea:{ flex: 1 },

  pinRow:    { width: PINNED_W, height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 10 },
  idx:       { fontFamily: fonts.mono, fontSize: 14, color: colors.textMuted, width: 22 },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  name:      { fontFamily: fonts.body, fontSize: 13, flexShrink: 1 },

  metricRow: { flexDirection: 'row', alignItems: 'center', height: ROW_H },
  hdr:       { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, paddingRight: 18 },
  val:       { fontFamily: fonts.mono, fontSize: 14, color: colors.textPrimary, paddingRight: 18 },

  sep:       { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
})
