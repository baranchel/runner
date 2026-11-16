import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { MOCK_RUN_TYPES } from '../mockData'
import type { Run } from '../types'
import { fmtDate, fmtDistance, fmtDuration, fmtPace } from '../utils/format'
import { colors, fonts, runTypeColor } from '../utils/tokens'

const TYPE_MAP = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))

// Run row from the Strides Figma: type tile · name / date · type / pace · time · big distance
export function RunCard({ run, unit }: { run: Run; unit: 'km' | 'mi' }) {
  const router = useRouter()
  const type = run.typeId ? TYPE_MAP[run.typeId] : null
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost
  const [num, unitLabel] = fmtDistance(run.distanceKm, unit).split(' ')

  return (
    <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}`)}>
      <View style={[s.tile, { backgroundColor: typeColor + '40' }]}>
        <View style={[s.dot, { backgroundColor: typeColor }]} />
      </View>
      <View style={s.center}>
        <Text style={s.name} numberOfLines={1}>{run.name}</Text>
        <Text style={s.sub}>{fmtDate(run.date)} · {type?.name ?? 'Unclassified'}</Text>
        <Text style={s.meta}>{fmtPace(run.timeSec / run.distanceKm, unit)}   ·   {fmtDuration(run.timeSec)}</Text>
      </View>
      <View style={s.right}>
        <Text style={s.dist}>{num}</Text>
        <Text style={s.unit}>{unitLabel}</Text>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSurface, borderRadius: 18, padding: 12, gap: 14 },
  tile:   { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dot:    { width: 14, height: 14, borderRadius: 7 },
  center: { flex: 1, gap: 4 },
  name:   { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  sub:    { fontFamily: fonts.body, fontSize: 10, color: colors.textDim },
  meta:   { fontFamily: fonts.mono, fontSize: 10, fontWeight: '500', color: colors.textSecondary },
  right:  { alignItems: 'flex-end', paddingRight: 5 },
  dist:   { fontFamily: fonts.mono, fontSize: 22, fontWeight: '600', color: colors.textPrimary },
  unit:   { fontFamily: fonts.body, fontSize: 11, fontWeight: '500', color: colors.textMuted },
})
