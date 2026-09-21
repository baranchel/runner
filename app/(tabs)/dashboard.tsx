import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../../src/mockData'
import { fmtDate, fmtDistance, fmtDuration, fmtPace } from '../../src/utils/format'
import { getPeriodStats } from '../../src/utils/stats'
import { colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'

// ─── Module-level constants (stable mock data) ────────────────────────────────

const TODAY = new Date()
const UNIT: 'km' | 'mi' = 'km'

const WEEK_CUTOFF = (() => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - 6)
  return d.toISOString().slice(0, 10)
})()
const WEEK_RUNS = MOCK_RUNS.filter(r => r.date >= WEEK_CUTOFF)

const RECENT_RUNS = [...MOCK_RUNS]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 4)

const TYPE_MAP = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))

const HAS_PREV = getPeriodStats(MOCK_RUNS, TODAY).previous.runCount > 0

// ─── Summary Card (30-day) ────────────────────────────────────────────────────

type DeltaDir = 'up' | 'down' | 'flat'

function deltaDir(current: number, previous: number, lowerIsBetter = false, useAbsolute = false): DeltaDir {
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
  return `${diff >= 0 ? '+' : '−'}${formatter(Math.abs(diff))}`
}

function fmtPaceDelta(currentSec: number, previousSec: number, unit: 'km' | 'mi'): string {
  const factor = unit === 'mi' ? 1.60934 : 1
  const absDiff = Math.abs(currentSec - previousSec) * factor
  const m = Math.floor(absDiff / 60)
  const sec = Math.round(absDiff % 60)
  return `${m}:${String(sec).padStart(2, '0')}${unit === 'mi' ? '/mi' : '/km'}`
}

const ARROW = {
  up:   require('../../assets/up-arrow.png'),
  down: require('../../assets/down-arrow.png'),
  flat: require('../../assets/straight-arrow.png'),
}
const DELTA_COLORS: Record<DeltaDir, string> = {
  up: colors.elevLine, down: colors.danger, flat: colors.textFaint,
}

function DeltaRow({ dir, label }: { dir: DeltaDir; label: string }) {
  return (
    <View style={s.deltaRow}>
      <Image source={ARROW[dir]} style={[s.deltaIcon, { tintColor: DELTA_COLORS[dir] }]} />
      {dir !== 'flat' && <Text style={[s.deltaText, { color: DELTA_COLORS[dir] }]}>{label}</Text>}
    </View>
  )
}

interface StatColProps {
  topIcon: ReturnType<typeof require>; topIconColor: string; topLabel: string
  topValue: string; topDelta: { dir: DeltaDir; label: string }
  bottomIcon: ReturnType<typeof require>; bottomIconColor: string; bottomLabel: string
  bottomValue: string; bottomDelta: { dir: DeltaDir; label: string }
}
function StatCol({ topIcon, topIconColor, topLabel, topValue, topDelta, bottomIcon, bottomIconColor, bottomLabel, bottomValue, bottomDelta }: StatColProps) {
  return (
    <View style={s.col}>
      <View style={s.colLabelRow}>
        <Image source={topIcon} style={[s.colLabelIcon, { tintColor: topIconColor }]} />
        <Text style={s.colLabel}>{topLabel}</Text>
      </View>
      <Text style={s.colValue}>{topValue}</Text>
      <DeltaRow dir={topDelta.dir} label={topDelta.label} />
      <View style={s.colDivider} />
      <View style={s.colLabelRow}>
        <Image source={bottomIcon} style={[s.colLabelIcon, { tintColor: bottomIconColor }]} />
        <Text style={s.colLabel}>{bottomLabel}</Text>
      </View>
      <Text style={s.colValue}>{bottomValue}</Text>
      <DeltaRow dir={bottomDelta.dir} label={bottomDelta.label} />
    </View>
  )
}

