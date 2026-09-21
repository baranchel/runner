import { StyleSheet, Text, View } from 'react-native'
import type { Run } from '../types'
import { fmtDistance, fmtMMSS, fmtPace } from '../utils/format'
import { colors, fonts, spacing } from '../utils/tokens'

// Renders just the splits table card. Callers add the section label / screen title.
export function SplitsTable({ run, unit, limit }: { run: Run; unit: 'km' | 'mi'; limit?: number }) {
  let prevKm = 0
  const splits = limit != null ? run.splits.slice(0, limit) : run.splits
  return (
    <View style={tableStyles.card}>
      {/* header */}
      <View style={[tableStyles.row, tableStyles.headerRow]}>
        <Text style={[tableStyles.cell, tableStyles.hdr, { flex: 0.4, color: colors.textDim }]}>#</Text>
        <Text style={[tableStyles.cell, tableStyles.hdr, { color: colors.accent }]}>Dist</Text>
        <Text style={[tableStyles.cell, tableStyles.hdr, { color: colors.iconOrange }]}>Pace</Text>
        <Text style={[tableStyles.cell, tableStyles.hdr, { color: colors.iconTeal }]}>Time</Text>
        <Text style={[tableStyles.cell, tableStyles.hdr, { color: colors.hrLine }]}>HR</Text>
      </View>
      {splits.map((split, i) => {
        const segKm = split.km - prevKm
        const pace = segKm > 0 ? split.timeSec / segKm : 0
        prevKm = split.km
        return (
          <View key={i} style={[tableStyles.row, i > 0 && tableStyles.borderTop]}>
            <Text style={[tableStyles.cell, tableStyles.val, { flex: 0.4, color: colors.textMuted }]}>{i + 1}</Text>
            <Text style={[tableStyles.cell, tableStyles.val, { color: colors.accent }]}>{fmtDistance(split.km, unit)}</Text>
            <Text style={[tableStyles.cell, tableStyles.val, { color: colors.iconOrange }]}>{pace > 0 ? fmtPace(pace, unit) : '—'}</Text>
            <Text style={[tableStyles.cell, tableStyles.val, { color: colors.iconTeal }]}>{fmtMMSS(split.timeSec)}</Text>
            <Text style={[tableStyles.cell, tableStyles.val, { color: colors.hrLine }]}>{split.avgHr ?? '—'}</Text>
          </View>
        )
      })}
    </View>
  )
}

// shared by SplitsTable here and the segments table in app/run/[id].tsx
export const tableStyles = StyleSheet.create({
  card:      { backgroundColor: colors.bgChart, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: spacing.radius, overflow: 'hidden' },
  row:       { flexDirection: 'row' },
  rowCenter: { alignItems: 'center' },
  headerRow: { backgroundColor: colors.bgElevated },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  cell:      { flex: 1, paddingHorizontal: 10, paddingVertical: 10 },
  hdr:       { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  val:       { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
})
