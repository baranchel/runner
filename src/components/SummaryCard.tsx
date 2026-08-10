import { View, Text, Image, StyleSheet } from 'react-native'
import type { Run } from '../types'
import { getPeriodStats } from '../utils/stats'
import { fmtDuration, fmtPace, fmtDistance } from '../utils/format'
import { colors, fonts, spacing } from '../utils/tokens'

interface SummaryCardProps {
  runs: Run[]
  today: Date
  unit: 'km' | 'mi'
}

// ─── Delta logic ─────────────────────────────────────────────────────────────

type DeltaDir = 'up' | 'down' | 'flat'

function deltaDir(
  current: number,
  previous: number,
  lowerIsBetter = false,
  useAbsolute = false,
): DeltaDir {
  if (previous === 0 && current === 0) return 'flat'
  if (previous === 0) return lowerIsBetter ? 'down' : 'up'
  if (useAbsolute) {
    const diff = current - previous
    if (diff === 0) return 'flat'
    return (lowerIsBetter ? diff < 0 : diff > 0) ? 'up' : 'down'
  }
  const pct = (current - previous) / previous
  if (Math.abs(pct) < 0.02) return 'flat'
  return (lowerIsBetter ? pct < 0 : pct > 0) ? 'up' : 'down'
}

function fmtDelta(current: number, previous: number, formatter: (n: number) => string): string {
  const diff = current - previous
  const sign = diff >= 0 ? '+' : '−'
  return `${sign}${formatter(Math.abs(diff))}`
}

function fmtPaceDelta(currentSec: number, previousSec: number, unit: 'km' | 'mi'): string {
  const factor = unit === 'mi' ? 1.60934 : 1
  const absDiff = Math.abs(currentSec - previousSec) * factor
  const m = Math.floor(absDiff / 60)
  const sec = Math.round(absDiff % 60)
  const suffix = unit === 'mi' ? '/mi' : '/km'
  return `${m}:${String(sec).padStart(2, '0')}${suffix}`
}

// ─── Delta row ────────────────────────────────────────────────────────────────

const ARROW = {
  up:   require('../../assets/up-arrow.png'),
  down: require('../../assets/down-arrow.png'),
  flat: require('../../assets/straight-arrow.png'),
}

const DELTA_COLORS: Record<DeltaDir, string> = {
  up:   colors.elevLine,
  down: colors.danger,
  flat: colors.textFaint,
}

function DeltaRow({ dir, label }: { dir: DeltaDir; label: string }) {
  return (
    <View style={s.deltaRow}>
      <Image source={ARROW[dir]} style={[s.deltaIcon, { tintColor: DELTA_COLORS[dir] }]} />
      {dir !== 'flat' && <Text style={[s.deltaText, { color: DELTA_COLORS[dir] }]}>{label}</Text>}
    </View>
  )
}

// ─── Unified stat column ──────────────────────────────────────────────────────
// All three columns use identical structure so rows align perfectly:
//   labelRow → value → delta → divider → labelRow → value → delta

interface StatColProps {
  topIcon: ReturnType<typeof require>
  topIconColor: string
  topLabel: string
  topValue: string
  topDelta: { dir: DeltaDir; label: string }
  bottomIcon: ReturnType<typeof require>
  bottomIconColor: string
  bottomLabel: string
  bottomValue: string
  bottomDelta: { dir: DeltaDir; label: string }
}

