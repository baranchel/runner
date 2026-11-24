// RA-8 My Shoes: active shoes with their meter; ?retired=1 shows the retired ones. Swipe a row left to delete.
import { useRef } from 'react'
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ShoeCard } from '../../src/components/ShoeCard'
import { confirmDeleteShoe } from '../../src/shoes/alerts'
import { shoeDistance, type ShoeRow } from '../../src/shoes/shoes'
import { useRunStore } from '../../src/store/useRunStore'
import { useRunTypeStore } from '../../src/store/useRunTypeStore'
import { useShoeStore } from '../../src/store/useShoeStore'
import { buttons, colors, fonts } from '../../src/utils/tokens'

export default function MyShoes() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const retiredView = useLocalSearchParams<{ retired?: string }>().retired === '1'
  const shoes = useShoeStore(s => s.shoes)
  const runs = useRunStore(s => s.runs)
  const types = useRunTypeStore(s => s.types)
  const shown = shoes.filter(s => s.retired === retiredView)
  const retiredCount = shoes.filter(s => s.retired).length

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Text style={s.back}>‹ Back</Text></TouchableOpacity>
        <Text style={s.title}>{retiredView ? 'Retired shoes' : 'My shoes'}</Text>
        {!retiredView && (
          <TouchableOpacity style={buttons.primary} onPress={() => router.push('/shoes/edit')}>
            <Text style={buttons.primaryText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>
      {shown.length === 0 && <Text style={s.empty}>{retiredView ? 'No retired shoes.' : 'No shoes yet. Add your first pair.'}</Text>}
      {shown.map(shoe => (
        <SwipeToDelete key={shoe.id} shoe={shoe}>
          <ShoeCard shoe={shoe} dist={shoeDistance(shoe, runs)}
            defaults={types.filter(t => t.defaultShoeId === shoe.id).map(t => t.name)}
            onPress={() => router.push(`/shoes/${shoe.id}`)} />
        </SwipeToDelete>
      ))}
      {!retiredView && retiredCount > 0 && (
        <TouchableOpacity onPress={() => router.push({ pathname: '/shoes', params: { retired: '1' } })}>
          <Text style={s.link}>Retired ({retiredCount}) ›</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

// iOS-style row delete: a short swipe reveals Delete; swiping most of the way across (past FULL)
// stretches the red over the row and asks to delete on release.
const FULL = Dimensions.get('window').width * 0.5

function SwipeToDelete({ shoe, children }: { shoe: ShoeRow; children: React.ReactNode }) {
  const ref = useRef<SwipeableMethods>(null)
  const armed = useSharedValue(false)
  const ask = () => confirmDeleteShoe(shoe, undefined, () => ref.current?.close())
  return (
    <ReanimatedSwipeable ref={ref} friction={1} rightThreshold={40}
      onSwipeableWillOpen={() => { if (armed.value) ask() }}
      renderRightActions={(_, drag) => <DeleteAction drag={drag} armed={armed} onPress={ask} />}>
      {/* opaque backing: the card dims when pressed, which would show the red action behind it */}
      <View style={s.backing}>{children}</View>
    </ReanimatedSwipeable>
  )
}

function DeleteAction({ drag, armed, onPress }: { drag: SharedValue<number>; armed: SharedValue<boolean>; onPress: () => void }) {
  useAnimatedReaction(() => drag.value < -FULL, on => { armed.value = on })
  const red = useAnimatedStyle(() => ({ width: Math.max(ACTION_W, -drag.value) }))
  return (
    <View style={{ width: ACTION_W + 10 }}>
      <Animated.View style={[s.deleteAction, red]}>
        <TouchableOpacity style={s.deleteTouch} activeOpacity={0.8} onPress={onPress}>
          <Text style={s.deleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const ACTION_W = 88

const s = StyleSheet.create({
  backing:      { backgroundColor: colors.bgApp, borderRadius: 16 },
  deleteAction: { position: 'absolute', right: 0, top: 0, bottom: 0, borderRadius: 16, backgroundColor: colors.danger },
  deleteTouch:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  deleteText:   { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: '#fff' },
  screen:   { flex: 1, backgroundColor: colors.bgApp },
  content:  { paddingHorizontal: 18, paddingBottom: 40, gap: 10 },
  head:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  back:     { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary },
  title:    { flex: 1, fontFamily: fonts.body, fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  empty:    { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 20 },
  link:     { fontFamily: fonts.body, fontSize: 13, color: colors.textGhost, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
})
