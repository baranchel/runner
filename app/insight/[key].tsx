// Insights detail (RA-29): one metric over Month / 3 months / Year / All, read live from Apple Health.
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TrendChart } from '../../src/components/Chart'
import { readMetric } from '../../src/healthkit/insights'
import { METRICS } from '../../src/insights/metrics'
import {
  bucketFor, cardText, EVENT_LABEL, fmtNum, hasData, PERIODS, periodStart, stats,
  type MetricData, type Period,
} from '../../src/insights/summary'
import { useInsightsStore } from '../../src/store/useInsightsStore'
import { fmtDate, fmtHMM } from '../../src/utils/format'
import { isoDate } from '../../src/utils/profile'
import { colors, fonts, groupColors } from '../../src/utils/tokens'

export default function InsightDetail() {
  const { key } = useLocalSearchParams<{ key: string }>()
  const metric = METRICS.find(m => m.key === key)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const cached = useInsightsStore(s => s.data[key])
  const [period, setPeriod] = useState<Period>('3m')
  const [d, setD] = useState<MetricData | null>(null)

  useEffect(() => {
    if (!metric) return
    let live = true
    setD(null)
    readMetric(metric, periodStart(period, new Date()), bucketFor(period)).then(r => { if (live) setD(r) })
    return () => { live = false }
  }, [metric, period])

  if (!metric) return <Redirect href="/health" />
  const color = groupColors[metric.group]
  const head = hasData(cached) ? cardText(metric, cached, new Date()) : null
  const hours = metric.kind === 'sleep' || metric.kind === 'workouts'   // points are hours → show h:mm
  const format = (v: number) => (hours ? fmtHMM(v * 3600) : fmtNum(v, metric.decimals))
  const st = d && metric.kind !== 'events' ? stats(d.points) : null
  const typeTotals = metric.kind === 'workouts' && d?.weeks
    ? Object.entries(d.weeks.reduce<Record<string, number>>((acc, w) => {
        for (const [t, s] of Object.entries(w.byType)) acc[t] = (acc[t] ?? 0) + s
        return acc
      }, {})).sort((a, b) => b[1] - a[1])
    : []

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      <View style={s.back}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.iconText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.backTitle}>{metric.label}</Text>
      </View>

      {head && (
        <>
          <Text style={s.big}>{head.value}{head.unit ? <Text style={s.bigUnit}> {head.unit}</Text> : null}</Text>
          {!!head.meta && <Text style={s.meta}>{head.meta}</Text>}
        </>
      )}

      <View style={s.seg}>
        {PERIODS.map(p => (
          <TouchableOpacity key={p.key} style={[s.segItem, period === p.key && s.segOn]} onPress={() => setPeriod(p.key)} activeOpacity={0.7}>
            <Text style={[s.segText, period === p.key && s.segTextOn]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!d ? (
        <ActivityIndicator color={colors.textSecondary} style={{ marginVertical: 60 }} />
      ) : metric.kind === 'events' ? (
        <View style={s.list}>
          {!d.events?.length && <Text style={s.none}>No notifications in this period.</Text>}
          {[...(d.events ?? [])].reverse().map((e, i) => (
            <View key={i} style={[s.row, i > 0 && s.rowBorder]}>
              <Text style={s.rowName}>{EVENT_LABEL[e.type]}</Text>
              <Text style={s.rowVal}>{fmtDate(isoDate(e.start))}, {String(e.start.getHours()).padStart(2, '0')}:{String(e.start.getMinutes()).padStart(2, '0')}</Text>
            </View>
          ))}
        </View>
      ) : d.points.length === 0 ? (
        <Text style={s.none}>No data in this period.</Text>
      ) : (
        <View style={s.chartBox}>
          <TrendChart points={d.points} kind={metric.kind === 'line' ? 'line' : 'bars'} color={color} format={format} />
        </View>
      )}

      {st && (
        <View style={s.stats}>
          {([['Min', st.min], ['Avg', st.avg], ['Max', st.max]] as const).map(([l, v]) => (
            <View key={l} style={s.stat}>
              <Text style={s.statLbl}>{l}</Text>
              <Text style={s.statVal}>{format(v)}</Text>
            </View>
          ))}
        </View>
      )}

      {typeTotals.length > 0 && (
        <View style={[s.list, { marginTop: 12 }]}>
          {typeTotals.map(([t, sec], i) => (
            <View key={t} style={[s.row, i > 0 && s.rowBorder]}>
              <Text style={s.rowName}>{t}</Text>
              <Text style={s.rowVal}>{fmtHMM(sec)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={s.explain}>{metric.explain}</Text>
      <Text style={s.src}>From Apple Health. Read-only.</Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bgApp },
  content:  { paddingHorizontal: 18, paddingBottom: 40 },
  back:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  iconBtn:  { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, lineHeight: 24, color: colors.textPrimary },
  backTitle:{ fontFamily: fonts.body, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  big:      { fontFamily: fonts.mono, fontSize: 44, fontWeight: '600', color: colors.textPrimary },
  bigUnit:  { fontFamily: fonts.body, fontSize: 15, fontWeight: '500', color: colors.textMuted },
  meta:     { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 4 },
  seg:      { flexDirection: 'row', backgroundColor: colors.bgSurface, borderRadius: 12, padding: 3, marginTop: 16, marginBottom: 12 },
  segItem:  { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  segOn:    { backgroundColor: colors.bgElevated },
  segText:  { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  segTextOn:{ color: colors.textPrimary, fontWeight: '600' },
  chartBox: { backgroundColor: colors.bgChart, borderRadius: 16, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8 },
  none:     { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, textAlign: 'center', marginVertical: 40 },
  stats:    { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat:     { flex: 1, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  statLbl:  { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textDim },
  statVal:  { fontFamily: fonts.mono, fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: 4 },
  list:     { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 16 },
  row:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  rowBorder:{ borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  rowName:  { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
  rowVal:   { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
  explain:  { marginTop: 14, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 16,
              padding: 14, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  src:      { marginTop: 10, fontFamily: fonts.body, fontSize: 11, color: colors.textGhost },
})