function StatCol({
  topIcon, topIconColor, topLabel, topValue, topDelta,
  bottomIcon, bottomIconColor, bottomLabel, bottomValue, bottomDelta,
}: StatColProps) {
  return (
    <View style={s.col}>
      <View style={s.labelRow}>
        <Image source={topIcon} style={[s.labelIcon, { tintColor: topIconColor }]} />
        <Text style={s.colLabel}>{topLabel}</Text>
      </View>
      <Text style={s.topValue}>{topValue}</Text>
      <DeltaRow dir={topDelta.dir} label={topDelta.label} />
      <View style={s.divider} />
      <View style={s.labelRow}>
        <Image source={bottomIcon} style={[s.labelIcon, { tintColor: bottomIconColor }]} />
        <Text style={s.colLabel}>{bottomLabel}</Text>
      </View>
      <Text style={s.bottomValue}>{bottomValue}</Text>
      <DeltaRow dir={bottomDelta.dir} label={bottomDelta.label} />
    </View>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function SummaryCard({ runs, today, unit }: SummaryCardProps) {
  const { current: c, previous: p } = getPeriodStats(runs, today)
  const hasPrev = p.runCount > 0
  const flat = { dir: 'flat' as DeltaDir, label: '' }

  const distTopDelta = hasPrev
    ? { dir: deltaDir(c.totalDistanceKm, p.totalDistanceKm), label: fmtDelta(c.totalDistanceKm, p.totalDistanceKm, n => fmtDistance(n, unit)) }
    : flat
  const distBotDelta = hasPrev
    ? { dir: deltaDir(c.avgDistanceKm, p.avgDistanceKm), label: fmtDelta(c.avgDistanceKm, p.avgDistanceKm, n => fmtDistance(n, unit)) }
    : flat

  const timeTopDelta = hasPrev
    ? { dir: deltaDir(c.totalTimeSec, p.totalTimeSec), label: fmtDelta(c.totalTimeSec, p.totalTimeSec, fmtDuration) }
    : flat
  const timeBotDelta = hasPrev
    ? { dir: deltaDir(c.avgTimeSec, p.avgTimeSec), label: fmtDelta(c.avgTimeSec, p.avgTimeSec, fmtDuration) }
    : flat

  const runsDelta = hasPrev
    ? { dir: deltaDir(c.runCount, p.runCount, false, true), label: fmtDelta(c.runCount, p.runCount, n => String(Math.round(n))) }
    : flat

  const paceDir = hasPrev ? deltaDir(c.avgPaceSecPerKm, p.avgPaceSecPerKm, true) : 'flat' as DeltaDir
  const paceDelta = hasPrev && paceDir !== 'flat'
    ? { dir: paceDir, label: `${paceDir === 'up' ? 'Faster' : 'Slower'} by ${fmtPaceDelta(c.avgPaceSecPerKm, p.avgPaceSecPerKm, unit)}` }
    : flat

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.headerLeft}>LAST 30 DAYS</Text>
        {hasPrev && <Text style={s.headerRight}>vs prev 30 days</Text>}
      </View>

      <View style={s.columns}>
        <StatCol
          topIcon={require('../../assets/distance.png')}
          topIconColor="#e8a900"
          topLabel="Total Distance"
          topValue={fmtDistance(c.totalDistanceKm, unit)}
          topDelta={distTopDelta}
          bottomIcon={require('../../assets/distance.png')}
          bottomIconColor="#e8a900"
          bottomLabel="Avg Distance"
          bottomValue={fmtDistance(c.avgDistanceKm, unit)}
          bottomDelta={distBotDelta}
        />
        <View style={s.colSep} />
        <StatCol
          topIcon={require('../../assets/time.png')}
          topIconColor="#00a6b8"
          topLabel="Total Time"
          topValue={fmtDuration(c.totalTimeSec)}
          topDelta={timeTopDelta}
          bottomIcon={require('../../assets/time.png')}
          bottomIconColor="#00a6b8"
          bottomLabel="Avg Time"
          bottomValue={fmtDuration(c.avgTimeSec)}
          bottomDelta={timeBotDelta}
        />
        <View style={s.colSep} />
        <StatCol
          topIcon={require('../../assets/counter.png')}
          topIconColor={colors.accent}
          topLabel="Number of Runs"
          topValue={String(c.runCount)}
          topDelta={runsDelta}
          bottomIcon={require('../../assets/pace.png')}
          bottomIconColor="#dc6600"
          bottomLabel="Avg Pace"
          bottomValue={c.avgPaceSecPerKm > 0 ? fmtPace(c.avgPaceSecPerKm, unit) : '—'}
          bottomDelta={paceDelta}
        />
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 18,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
    letterSpacing: 0.6,
  },
  headerRight: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  colSep: {
    width: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 8,
    alignSelf: 'stretch',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  labelIcon: {
    width: 13,
    height: 13,
  },
  colLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textDim,
    letterSpacing: 0.4,
  },
  topValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bottomValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginTop: 4,
    marginBottom: 10,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
    marginBottom: 6,
  },
  deltaIcon: {
    width: 12,
    height: 12,
  },
  deltaText: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
})
