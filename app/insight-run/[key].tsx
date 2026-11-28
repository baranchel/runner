// Running insight detail (RA-45): the series behind one running insight, how it is worked out, and the runs it uses.
// Shared by every running card (and the load + HRV card). Text = the same daily wording as the card.
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TrendChart } from '../../src/components/Chart'
import { RunCard } from '../../src/components/RunCard'
import type { InsightKey } from '../../src/insights/rules'
import { fmtNum } from '../../src/insights/summary'
import { useFeed } from '../../src/insights/useFeed'
import { useRunStore } from '../../src/store/useRunStore'
import { fmtMMSS } from '../../src/utils/format'
import { colors, fonts } from '../../src/utils/tokens'

// Axis labels have ~4–5 characters of room (TrendChart), so no units here.
const FORMAT: Partial<Record<InsightKey, (v: number) => string>> = {
  efficiency: v => fmtMMSS(v),
  z2Share: v => `${Math.round(v)}%`,
  longest: v => v.toFixed(1),
}
const MAX_ROWS = 20   // a long streak can cover 100+ runs; the newest 20 are enough here

export default function RunInsight() {
  const { key } = useLocalSearchParams<{ key: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { feed, words } = useFeed()
  const runs = useRunStore(s => s.runs)
  const f = [feed.hero, ...feed.running].find(x => x?.key === key && x.side === 'running')
  if (!f) return <Redirect href="/insights" />
  const w = words.get(f.key)!
  const ids = new Set(f.runIds ?? [])
  const based = runs.filter(r => ids.has(r.id))   // store order = newest first

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      <View style={s.back}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.iconText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.eyebrow}>{w.eyebrow}</Text>
      </View>

      <Text style={s.headline}>{w.headline}</Text>
      {!!w.meaning && <Text style={s.meaning}>{w.meaning}</Text>}
      {!!w.guideline && <Text style={s.guideline}>{w.guideline}</Text>}

      {f.series.length > 0 && (
        <View style={s.chartBox}>
          <TrendChart points={f.series} kind={f.seriesKind} color={colors.accent} format={FORMAT[f.key] ?? (v => fmtNum(v, 0))} />
        </View>
      )}
      {!!f.method && <Text style={s.method}>How this is worked out: {f.method}</Text>}

      {based.length > 0 && <Text style={s.section}>RUNS IT'S BASED ON</Text>}
      <View style={{ gap: 10 }}>{based.slice(0, MAX_ROWS).map(r => <RunCard key={r.id} run={r} unit="km" />)}</View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bgApp },
  content:  { paddingHorizontal: 18, paddingBottom: 40 },
  back:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  iconBtn:  { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, lineHeight: 24, color: colors.textPrimary },
  eyebrow:  { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: colors.textFaint },
  headline: { fontFamily: fonts.body, fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.textPrimary },
  meaning:  { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 6 },
  guideline:{ fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 4, fontStyle: 'italic' },
  chartBox: { backgroundColor: colors.bgChart, borderRadius: 16, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 8, marginTop: 18 },
  method:   { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 12 },
  section:  { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, color: colors.textDim, marginTop: 22, marginBottom: 8 },
})