function SummaryCard({ unit }: { unit: 'km' | 'mi' }) {
  const { current: c, previous: p } = getPeriodStats(MOCK_RUNS, TODAY)
  const hasPrev = p.runCount > 0
  const flat = { dir: 'flat' as DeltaDir, label: '' }

  const distTopDelta = hasPrev ? { dir: deltaDir(c.totalDistanceKm, p.totalDistanceKm), label: fmtDelta(c.totalDistanceKm, p.totalDistanceKm, n => fmtDistance(n, unit)) } : flat
  const distBotDelta = hasPrev ? { dir: deltaDir(c.avgDistanceKm, p.avgDistanceKm),     label: fmtDelta(c.avgDistanceKm, p.avgDistanceKm, n => fmtDistance(n, unit)) }     : flat
  const timeTopDelta = hasPrev ? { dir: deltaDir(c.totalTimeSec, p.totalTimeSec),        label: fmtDelta(c.totalTimeSec, p.totalTimeSec, fmtDuration) }                    : flat
  const timeBotDelta = hasPrev ? { dir: deltaDir(c.avgTimeSec, p.avgTimeSec),            label: fmtDelta(c.avgTimeSec, p.avgTimeSec, fmtDuration) }                        : flat
  const runsDelta    = hasPrev ? { dir: deltaDir(c.runCount, p.runCount, false, true),   label: fmtDelta(c.runCount, p.runCount, n => String(Math.round(n))) }              : flat
  const paceDir      = hasPrev ? deltaDir(c.avgPaceSecPerKm, p.avgPaceSecPerKm, true) : 'flat' as DeltaDir
  const paceDelta    = hasPrev && paceDir !== 'flat'
    ? { dir: paceDir, label: `${paceDir === 'up' ? 'Faster' : 'Slower'} by ${fmtPaceDelta(c.avgPaceSecPerKm, p.avgPaceSecPerKm, unit)}` }
    : flat

  return (
    <View style={s.summaryCard}>
      <View style={s.summaryColumns}>
        <StatCol
          topIcon={require('../../assets/distance.png')} topIconColor={colors.iconGold}
          topLabel="Total Distance" topValue={fmtDistance(c.totalDistanceKm, unit)} topDelta={distTopDelta}
          bottomIcon={require('../../assets/distance.png')} bottomIconColor={colors.iconGold}
          bottomLabel="Avg Distance" bottomValue={fmtDistance(c.avgDistanceKm, unit)} bottomDelta={distBotDelta}
        />
        <View style={s.colSep} />
        <StatCol
          topIcon={require('../../assets/time.png')} topIconColor={colors.iconTeal}
          topLabel="Total Time" topValue={fmtDuration(c.totalTimeSec)} topDelta={timeTopDelta}
          bottomIcon={require('../../assets/time.png')} bottomIconColor={colors.iconTeal}
          bottomLabel="Avg Time" bottomValue={fmtDuration(c.avgTimeSec)} bottomDelta={timeBotDelta}
        />
        <View style={s.colSep} />
        <StatCol
          topIcon={require('../../assets/counter.png')} topIconColor={colors.accent}
          topLabel="Number of Runs" topValue={String(c.runCount)} topDelta={runsDelta}
          bottomIcon={require('../../assets/pace.png')} bottomIconColor={colors.iconOrange}
          bottomLabel="Avg Pace" bottomValue={c.avgPaceSecPerKm > 0 ? fmtPace(c.avgPaceSecPerKm, unit) : '—'} bottomDelta={paceDelta}
        />
      </View>
    </View>
  )
}

// ─── Weekly Stats Grid ────────────────────────────────────────────────────────

