import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MOCK_RUNS } from '../../../src/mockData'
import { fmtMMSS } from '../../../src/utils/format'
import { colors, fonts, spacing, zoneColor } from '../../../src/utils/tokens'
import { ZONE_NAMES, zoneRangeLabel } from '../../../src/utils/zones'
import { hrSeries } from '../../../src/utils/chart'
import { HrRangeBarsChart } from '../../../src/components/Chart'

export default function ZonesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [trackW, setTrackW] = useState(0)
  const run = MOCK_RUNS.find(r => r.id === id)

  if (!run) {
    return (
      <View style={[s.screen, s.center]}>
        <Text style={s.notFound}>Run not found</Text>
      </View>
    )
  }

  const zones = run.zones
  const total = zones ? zones.reduce((a, b) => a + b, 0) : 0

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} activeOpacity={0.7}>
          <Text style={s.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Heart Rate</Text>
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: spacing.gap }}>
        <View style={s.chartCard}>
          <HrRangeBarsChart dots={hrSeries(run)} timeSec={run.timeSec} plotH={150} />
        </View>

        <Text style={s.sectionLabel}>ZONES</Text>
        {zones ? (
          <View style={s.zones}>
            {zones.map((sec, i) => {
              const pct = total > 0 ? Math.round((sec / total) * 100) : 0
              const pctStr = `${pct}%`
              // % goes after the bar; if it won't fit in the remaining track space, put it inside the bar
              const fillPx = (trackW * pct) / 100
              const estPctW = pctStr.length * 7.3 + 10
              const pctAfter = trackW === 0 || (trackW - fillPx) >= estPctW
              return (
                <View key={i} style={s.zoneRow}>
                  <View style={s.zoneLabel}>
                    <Text style={[s.zoneNum, { color: zoneColor(i) }]}>{i + 1}</Text>
                    <View style={s.zoneText}>
                      <Text style={s.zoneName} numberOfLines={1}>{ZONE_NAMES[i]}</Text>
                      <Text style={s.zoneRange} numberOfLines={1}>{zoneRangeLabel(i)}</Text>
                    </View>
                  </View>
                  <View
                    style={s.barTrack}
                    onLayout={e => { if (!trackW) setTrackW(e.nativeEvent.layout.width) }}
                  >
                    {sec > 0 && (
                      <View style={[s.barFill, { width: `${pct}%`, backgroundColor: zoneColor(i) }]}>
                        {!pctAfter && <Text style={s.pctIn} numberOfLines={1}>{pctStr}</Text>}
                      </View>
                    )}
                    {(sec === 0 || pctAfter) && <Text style={s.pctOut} numberOfLines={1}>{pctStr}</Text>}
                  </View>
                  <Text style={s.zoneTime} numberOfLines={1}>{fmtMMSS(sec)}</Text>
                </View>
              )
            })}
          </View>
        ) : (
          <Text style={s.noData}>No zone data for this run</Text>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bgApp },
  center:   { alignItems: 'center', justifyContent: 'center' },
  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 28, paddingBottom: 14, paddingHorizontal: 14 },
  closeBtn: {
    position: 'absolute', left: 14, width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon:   { fontFamily: fonts.body, fontSize: 16, color: colors.textPrimary },
  headerTitle: { fontFamily: fonts.body, fontSize: 18, fontWeight: '800', color: colors.textPrimary },

  body: { flex: 1, paddingHorizontal: 18 },
  chartCard: { backgroundColor: colors.bgChart, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: spacing.radius, overflow: 'hidden' },

  sectionLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, letterSpacing: 0.6 },
  noData: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },

  zones: { gap: 10 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zoneLabel: { width: 92, flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneNum: { fontFamily: fonts.mono, fontSize: 16, fontWeight: '700' },
  zoneText: { flexShrink: 1 },
  zoneName: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  zoneRange: { fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint, marginTop: 1 },
  barTrack: { flex: 1, height: 26, backgroundColor: colors.bgElevated, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  barFill: { height: 26, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 8 },
  pctIn:  { fontFamily: fonts.mono, fontSize: 12, color: colors.bgApp },
  pctOut: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, paddingLeft: 6 },
  zoneTime: { width: 52, textAlign: 'right', fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
})
