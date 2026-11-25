// RA-8: which run types get this shoe by default. Shown after adding a shoe and after changing the
// shoe on a run (?type= pre-ticks that run's type). Only future runs: past runs are never changed here.
// ?then=past-runs continues to the past-runs step after Done / Skip.
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { displayName } from '../../src/shoes/shoes'
import { useRunTypeStore } from '../../src/store/useRunTypeStore'
import { useShoeStore } from '../../src/store/useShoeStore'
import { buttons, colors, fonts, runTypeColor } from '../../src/utils/tokens'

export default function ShoeDefaults() {
  const router = useRouter()
  const { id, type, then } = useLocalSearchParams<{ id: string; type?: string; then?: string }>()
  const shoe = useShoeStore(s => s.shoes.find(x => x.id === id))
  const shoes = useShoeStore(s => s.shoes)
  const types = useRunTypeStore(s => s.types)
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(types.filter(t => t.defaultShoeId === id || t.id === type).map(t => t.id)),
  )
  if (!shoe) return null

  const next = () => {
    if (then === 'past-runs') router.replace({ pathname: '/shoes/past-runs', params: { id } })
    else router.back()
  }
  const done = () => {
    const { setDefaultShoe } = useRunTypeStore.getState()
    for (const t of types) {
      const on = ticked.has(t.id)
      if (on && t.defaultShoeId !== id) setDefaultShoe(t.id, id)
      if (!on && t.defaultShoeId === id) setDefaultShoe(t.id, null)
    }
    next()
  }
  const toggle = (tid: string) => setTicked(t => { const n = new Set(t); n.has(tid) ? n.delete(tid) : n.add(tid); return n })
  const nameOf = (sid: string | null) => { const x = shoes.find(s => s.id === sid); return x ? displayName(x) : null }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.title}>Default for which runs?</Text>
      <Text style={s.sub}>New runs of these types get {displayName(shoe)}. Past runs don't change.</Text>
      {types.map(t => {
        const on = ticked.has(t.id)
        const other = t.defaultShoeId && t.defaultShoeId !== id ? nameOf(t.defaultShoeId) : null
        return (
          <TouchableOpacity key={t.id} style={s.row} onPress={() => toggle(t.id)}>
            <View style={[s.box, on && s.boxOn]}>{on && <Text style={s.tick}>✓</Text>}</View>
            <View style={[s.dot, { backgroundColor: runTypeColor(t.hue) }]} />
            <Text style={s.rowText}>{t.name}</Text>
            {other && <Text style={s.now} numberOfLines={1}>{on ? `replaces ${other}` : `now: ${other}`}</Text>}
          </TouchableOpacity>
        )
      })}
      <View style={s.actions}>
        <TouchableOpacity style={buttons.outline} onPress={next}><Text style={buttons.outlineText}>Skip</Text></TouchableOpacity>
        <TouchableOpacity style={[buttons.primary, { flex: 1 }]} onPress={done}><Text style={buttons.primaryText}>Done</Text></TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: 18, paddingTop: 28, paddingBottom: 60 },
  title:   { fontFamily: fonts.body, fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  sub:     { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 10 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
             borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
  box:     { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.borderFocus, alignItems: 'center', justifyContent: 'center' },
  boxOn:   { backgroundColor: colors.accent, borderColor: colors.accent },
  tick:    { color: colors.ink, fontSize: 13, fontWeight: '700' },
  dot:     { width: 10, height: 10, borderRadius: 5 },
  rowText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary },
  now:     { maxWidth: 150, fontFamily: fonts.body, fontSize: 11, color: colors.textGhost },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24, alignItems: 'center' },
})
