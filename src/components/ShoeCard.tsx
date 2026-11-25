// RA-8 shoe card: logo, name, meter, km. Used by My Shoes and the shoe page.
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { displayName, level, type ShoeRow } from '../shoes/shoes'
import { colors, fonts } from '../utils/tokens'
import { ShoeLogo } from './ShoeLogo'

export function ShoeCard({ shoe, dist, defaults, onPress }: { shoe: ShoeRow; dist: number; defaults: string[]; onPress?: () => void }) {
  const warn = !shoe.retired && level(dist, shoe.limit_km) > 0
  const pct = shoe.limit_km > 0 ? Math.min(1, dist / shoe.limit_km) : 0
  const sub = [shoe.brand + ' ' + shoe.model, defaults.length ? `default: ${defaults.join(', ')}` : null].filter(Boolean).join(' · ')
  return (
    <TouchableOpacity style={s.card} activeOpacity={0.8} onPress={onPress} disabled={!onPress}>
      <View style={s.row}>
        <ShoeLogo brand={shoe.brand} color={shoe.color} />
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{displayName(shoe)}</Text>
          <Text style={s.sub} numberOfLines={1}>{sub}</Text>
        </View>
        {warn && <Text style={s.tag}>{Math.floor((dist / shoe.limit_km) * 100)}%</Text>}
      </View>
      <View style={s.bar}><View style={[s.fill, { width: `${pct * 100}%` }, warn && s.fillWarn]} /></View>
      <Text style={s.km}>{Math.round(dist)} / {Math.round(shoe.limit_km)} km</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card:     { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 16, padding: 12 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name:     { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  sub:      { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  tag:      { fontFamily: fonts.mono, fontSize: 11, color: colors.iconOrange, backgroundColor: colors.iconOrange + '26',
              paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  bar:      { height: 6, borderRadius: 3, backgroundColor: colors.bgElevated, marginTop: 10, overflow: 'hidden' },
  fill:     { height: '100%', backgroundColor: colors.accent },
  fillWarn: { backgroundColor: colors.iconOrange },
  km:       { fontFamily: fonts.mono, fontSize: 12, color: colors.textSecondary, marginTop: 6 },
})
