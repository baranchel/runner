// Insights tab (RA-29): Apple Health metrics as grouped trend cards. Layout from the Figma
// "01 Data & insights" heading + dark card style; one colour per group; lime kept for future insight cards.
import { useCallback, useEffect } from 'react'
import { ActivityIndicator, AppState, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Sparkline } from '../../src/components/Chart'
import { GROUPS, type Metric } from '../../src/insights/metrics'
import { addDays, cardText, hasData, isHidden, orderedMetrics, type MetricData } from '../../src/insights/summary'
import { useInsightsStore } from '../../src/store/useInsightsStore'
import { useProfileStore } from '../../src/store/useProfileStore'
import { fmtHMM } from '../../src/utils/format'
import { isoDate } from '../../src/utils/profile'
import { buttons, colors, fonts, groupColors, groupLabelColors, sleepColors } from '../../src/utils/tokens'

const WIDE = new Set(['hrEvents', 'vo2max', 'sleep', 'otherWorkouts'])

export default function Insights() {
  const router = useRouter()
  const data = useInsightsStore(s => s.data)
  const loading = useInsightsStore(s => s.loading)
  const loadedAt = useInsightsStore(s => s.loadedAt)
  const load = useInsightsStore(s => s.load)
  const layout = useProfileStore(s => s.profile?.insights_layout ?? null)

  useFocusEffect(useCallback(() => { load() }, [load]))
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') load() })
    return () => sub.remove()
  }, [load])

  const now = new Date()
  const shown = orderedMetrics(layout).filter(m => !isHidden(layout, m.key) && hasData(data[m.key]))
  const noHealth = loadedAt > 0 && !Object.values(data).some(hasData)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading && loadedAt > 0} onRefresh={() => load(true)} tintColor={colors.textSecondary} />}
      >
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Your body,{'\n'}over time.</Text>
            <Text style={s.sub}>From Apple Health · last 30 days</Text>
          </View>
          {loadedAt > 0 && !noHealth && (
            <TouchableOpacity style={buttons.outline} onPress={() => router.push('/insights-edit')} activeOpacity={0.7}>
              <Text style={buttons.outlineText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {loadedAt === 0 && <ActivityIndicator color={colors.textSecondary} style={{ marginVertical: 60 }} />}

        {noHealth && (
          <View style={s.empty}>
            <Text style={s.emptyText}>Allow Apple Health access to see your data here.</Text>
            <TouchableOpacity style={buttons.outline} onPress={() => Linking.openSettings()} activeOpacity={0.7}>
              <Text style={buttons.outlineText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {GROUPS.map(g => {
          const ms = shown.filter(m => m.group === g.key)
          if (!ms.length) return null
          return (
            <View key={g.key} style={s.group}>
              <View style={s.gh}>
                <View style={s.ghLeft}>
                  <View style={[s.gdot, { backgroundColor: groupColors[g.key] }]} />
                  <Text style={s.gtitle}>{g.title}</Text>
                </View>
                {g.note && <Text style={s.gnote}>{g.note}</Text>}
              </View>
              <View style={s.grid}>
                {ms.map(m => (
                  <Card key={m.key} m={m} d={data[m.key]} now={now} onPress={() => router.push(`/insight/${m.key}`)} />
                ))}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

function Card({ m, d, now, onPress }: { m: Metric; d: MetricData; now: Date; onPress: () => void }) {
  const t = cardText(m, d, now)
  const color = groupColors[m.group]
  const from = addDays(isoDate(now), -29)
  const last30 = d.points.filter(p => p.date >= from)
  const night = m.kind === 'sleep' ? d.nights?.at(-1) : undefined
  return (
    <TouchableOpacity style={[s.card, WIDE.has(m.key) && s.wide]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.lbl, { color: groupLabelColors[m.group] }]}>{m.label}</Text>
      <Text style={s.val}>{t.value}{t.unit ? <Text style={s.unit}> {t.unit}</Text> : null}</Text>
      {!!t.meta && <Text style={s.meta} numberOfLines={1}>{t.meta}</Text>}
      {night && (
        <>
          <View style={s.stages}>
            {(['awake', 'core', 'deep', 'rem'] as const).map(k => night[k] > 0 && (
              <View key={k} style={{ flex: night[k], backgroundColor: sleepColors[k] }} />
            ))}
          </View>
          <View style={s.legend}>
            {(['awake', 'core', 'deep', 'rem'] as const).map(k => night[k] > 0 && (
              <View key={k} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: sleepColors[k] }]} />
                <Text style={s.legendText}>{k === 'rem' ? 'REM' : k[0].toUpperCase() + k.slice(1)} {fmtHMM(night[k])}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {(m.kind === 'line' || m.kind === 'bars') && last30.length > 0 && (
        <View style={s.spark}>
          <Sparkline points={last30} kind={m.kind} color={color} height={WIDE.has(m.key) ? 40 : 30} />
        </View>
      )}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 },
  head:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 22 },
  title:   { fontFamily: fonts.body, fontSize: 26, lineHeight: 30, fontWeight: '700', color: colors.textPrimary },
  sub:     { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, marginTop: 4 },
  empty:   { alignItems: 'center', gap: 14, paddingVertical: 60 },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  group:   { marginBottom: 22 },
  gh:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  ghLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gdot:    { width: 9, height: 9, borderRadius: 3 },
  gtitle:  { fontFamily: fonts.body, fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  gnote:   { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, justifyContent: 'space-between' },
  card:    { width: '48.5%', minHeight: 128, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault,
             borderRadius: 16, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  wide:    { width: '100%', minHeight: 0 },
  lbl:     { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  val:     { fontFamily: fonts.mono, fontSize: 26, fontWeight: '600', color: colors.textPrimary, marginTop: 6 },
  unit:    { fontFamily: fonts.body, fontSize: 12, fontWeight: '500', color: colors.textMuted },
  meta:    { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 4 },
  spark:   { marginTop: 'auto', paddingTop: 8 },
  stages:  { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 10 },
  legend:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 7, height: 7, borderRadius: 2 },
  legendText: { fontFamily: fonts.body, fontSize: 10, color: colors.textFaint },
})
