// Insights tab (RA-45): one feed of calculated insights, worded on the phone (daily edition).
// Layout A: one lime hero card; the first card of the running and the health group gets a lime outline when notable.
// Spec: docs/superpowers/specs/2026-11-28-smart-insights-design.md
import { useCallback, useEffect } from 'react'
import { ActivityIndicator, AppState, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Sparkline } from '../../src/components/Chart'
import type { Worded } from '../../src/insights/phrases'
import type { Finding } from '../../src/insights/rules'
import { hasData } from '../../src/insights/summary'
import { insightHref, useFeed } from '../../src/insights/useFeed'
import { useInsightsStore } from '../../src/store/useInsightsStore'
import { colors, fonts } from '../../src/utils/tokens'

type Variant = 'hero' | 'accent' | 'plain'

export default function Insights() {
  const router = useRouter()
  const { feed, words } = useFeed()
  const data = useInsightsStore(s => s.data)
  const loading = useInsightsStore(s => s.loading)
  const loadedAt = useInsightsStore(s => s.loadedAt)
  const load = useInsightsStore(s => s.load)

  useFocusEffect(useCallback(() => { load() }, [load]))
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') load() })
    return () => sub.remove()
  }, [load])

  const noHealth = loadedAt > 0 && !Object.values(data).some(hasData)
  const variant = (f: Finding): Variant => (feed.accent.includes(f.key) ? 'accent' : 'plain')
  const card = (f: Finding, v: Variant) => (
    <InsightCard key={f.key} f={f} w={words.get(f.key)!} variant={v} onPress={() => router.push(insightHref(f))} />
  )

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading && loadedAt > 0} onRefresh={() => load(true)} tintColor={colors.textSecondary} />}
      >
        <Text style={s.title}>Insights</Text>
        <Text style={s.sub}>What your data says this week</Text>

        {!feed.hero && loadedAt > 0 && (
          <Text style={s.empty}>Insights appear once you have a few weeks of runs and Apple Health data.</Text>
        )}
        {feed.hero && card(feed.hero, 'hero')}
        {feed.running.length > 0 && <View style={s.group}>{feed.running.map(f => card(f, variant(f)))}</View>}
        {feed.health.length > 0 && <View style={s.group}>{feed.health.map(f => card(f, variant(f)))}</View>}

        {noHealth && (
          <TouchableOpacity style={s.allow} onPress={() => Linking.openSettings()} activeOpacity={0.7}>
            <Text style={s.allowText}>Allow Apple Health to see health insights ›</Text>
          </TouchableOpacity>
        )}
        {loadedAt === 0 && <ActivityIndicator color={colors.textSecondary} style={{ marginVertical: 30 }} />}
      </ScrollView>
    </SafeAreaView>
  )
}

function InsightCard({ f, w, variant, onPress }: { f: Finding; w: Worded; variant: Variant; onPress: () => void }) {
  const hero = variant === 'hero', accent = variant === 'accent'
  const strong = hero ? colors.ink : accent ? colors.lime : colors.textFaint   // eyebrow, evidence, sparkline
  return (
    <TouchableOpacity style={[s.card, hero && s.hero, accent && s.accent]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.eyebrow, { color: strong }]}>{w.eyebrow}</Text>
      <Text style={[s.headline, hero && s.heroHeadline, { color: hero ? colors.ink : colors.textPrimary }]}>{w.headline}</Text>
      {!!w.meaning && <Text style={[s.meaning, { color: hero ? colors.ink : colors.textSecondary }]}>{w.meaning}</Text>}
      {!!w.guideline && <Text style={[s.guideline, { color: hero ? colors.ink : colors.textFaint }]}>{w.guideline}</Text>}
      <View style={s.foot}>
        <Text style={[s.evidence, { color: strong }]} numberOfLines={1}>{f.evidence}</Text>
        <View style={s.spark}>
          {f.series.length > 1 && <Sparkline points={f.series} kind={f.seriesKind} color={strong} height={24} ring={hero ? colors.lime : undefined} />}
        </View>
        <Text style={[s.chev, { color: strong }]}>›</Text>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bgApp },
  content:  { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 },
  title:    { fontFamily: fonts.body, fontSize: 26, lineHeight: 30, fontWeight: '700', color: colors.textPrimary },
  sub:      { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 18 },
  empty:    { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginVertical: 60, paddingHorizontal: 20 },
  group:    { marginTop: 14 },
  card:     { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 16,
              paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, marginBottom: 10 },
  hero:     { backgroundColor: colors.lime, borderColor: colors.lime, paddingTop: 16, paddingBottom: 14 },
  accent:   { borderColor: colors.lime },
  eyebrow:  { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 },
  headline: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, fontWeight: '600', marginTop: 5 },
  heroHeadline: { fontSize: 18, lineHeight: 24 },
  meaning:  { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 5 },
  guideline:{ fontFamily: fonts.body, fontSize: 11, lineHeight: 15, marginTop: 4, fontStyle: 'italic' },
  foot:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  evidence: { fontFamily: fonts.mono, fontSize: 12 },
  spark:    { flex: 1 },
  chev:     { fontSize: 18, lineHeight: 20 },
  allow:    { paddingVertical: 14, alignItems: 'center' },
  allowText:{ fontFamily: fonts.body, fontSize: 13, color: colors.lime },
})
