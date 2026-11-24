// RA-8: after adding a shoe with a past "in use from": tick the runs it was worn on, then confirm
// (or change) the distance on the shoe. extra_km = typed − ticked runs, never below 0.
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { editShoe } from '../../src/shoes/alerts'
import { displayName, extraKm, pastRunCandidates } from '../../src/shoes/shoes'
import { useRunStore } from '../../src/store/useRunStore'
import { useRunTypeStore } from '../../src/store/useRunTypeStore'
import { useShoeStore } from '../../src/store/useShoeStore'
import { fmtDate, fmtDistance } from '../../src/utils/format'
import { buttons, colors, fonts } from '../../src/utils/tokens'

export default function PastRuns() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const shoe = useShoeStore(s => s.shoes.find(x => x.id === id))
  const runs = useRunStore(s => s.runs)
  const typeMap = useRunTypeStore(s => s.typeMap)
  const candidates = useMemo(() => (shoe ? pastRunCandidates(shoe.in_use_from, runs) : []), [shoe?.id])
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(candidates.map(r => r.id)))
  const [typed, setTyped] = useState<string | null>(null)  // null = follow the ticked sum

  if (!shoe) return null
  const sum = candidates.filter(r => ticked.has(r.id)).reduce((s, r) => s + r.distanceKm, 0)
  const shown = typed ?? String(Math.round(sum))

  const toggle = (rid: string) => setTicked(t => { const n = new Set(t); n.has(rid) ? n.delete(rid) : n.add(rid); return n })
  const done = () => {
    const km = Number(shown.replace(',', '.'))
    const extra = typed === null ? 0 : (Number.isFinite(km) ? extraKm(km, sum) : 0)  // untouched field = no rounding km
    useRunStore.getState().setShoe([...ticked], shoe.id)  // runs the 90% / 100% check
    editShoe(shoe.id, { extra_km: extra })
    router.back()
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: 28 }]} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Runs since {fmtDate(shoe.in_use_from)}</Text>
      <Text style={s.sub}>These runs have no shoe. Assign them to {displayName(shoe)}?</Text>
      {candidates.map(r => (
        <TouchableOpacity key={r.id} style={s.row} onPress={() => toggle(r.id)}>
          <View style={[s.box, ticked.has(r.id) && s.boxOn]}>{ticked.has(r.id) && <Text style={s.tick}>✓</Text>}</View>
          <Text style={s.rowText} numberOfLines={1}>{fmtDate(r.date)} · {r.typeId ? typeMap[r.typeId]?.name ?? 'Unclassified' : 'Unclassified'}</Text>
          <Text style={s.km}>{fmtDistance(r.distanceKm, 'km')}</Text>
        </TouchableOpacity>
      ))}
      <Text style={s.label}>Distance on this shoe</Text>
      <View style={s.input}>
        <TextInput style={[s.mono, { flex: 1 }]} value={shown} onChangeText={setTyped} keyboardType="number-pad" />
        <Text style={s.mono}>km</Text>
      </View>
      <Text style={s.hint}>From {ticked.size} run{ticked.size === 1 ? '' : 's'}. Change it to add km run without the app.</Text>
      <TouchableOpacity style={[buttons.primary, s.done]} onPress={done}><Text style={buttons.primaryText}>Done</Text></TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: 18, paddingBottom: 60 },
  title:   { fontFamily: fonts.body, fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  sub:     { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 10 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
             borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
  box:     { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.borderFocus, alignItems: 'center', justifyContent: 'center' },
  boxOn:   { backgroundColor: colors.accent, borderColor: colors.accent },
  tick:    { color: colors.ink, fontSize: 13, fontWeight: '700' },
  rowText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
  km:      { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
  label:   { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 20, marginBottom: 6, marginLeft: 4 },
  input:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgElevated, borderWidth: 1,
             borderColor: colors.borderStrong, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  mono:    { fontFamily: fonts.mono, fontSize: 15, color: colors.textPrimary },
  hint:    { fontFamily: fonts.body, fontSize: 11, color: colors.textGhost, marginTop: 4, marginLeft: 4 },
  done:    { marginTop: 24, paddingVertical: 12 },
})
