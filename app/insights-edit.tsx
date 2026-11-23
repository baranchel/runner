// Insights Edit (RA-29): switch a metric off to hide it, drag the ≡ handle to reorder inside its group.
// Reorder is live: while a row is dragged, the others slide out of its way (positions live in a shared
// value on the UI thread); React's order only changes on drop. Saved on Done through the profile
// (writeChange + syncNow), so it is offline-safe and follows the user. Cancel drops every change.
import { useEffect, useState } from 'react'
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { GROUPS, type InsightsLayout, type Metric } from '../src/insights/metrics'
import { hasData, isHidden, moveTo, orderedMetrics, toggleHidden } from '../src/insights/summary'
import { useAuthStore } from '../src/store/useAuthStore'
import { useInsightsStore } from '../src/store/useInsightsStore'
import { useProfileStore } from '../src/store/useProfileStore'
import { buttons, colors, fonts } from '../src/utils/tokens'

const ROW_H = 48
const SLIDE = { duration: 180 }

type Positions = Record<string, number>
const positionsOf = (ms: Metric[]): Positions => Object.fromEntries(ms.map((m, i) => [m.key, i]))

export default function InsightsEdit() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const userId = useAuthStore(s => s.session?.user.id)
  const saved = useProfileStore(s => s.profile?.insights_layout ?? null)
  const save = useProfileStore(s => s.save)
  const data = useInsightsStore(s => s.data)
  const [layout, setLayout] = useState<InsightsLayout | null>(saved)

  const done = () => {
    if (userId && layout) save(userId, { insights_layout: layout })
    router.back()
  }
  const all = orderedMetrics(layout)

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Edit insights</Text>
          <Text style={s.sub}>Hold ≡ and drag to reorder. Switch off to hide.</Text>
        </View>
        <TouchableOpacity style={buttons.outline} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={buttons.outlineText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={buttons.primary} onPress={done} activeOpacity={0.8}>
          <Text style={buttons.primaryText}>Done</Text>
        </TouchableOpacity>
      </View>
      {GROUPS.map(g => (
        <View key={g.key}>
          <Text style={s.gtitle}>{g.title}</Text>
          <GroupList
            ms={all.filter(m => m.group === g.key)} layout={layout} data={data}
            onToggle={key => setLayout(l => toggleHidden(l, key))}
            onMove={(key, to) => setLayout(l => moveTo(l, key, to))}
          />
        </View>
      ))}
    </ScrollView>
  )
}

function GroupList({ ms, layout, data, onToggle, onMove }: {
  ms: Metric[]; layout: InsightsLayout | null; data: ReturnType<typeof useInsightsStore.getState>['data']
  onToggle: (key: string) => void; onMove: (key: string, to: number) => void
}) {
  const positions = useSharedValue<Positions>(positionsOf(ms))
  const activeKey = useSharedValue<string | null>(null)
  const orderKey = ms.map(m => m.key).join(',')
  // After a drop React's order catches up; this re-sync is then a no-op (same positions), so nothing jumps.
  useEffect(() => { positions.value = positionsOf(ms) }, [orderKey])

  return (
    <View style={[s.list, { height: ms.length * ROW_H + 2 }]}>
      {ms.map(m => (
        <Row
          key={m.key} m={m} count={ms.length} positions={positions} activeKey={activeKey}
          on={!isHidden(layout, m.key)} noData={!hasData(data[m.key])}
          onToggle={() => onToggle(m.key)} onMove={to => onMove(m.key, to)}
        />
      ))}
    </View>
  )
}

function Row({ m, count, positions, activeKey, on, noData, onToggle, onMove }: {
  m: Metric; count: number; positions: SharedValue<Positions>; activeKey: SharedValue<string | null>
  on: boolean; noData: boolean; onToggle: () => void; onMove: (to: number) => void
}) {
  const dragY = useSharedValue(0)
  const start = useSharedValue(0)

  const pan = Gesture.Pan()
    .hitSlop(8)
    .onStart(() => {
      start.value = positions.value[m.key]
      dragY.value = start.value * ROW_H
      activeKey.value = m.key
    })
    .onChange(e => {
      dragY.value = Math.max(0, Math.min((count - 1) * ROW_H, start.value * ROW_H + e.translationY))
      const to = Math.round(dragY.value / ROW_H)
      const from = positions.value[m.key]
      if (to === from) return
      // Move this row to `to`; the rows in between shift one place towards `from`.
      const next: Positions = {}
      for (const k in positions.value) {
        const p = positions.value[k]
        next[k] = k === m.key ? to
          : from < to && p > from && p <= to ? p - 1
          : from > to && p >= to && p < from ? p + 1
          : p
      }
      positions.value = next
    })
    .onFinalize(() => {
      if (activeKey.value !== m.key) return  // a tap that never became a drag
      const to = positions.value[m.key]
      dragY.value = withTiming(to * ROW_H, { duration: 200 }, () => { activeKey.value = null })
      if (to !== start.value) runOnJS(onMove)(to)
    })

  const style = useAnimatedStyle(() => {
    const p = positions.value[m.key] ?? 0
    const lifted = activeKey.value === m.key
    // Slide only while some row is dragged; otherwise snap, so rows don't fly in on mount.
    const y = lifted ? dragY.value : activeKey.value ? withTiming(p * ROW_H, SLIDE) : p * ROW_H
    return {
      transform: [{ translateY: y }, { scale: withTiming(lifted ? 1.03 : 1, SLIDE) }],
      zIndex: lifted ? 10 : 0,
      backgroundColor: lifted ? colors.bgElevated : 'transparent',
      borderRadius: lifted ? 12 : 0,
      shadowOpacity: lifted ? 0.4 : 0,
      borderTopWidth: p === 0 || lifted ? 0 : 1,
    }
  })

  return (
    <Animated.View style={[s.row, style]}>
      <GestureDetector gesture={pan}>
        <View style={s.grip}>
          <View style={s.gripLine} /><View style={s.gripLine} /><View style={s.gripLine} />
        </View>
      </GestureDetector>
      <Text style={[s.name, (!on || noData) && s.nameOff]} numberOfLines={1}>{m.label}</Text>
      {noData && <Text style={s.na}>No data in Health</Text>}
      {/* Native iOS switch in a fixed-height, centred box: on its own it hung from the top of the row. */}
      <View style={s.switchBox}>
        <Switch
          value={on} onValueChange={onToggle}
          trackColor={{ true: colors.accent, false: colors.bgElevated }}
          ios_backgroundColor={colors.bgElevated}
        />
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  head:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  title:   { fontFamily: fonts.body, fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  sub:     { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, marginTop: 4 },
  gtitle:  { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginHorizontal: 4, marginBottom: 8 },
  list:    { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 16, marginBottom: 18 },
  row:     {
    position: 'absolute', top: 0, left: 0, right: 0, height: ROW_H,
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14,
    borderTopColor: colors.borderSubtle, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowRadius: 12,
  },
  // ≡ reorder handle (iOS style): three short lines, with a wide touch area around them.
  grip:     { paddingVertical: 12, paddingRight: 4, gap: 3 },
  gripLine: { width: 18, height: 2, borderRadius: 1, backgroundColor: colors.textDim },
  name:    { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
  nameOff: { color: colors.textGhost },
  na:      { fontFamily: fonts.body, fontSize: 11, color: colors.textGhost },
  switchBox: { height: 32, justifyContent: 'center', alignItems: 'flex-end' },
})
