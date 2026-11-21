import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTypeMap } from '../store/useRunTypeStore'
import type { Run } from '../types'
import { fmtDate, fmtDistance, fmtDuration, fmtPace } from '../utils/format'
import { colors, fonts, runTypeColor } from '../utils/tokens'

// Run row from the Strides Figma: type tile · name / date · type / distance · time · pace · achievements slot
// checked: undefined = normal row; true/false = selection mode (shows a check circle)
export function RunCard({ run, unit, checked, onPress, disabled }: {
  run: Run
  unit: 'km' | 'mi'
  checked?: boolean
  onPress?: () => void
  disabled?: boolean
}) {
  const router = useRouter()
  const typeMap = useTypeMap()
  const type = run.typeId ? typeMap[run.typeId] : null
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost

  return (
    <TouchableOpacity
      style={[s.card, checked && s.cardChecked, disabled && { opacity: 0.35 }]}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress ?? (() => router.push(`/run/${run.id}`))}
    >
      <View style={[s.tile, { backgroundColor: typeColor + '40' }]}>
        <View style={[s.dot, { backgroundColor: typeColor }]} />
      </View>
      <View style={s.center}>
        <Text style={s.name} numberOfLines={1}>{run.name}</Text>
        <Text style={s.sub}>{fmtDate(run.date)} · {type?.name ?? 'Unclassified'}</Text>
        <Text style={s.meta}>
          {fmtDistance(run.distanceKm, unit)}  ·  {fmtDuration(run.timeSec)}  ·  {fmtPace(run.timeSec / run.distanceKm, unit)}
        </Text>
      </View>
      {/* Reserved for achievement badges earned on this run — RA-37 */}
      <View style={s.achievements} />
      {checked !== undefined && (
        <View style={[s.check, checked && s.checkOn]}>
          {checked && <Text style={s.checkMark}>✓</Text>}
        </View>
      )}
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
  achievements: { width: 44, alignSelf: 'stretch' },
  cardChecked: { borderWidth: 1.5, borderColor: colors.lime },
  check:     { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderFocus, alignItems: 'center', justifyContent: 'center' },
  checkOn:   { backgroundColor: colors.lime, borderColor: colors.lime },
  checkMark: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.ink },
})
