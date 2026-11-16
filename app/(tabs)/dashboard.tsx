import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RunCard } from '../../src/components/RunCard'
import { MOCK_RUNS } from '../../src/mockData'
import { fmtDate, fmtDistance, fmtDuration, fmtPace } from '../../src/utils/format'
import { getPeriodStats } from '../../src/utils/stats'
import { colors, fonts, spacing } from '../../src/utils/tokens'

// ─── Module-level constants (stable mock data) ────────────────────────────────

const TODAY = new Date()
const UNIT: 'km' | 'mi' = 'km'

const RECENT_RUNS = [...MOCK_RUNS]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 4)

// Local-date ISO (toISOString would shift to UTC)
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

// Split "24.8 km" into ["24.8", "km"] so the number and unit can be styled apart
const splitDist = (km: number) => fmtDistance(km, UNIT).split(' ')

// ─── Week stats (calendar week, Mon–Sun) ──────────────────────────────────────

function getWeek(today: Date) {
  const monday = addDays(today, -((today.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => iso(addDays(monday, i)))
  const inRange = (from: string, to: string) => MOCK_RUNS.filter(r => r.date >= from && r.date <= to)

  const runs = inRange(days[0], days[6])
  const dayKm = days.map(d => runs.filter(r => r.date === d).reduce((s, r) => s + r.distanceKm, 0))
  const dist = runs.reduce((s, r) => s + r.distanceKm, 0)
  const time = runs.reduce((s, r) => s + r.timeSec, 0)
  // Last week up to the same weekday, so mid-week isn't compared against a full week
  const lastDist = inRange(iso(addDays(monday, -7)), iso(addDays(today, -7))).reduce((s, r) => s + r.distanceKm, 0)

  return {
    days, dayKm, dist, time,
    runCount: runs.length,
    pace: dist > 0 ? time / dist : 0,
    pct: lastDist > 0 ? Math.round((dist - lastDist) / lastDist * 100) : null,
  }
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const TRACK_H = 64

function WeekCard() {
  const w = getWeek(TODAY)
  const max = Math.max(...w.dayKm)
  const [num, unit] = splitDist(w.dist)

  return (
    <View style={s.weekCard}>
      <Text style={s.weekTitle}>This week</Text>
      <Text style={s.weekRange}>{fmtDate(w.days[0])} – {fmtDate(w.days[6])}</Text>

      <View style={s.heroRow}>
        <View style={s.heroNum}>
          <Text style={s.heroValue}>{num}</Text>
          <Text style={s.heroUnit}>{unit}</Text>
        </View>
        {w.pct != null && (
          <View style={s.growth}>
            <View style={s.growthPill}>
              <Text style={s.growthText}>{w.pct >= 0 ? '↗' : '↘'}  {Math.abs(w.pct)}%</Text>
            </View>
            <Text style={s.growthLabel}>vs. last week</Text>
          </View>
        )}
      </View>

      <View style={s.bars}>
        {w.dayKm.map((km, i) => {
          const isMax = km > 0 && km === max
          return (
            <View key={i} style={s.barCol}>
              <View style={s.track}>
                {km > 0 && (
                  <View style={[s.bar, { height: TRACK_H * km / max }, isMax && { backgroundColor: colors.lime }]} />
                )}
              </View>
              <Text style={[s.barLabel, isMax && { color: colors.ink }]}>{DAY_LETTERS[i]}</Text>
            </View>
          )
        })}
      </View>

      <View style={s.weekDivider} />
      <View style={s.weekFooter}>
        <Text style={s.footerStrong}>{w.runCount} runs</Text>
        <Text style={s.footerText}>{fmtDuration(w.time)}</Text>
        <Text style={s.footerText}>{w.pace > 0 ? fmtPace(w.pace, UNIT) : '—'} avg. pace</Text>
      </View>
    </View>
  )
}

// ─── 30-day card ──────────────────────────────────────────────────────────────

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

interface Stat { label: string; value: string; dir: DeltaDir; delta: string }

function StatCell({ label, value, dir, delta }: Stat) {
  return (
    <View style={s.cell}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={s.cellValue}>{value}</Text>
      <View style={s.deltaRow}>
        <Image source={ARROW[dir]} style={s.deltaIcon} />
        {dir !== 'flat' && <Text style={s.deltaText}>{delta}</Text>}
      </View>
    </View>
  )
}

function ThirtyDayCard() {
  const { current: c, previous: p } = getPeriodStats(MOCK_RUNS, TODAY)
  const hasPrev = p.runCount > 0
  const d = (dir: DeltaDir, delta: string) => hasPrev ? { dir, delta } : { dir: 'flat' as DeltaDir, delta: '' }

  const paceDir = deltaDir(c.avgPaceSecPerKm, p.avgPaceSecPerKm, true)
  const stats: Stat[] = [
    { label: 'Total time', value: fmtDuration(c.totalTimeSec),
      ...d(deltaDir(c.totalTimeSec, p.totalTimeSec), fmtDelta(c.totalTimeSec, p.totalTimeSec, fmtDuration)) },
    { label: 'Runs', value: String(c.runCount),
      ...d(deltaDir(c.runCount, p.runCount, false, true), fmtDelta(c.runCount, p.runCount, n => String(Math.round(n)))) },
    { label: 'Avg pace', value: c.avgPaceSecPerKm > 0 ? fmtPace(c.avgPaceSecPerKm, UNIT) : '—',
      ...d(paceDir, `${paceDir === 'up' ? 'Faster' : 'Slower'} ${fmtPaceDelta(c.avgPaceSecPerKm, p.avgPaceSecPerKm, UNIT)}`) },
    { label: 'Avg distance', value: fmtDistance(c.avgDistanceKm, UNIT),
      ...d(deltaDir(c.avgDistanceKm, p.avgDistanceKm), fmtDelta(c.avgDistanceKm, p.avgDistanceKm, n => fmtDistance(n, UNIT))) },
    { label: 'Avg time', value: fmtDuration(c.avgTimeSec),
      ...d(deltaDir(c.avgTimeSec, p.avgTimeSec), fmtDelta(c.avgTimeSec, p.avgTimeSec, fmtDuration)) },
  ]

  const distPct = hasPrev && p.totalDistanceKm > 0
    ? Math.round((c.totalDistanceKm - p.totalDistanceKm) / p.totalDistanceKm * 100)
    : null

  return (
    <View style={s.limeCard}>
      <Text style={s.limeEyebrow}>LAST 30 DAYS</Text>
      <View style={s.limeHero}>
        <View>
          <Text style={s.limeValue}>{fmtDistance(c.totalDistanceKm, UNIT)}</Text>
          {hasPrev && <Text style={s.limeSub}>vs. {fmtDistance(p.totalDistanceKm, UNIT)} prev 30 days</Text>}
        </View>
        {distPct != null && (
          <View style={s.limeRight}>
            <Text style={s.limePct}>{distPct >= 0 ? '+' : '−'}{Math.abs(distPct)}%</Text>
            <Text style={s.limeSub}>{distPct >= 0 ? 'more' : 'less'} distance</Text>
          </View>
        )}
      </View>
      <View style={s.limeDivider} />
      <View style={s.grid}>
        {stats.map(st => <StatCell key={st.label} {...st} />)}
      </View>
    </View>
  )
}

// ─── Recent Runs ──────────────────────────────────────────────────────────────

function RecentRuns({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <View style={{ gap: 11 }}>
      <View style={s.rowBetween}>
        <Text style={s.sectionTitle}>Recent runs</Text>
        <TouchableOpacity style={s.pill} onPress={() => router.push('/(tabs)/runs')}>
          <Text style={s.pillText}>See all →</Text>
        </TouchableOpacity>
      </View>
      {RECENT_RUNS.map(run => <RunCard key={run.id} run={run} unit={UNIT} />)}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter()
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <WeekCard />
        <ThirtyDayCard />
        <RecentRuns router={router} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: 24, paddingVertical: spacing.screenH, gap: 22 },

  // Week card (lavender)
  weekCard:   { backgroundColor: colors.accent, borderRadius: 26, padding: 22 },
  weekTitle:  { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.ink },
  weekRange:  { fontFamily: fonts.body, fontSize: 11, fontWeight: '500', color: colors.ink, opacity: 0.7, marginTop: 6 },
  heroRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 },
  heroNum:    { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  heroValue:  { fontFamily: fonts.mono, fontSize: 56, fontWeight: '600', color: colors.ink },
  heroUnit:   { fontFamily: fonts.body, fontSize: 17, fontWeight: '500', color: colors.ink },
  growth:     { alignItems: 'center', marginTop: 15, gap: 8 },
  growthPill: { backgroundColor: colors.lime, borderRadius: 14, paddingHorizontal: 17, paddingVertical: 7, minWidth: 98 },
  growthText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '600', color: colors.ink },
  growthLabel:{ fontFamily: fonts.body, fontSize: 10, color: colors.ink, opacity: 0.75 },

  bars:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 4 },
  barCol:    { alignItems: 'center', gap: 8 },
  track:     { width: 28, height: TRACK_H, borderRadius: 7, backgroundColor: 'rgba(29,23,44,0.06)', justifyContent: 'flex-end', overflow: 'hidden' },
  bar:       { width: 28, borderRadius: 7, backgroundColor: 'rgba(29,23,44,0.6)' },
  barLabel:  { fontFamily: fonts.body, fontSize: 10, fontWeight: '500', color: 'rgba(29,23,44,0.65)' },

  weekDivider: { height: 1, backgroundColor: 'rgba(29,23,44,0.14)', marginTop: 13 },
  weekFooter:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 13 },
  footerStrong:{ fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.ink },
  footerText:  { fontFamily: fonts.mono, fontSize: 11, fontWeight: '500', color: colors.ink },

  // 30-day card (lime)
  limeCard:    { backgroundColor: colors.lime, borderRadius: 22, padding: 18 },
  limeEyebrow: { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', color: colors.ink },
  limeHero:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 },
  limeValue:   { fontFamily: fonts.mono, fontSize: 26, fontWeight: '600', color: colors.ink },
  limeSub:     { fontFamily: fonts.body, fontSize: 11, fontWeight: '500', color: colors.ink, marginTop: 4 },
  limeRight:   { alignItems: 'flex-start' },
  limePct:     { fontFamily: fonts.mono, fontSize: 25, fontWeight: '600', color: colors.ink },
  limeDivider: { height: 1, backgroundColor: 'rgba(29,23,44,0.14)', marginVertical: 14 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  cell:        { width: '33.33%' },
  cellLabel:   { fontFamily: fonts.body, fontSize: 10, fontWeight: '500', color: colors.ink, opacity: 0.7 },
  cellValue:   { fontFamily: fonts.mono, fontSize: 16, fontWeight: '600', color: colors.ink, marginTop: 3 },
  deltaRow:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  deltaIcon:   { width: 11, height: 11, tintColor: colors.ink },
  deltaText:   { fontFamily: fonts.body, fontSize: 10, color: colors.ink },

  // Recent runs
  rowBetween:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: fonts.body, fontSize: 19, fontWeight: '600', color: colors.textPrimary },
  pill:         { backgroundColor: colors.bgElevated, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 7 },
  pillText:     { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.accent },

})
