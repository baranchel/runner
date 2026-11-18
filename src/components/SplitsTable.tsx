import { StyleSheet, Text, View } from 'react-native'
import type { Run } from '../types'
import { fmtDistance, fmtMMSS, fmtPace } from '../utils/format'
import { colors, fonts } from '../utils/tokens'

// Renders just the splits table card. Callers add the section label / screen title.
export function SplitsTable({ run, unit, limit }: { run: Run; unit: 'km' | 'mi'; limit?: number }) {
  let prevKm = 0
  const splits = limit != null ? run.splits.slice(0, limit) : run.splits
  return (
    <View style={tableStyles.card}>
      {/* header */}
      <View style={[tableStyles.row, tableStyles.headerRow]}>
        <Text style={[tableStyles.cell, tableStyles.hdr, { flex: 0.4 }]}>#</Text>
        <Text style={[tableStyles.cell, tableStyles.hdr]}>DIST</Text>
        <Text style={[tableStyles.cell, tableStyles.hdr]}>PACE</Text>
        <Text style={[tableStyles.cell, tableStyles.hdr]}>TIME</Text>
        <Text style={[tableStyles.cell, tableStyles.hdr]}>HR</Text>
      </View>
      {splits.map((split, i) => {
        const segKm = split.km - prevKm
        const pace = segKm > 0 ? split.timeSec / segKm : 0
        prevKm = split.km
        return (
          <View key={i} style={[tableStyles.row, tableStyles.borderTop]}>
            <Text style={[tableStyles.cell, tableStyles.val, { flex: 0.4, color: colors.textSecondary }]}>{i + 1}</Text>
            <Text style={[tableStyles.cell, tableStyles.val]}>{fmtDistance(segKm, unit)}</Text>
            <Text style={[tableStyles.cell, tableStyles.val]}>{pace > 0 ? fmtPace(pace, unit) : '—'}</Text>
            <Text style={[tableStyles.cell, tableStyles.val]}>{fmtMMSS(split.timeSec)}</Text>
            <Text style={[tableStyles.cell, tableStyles.val]}>{split.avgHr ?? '—'}</Text>
          </View>
        )
      })}
    </View>
  )
}

// shared by SplitsTable here and the segments table in app/run/[id].tsx
export const tableStyles = StyleSheet.create({
  card:      {},
  row:       { flexDirection: 'row' },
  rowCenter: { alignItems: 'center' },
  headerRow: {},
  borderTop: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  cell:      { flex: 1, paddingHorizontal: 4, paddingVertical: 9 },
  hdr:       { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.3 },
  val:       { fontFamily: fonts.mono, fontSize: 12, fontWeight: '500', color: colors.textPrimary },
})