function WeeklyGrid() {
  const dist = WEEK_RUNS.reduce((s, r) => s + r.distanceKm, 0)
  const time = WEEK_RUNS.reduce((s, r) => s + r.timeSec, 0)
  const pace = dist > 0 ? time / dist : 0

  const stats = [
    { label: 'Total Distance',  value: fmtDistance(dist, UNIT),            icon: require('../../assets/distance.png'), color: colors.iconGold },
    { label: 'Total Time',     value: fmtDuration(time),                   icon: require('../../assets/time.png'),     color: colors.iconTeal },
    { label: 'Number of Runs', value: String(WEEK_RUNS.length),            icon: require('../../assets/counter.png'), color: colors.accent },
    { label: 'Avg Pace',       value: pace > 0 ? fmtPace(pace, UNIT) : '—', icon: require('../../assets/pace.png'), color: colors.iconOrange },
  ]

  return (
    <View>
      <Text style={s.sectionLabel}>THIS WEEK</Text>
      <View style={s.gridRow}>
        {stats.slice(0, 2).map(({ label, value, icon, color }) => (
          <TouchableOpacity key={label} style={s.statCard} activeOpacity={0.7}>
            <View style={s.statLabelRow}>
              <Image source={icon} style={[s.statIcon, { tintColor: color }]} />
              <Text style={s.statLabel}>{label}</Text>
              <Text style={s.statChevron}>›</Text>
            </View>
            <Text style={s.statValue}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={[s.gridRow, { marginTop: 10 }]}>
        {stats.slice(2).map(({ label, value, icon, color }) => (
          <TouchableOpacity key={label} style={s.statCard} activeOpacity={0.7}>
            <View style={s.statLabelRow}>
              <Image source={icon} style={[s.statIcon, { tintColor: color }]} />
              <Text style={s.statLabel}>{label}</Text>
              <Text style={s.statChevron}>›</Text>
            </View>
            <Text style={s.statValue}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// ─── Recent Runs ──────────────────────────────────────────────────────────────

function RecentRuns({ onSeeAll, router }: { onSeeAll: () => void; router: ReturnType<typeof useRouter> }) {
  return (
    <View>
      <View style={s.rowBetween}>
        <Text style={s.sectionLabel}>RECENT RUNS</Text>
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={s.seeAll}>See all →</Text>
        </TouchableOpacity>
      </View>
      <View style={s.runList}>
        {RECENT_RUNS.map(run => {
          const type = run.typeId ? TYPE_MAP[run.typeId] : null
          const barColor = type ? runTypeColor(type.hue) : colors.textGhost
          const pace = run.timeSec / run.distanceKm
          return (
            <TouchableOpacity key={run.id} style={s.runRow} activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}`)}>
              <View style={[s.typeBar, { backgroundColor: barColor }]} />
              <View style={s.runCenter}>
                <Text style={s.runType}>{type?.name ?? 'Unclassified'}</Text>
                <Text style={s.runDate}>{fmtDate(run.date)}</Text>
                <Text style={s.runMeta}>
                  {fmtDistance(run.distanceKm, UNIT)} · {fmtPace(pace, UNIT)} · {fmtDuration(run.timeSec)}
                </Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <View>
          <View style={s.rowBetween}>
            <Text style={[s.sectionLabel, { marginBottom: 0 }]}>LAST 30 DAYS</Text>
            {HAS_PREV && <Text style={s.prevLabel}>vs prev 30 days</Text>}
          </View>
          <SummaryCard unit={UNIT} />
        </View>
        <WeeklyGrid />
        <RecentRuns onSeeAll={() => router.push('/(tabs)/runs')} router={router} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { padding: spacing.screenH, gap: spacing.gap },

  sectionLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  prevLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
  },

  // Weekly grid
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 14,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  statChevron: {
    fontSize: 14,
    color: colors.textGhost,
    marginLeft: 'auto',
  },
  statIcon: {
    width: 12,
    height: 12,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textDim,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
  },

  // Recent runs
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  seeAll: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.accent,
  },
  runList: {
    gap: 8,
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 12,
    gap: 12,
  },
  typeBar: {
    width: 8,
    height: 36,
    borderRadius: 4,
  },
  runCenter: {
    flex: 1,
    gap: 1,
  },
  runType: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  runDate: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
  },
  runMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  chevron: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.textGhost,
  },

  // Summary card
  summaryCard: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 18,
    paddingBottom: 10,
  },
  summaryColumns: { flexDirection: 'row', alignItems: 'flex-start' },
  col:            { flex: 1, alignItems: 'center' },
  colSep:         { width: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 8, alignSelf: 'stretch' },
  colLabelRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  colLabelIcon:   { width: 13, height: 13 },
  colLabel:       { fontFamily: fonts.body, fontSize: 10, color: colors.textDim, letterSpacing: 0.4 },
  colValue:       { fontFamily: fonts.mono, fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  colDivider:     { width: '80%', height: 1, backgroundColor: colors.borderSubtle, marginTop: 4, marginBottom: 10 },
  deltaRow:       { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, marginBottom: 6 },
  deltaIcon:      { width: 12, height: 12 },
  deltaText:      { fontFamily: fonts.body, fontSize: 11 },
})
