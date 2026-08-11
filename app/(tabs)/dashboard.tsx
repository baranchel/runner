import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import SummaryCard from '../../src/components/SummaryCard'
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

// ─── Weekly Stats Grid ────────────────────────────────────────────────────────

function WeeklyGrid() {
  const dist = WEEK_RUNS.reduce((s, r) => s + r.distanceKm, 0)
  const time = WEEK_RUNS.reduce((s, r) => s + r.timeSec, 0)
  const pace = dist > 0 ? time / dist : 0

  const stats = [
    { label: 'Total Distance',  value: fmtDistance(dist, UNIT),            icon: require('../../assets/distance.png'), color: '#e8a900' },
    { label: 'Total Time',     value: fmtDuration(time),                   icon: require('../../assets/time.png'),     color: '#00a6b8' },
    { label: 'Number of Runs', value: String(WEEK_RUNS.length),            icon: require('../../assets/counter.png'), color: colors.accent },
    { label: 'Avg Pace',       value: pace > 0 ? fmtPace(pace, UNIT) : '—', icon: require('../../assets/pace.png'), color: '#dc6600' },
  ]

  return (
    <View>
      <Text style={s.sectionLabel}>THIS WEEK</Text>
      <View style={s.gridRow}>
        {stats.slice(0, 2).map(({ label, value, icon, color }) => (
          <View key={label} style={s.statCard}>
            <View style={s.statLabelRow}>
              <Image source={icon} style={[s.statIcon, { tintColor: color }]} />
              <Text style={s.statLabel}>{label}</Text>
            </View>
            <Text style={s.statValue}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={[s.gridRow, { marginTop: 10 }]}>
        {stats.slice(2).map(({ label, value, icon, color }) => (
          <View key={label} style={s.statCard}>
            <View style={s.statLabelRow}>
              <Image source={icon} style={[s.statIcon, { tintColor: color }]} />
              <Text style={s.statLabel}>{label}</Text>
            </View>
            <Text style={s.statValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ─── Recent Runs ──────────────────────────────────────────────────────────────

function RecentRuns({ onSeeAll }: { onSeeAll: () => void }) {
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
            <View key={run.id} style={s.runRow}>
              <View style={[s.typeBar, { backgroundColor: barColor }]} />
              <View style={s.runCenter}>
                <Text style={s.runType}>{type?.name ?? 'Unclassified'}</Text>
                <Text style={s.runDate}>{fmtDate(run.date)}</Text>
                <Text style={s.runMeta}>
                  {fmtDistance(run.distanceKm, UNIT)} · {fmtPace(pace, UNIT)} · {fmtDuration(run.timeSec)}
                </Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </View>
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
          <SummaryCard runs={MOCK_RUNS} today={TODAY} unit={UNIT} />
        </View>
        <WeeklyGrid />
        <RecentRuns onSeeAll={() => router.push('/(tabs)/runs')} />
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
    gap: 4,
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
})
