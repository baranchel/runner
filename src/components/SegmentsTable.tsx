import { StyleSheet, Text, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import type { Run } from '../types'
import { fmtDistance, fmtMMSS, fmtPace } from '../utils/format'
import { colors } from '../utils/tokens'
import { tableStyles as st } from './SplitsTable'

export const SEGMENT_DISPLAY: Record<string, { label: string; color: (typeColor: string) => string }> = {
  warmup:   { label: 'Warm-up',   color: () => colors.elevLine },
  cooldown: { label: 'Cool-down', color: () => colors.elevLine },
  rep:      { label: 'Work',      color: (tc) => tc },
  main:     { label: 'Work',      color: (tc) => tc },
  rest:     { label: 'Rest',      color: () => colors.textMuted },
}

// Renders just the segments table card. `showHr` adds the HR column (full screen only).
export function SegmentsTable({ run, typeColor, unit, limit, showHr, style }: {
  run: Run; typeColor: string; unit: 'km' | 'mi'; limit?: number; showHr?: boolean; style?: StyleProp<ViewStyle>
}) {
  if (!run.segments) return null
  const segments = limit != null ? run.segments.slice(0, limit) : run.segments
  return (
    <View style={[st.card, style]}>
      <View style={[st.row, st.headerRow]}>
        <Text style={[st.cell, st.hdr, { flex: 1.4 }]}>Type</Text>
        <Text style={[st.cell, st.hdr, { color: colors.iconGold }]}>Dist</Text>
        <Text style={[st.cell, st.hdr, { color: colors.iconOrange }]}>Pace</Text>
        <Text style={[st.cell, st.hdr, { color: colors.iconTeal }]}>Time</Text>
        {showHr && <Text style={[st.cell, st.hdr, { color: colors.hrLine }]}>HR</Text>}
      </View>
      {segments.map((seg, i) => {
        const display = SEGMENT_DISPLAY[seg.type] ?? { label: seg.type, color: () => colors.textMuted }
        const dotColor = display.color(typeColor)
        const pace = seg.distanceKm > 0 ? seg.timeSec / seg.distanceKm : 0
        return (
          <View key={i} style={[st.row, st.rowCenter, i > 0 && st.borderTop]}>
            <View style={[st.cell, { flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <View style={[sg.dot, { backgroundColor: dotColor }]} />
              <Text style={[st.val, { color: dotColor }]} numberOfLines={1}>{display.label}</Text>
            </View>
            <Text style={[st.cell, st.val, { color: colors.iconGold }]} numberOfLines={1}>{fmtDistance(seg.distanceKm, unit)}</Text>
            <Text style={[st.cell, st.val, { color: colors.iconOrange }]} numberOfLines={1}>{pace > 0 ? fmtPace(pace, unit) : '—'}</Text>
            <Text style={[st.cell, st.val, { color: colors.iconTeal }]} numberOfLines={1}>{fmtMMSS(seg.timeSec)}</Text>
            {showHr && <Text style={[st.cell, st.val, { color: colors.hrLine }]} numberOfLines={1}>{seg.avgHr ?? '—'}</Text>}
          </View>
        )
      })}
    </View>
  )
}

const sg = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
})
