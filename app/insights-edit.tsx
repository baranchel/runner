// Insights Edit (RA-29): switch a metric off to hide it, drag the handle to reorder inside its group.
// Saved on Done through the profile (writeChange + syncNow), so it is offline-safe and follows the user.
import { useState } from 'react'
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { GROUPS, type InsightsLayout, type Metric } from '../src/insights/metrics'
import { hasData, isHidden, moveTo, orderedMetrics, toggleHidden } from '../src/insights/summary'
import { useAuthStore } from '../src/store/useAuthStore'
import { useInsightsStore } from '../src/store/useInsightsStore'
import { useProfileStore } from '../src/store/useProfileStore'
import { buttons, colors, fonts } from '../src/utils/tokens'

const ROW_H = 48

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
          <Text style={s.sub}>Drag to reorder. Switch off to hide.</Text>
        </View>
        <TouchableOpacity style={buttons.primary} onPress={done} activeOpacity={0.8}>
          <Text style={buttons.primaryText}>Done</Text>
        </TouchableOpacity>
      </View>
      {GROUPS.map(g => {
        const ms = all.filter(m => m.group === g.key)
        return (
          <View key={g.key}>
            <Text style={s.gtitle}>{g.title}</Text>
            <View style={s.list}>
              {ms.map((m, i) => (
                <Row
                  key={m.key} m={m} index={i} count={ms.length}
                  on={!isHidden(layout, m.key)} noData={!hasData(data[m.key])}
                  onToggle={() => setLayout(l => toggleHidden(l, m.key))}
                  onMove={to => setLayout(l => moveTo(l, m.key, to))}
                />
              ))}
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

function Row({ m, index, count, on, noData, onToggle, onMove }: {
  m: Metric; index: number; count: number; on: boolean; noData: boolean
  onToggle: () => void; onMove: (to: number) => void
}) {
  const y = useSharedValue(0)
  const pan = Gesture.Pan()
    .hitSlop(8)
    .onChange(e => { y.value = Math.max(-index * ROW_H, Math.min((count - 1 - index) * ROW_H, e.translationY)) })
    .onEnd((e, success) => {
      const to = Math.max(0, Math.min(count - 1, index + Math.round(e.translationY / ROW_H)))
      if (success && to !== index) runOnJS(onMove)(to)
    })
    .onFinalize(() => { y.value = 0 })
  const lifted = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    zIndex: y.value === 0 ? 0 : 10,
    backgroundColor: y.value === 0 ? 'transparent' : colors.bgElevated,
  }))
  return (
    <Animated.View style={[s.row, index > 0 && s.rowBorder, lifted]}>
      <GestureDetector gesture={pan}>
        <View style={s.grip}><Text style={s.gripText}>⋮⋮</Text></View>
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
  head:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  title:   { fontFamily: fonts.body, fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  sub:     { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, marginTop: 4 },
  gtitle:  { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginHorizontal: 4, marginBottom: 8 },
  list:    { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 16, marginBottom: 18 },
  row:     { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  grip:    { paddingVertical: 8 },
  gripText:{ fontSize: 16, color: colors.textGhost, letterSpacing: -2 },
  name:    { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
  nameOff: { color: colors.textGhost },
  na:      { fontFamily: fonts.body, fontSize: 11, color: colors.textGhost },
  switchBox: { height: 32, justifyContent: 'center', alignItems: 'flex-end' },
})
