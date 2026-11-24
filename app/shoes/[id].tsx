// RA-8 shoe page: meter, stats, default for which types, Edit.
import { useEffect } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ShoeCard } from '../../src/components/ShoeCard'
import { shoeStats } from '../../src/shoes/shoes'
import { useRunStore } from '../../src/store/useRunStore'
import { useRunTypeStore } from '../../src/store/useRunTypeStore'
import { useShoeStore } from '../../src/store/useShoeStore'
import { fmtDate, fmtPace } from '../../src/utils/format'
import { buttons, colors, fonts } from '../../src/utils/tokens'

export default function ShoePage() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const shoe = useShoeStore(s => s.shoes.find(x => x.id === id))
  const runs = useRunStore(s => s.runs)
  const types = useRunTypeStore(s => s.types)
  // deleted (from Edit, whichever way this page was opened) → leave instead of showing a blank page
  useEffect(() => { if (!shoe) router.back() }, [shoe])
  if (!shoe) return null
  const st = shoeStats(shoe, runs)
  const defaults = types.filter(t => t.defaultShoeId === shoe.id).map(t => t.name)
  const stat = (label: string, value: string) => (
    <View style={s.stat}><Text style={s.statLabel}>{label}</Text><Text style={s.statValue}>{value}</Text></View>
  )

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><Text style={s.back}>‹ Back</Text></TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={buttons.outline} onPress={() => router.push({ pathname: '/shoes/edit', params: { id: shoe.id } })}>
          <Text style={buttons.outlineText}>Edit</Text>
        </TouchableOpacity>
      </View>
      <ShoeCard shoe={shoe} dist={st.distanceKm} defaults={defaults} />
      <View style={s.grid}>
        {stat('Total distance', `${Math.round(st.distanceKm)} km`)}
        {stat('Runs', String(st.runCount))}
        {stat('Average pace', st.avgPaceSecPerKm ? fmtPace(st.avgPaceSecPerKm, 'km') : '—')}
        {stat('Last used', st.lastUsed ? fmtDate(st.lastUsed) : '—')}
      </View>
      <Text style={s.note}>In use from {fmtDate(shoe.in_use_from)}{shoe.extra_km > 0 ? ` · includes ${Math.round(shoe.extra_km)} km run without the app` : ''}</Text>
      {shoe.retired && <Text style={s.note}>Retired</Text>}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bgApp },
  content:   { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },
  head:      { flexDirection: 'row', alignItems: 'center' },
  back:      { fontFamily: fonts.body, fontSize: 15, color: colors.textSecondary },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat:      { width: '48%', backgroundColor: colors.bgSurface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.borderDefault },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  statValue: { fontFamily: fonts.mono, fontSize: 18, color: colors.textPrimary, marginTop: 4 },
  note:      { fontFamily: fonts.body, fontSize: 12, color: colors.textGhost },
})
