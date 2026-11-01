import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../../src/mockData'
import type { Run, Segment, Split } from '../../src/types'
import { fmtDateFull, fmtDistance, fmtDuration, fmtMMSS, fmtPace } from '../../src/utils/format'
import { colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'
import { computePrimaryZone } from '../../src/utils/zones'
import { Chart, HrRangeBarsChart, PaceBarsChart } from '../../src/components/Chart'
import type { PaceBar, PaceKind } from '../../src/components/Chart'
import { SplitsTable, tableStyles as st } from '../../src/components/SplitsTable'
import { SegmentsTable } from '../../src/components/SegmentsTable'
import { hrSeries } from '../../src/utils/chart'

const UNIT = 'km' as const
const TYPE_MAP = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))

const SOURCE_LABEL: Record<string, string> = {
  apple_health: 'Apple Health',
  strava: 'Strava',
  garmin: 'Garmin',
}

// map segment type → pace-bar visual kind
function segKind(t: Segment['type']): PaceKind {
  if (t === 'rest') return 'rest'
  if (t === 'warmup' || t === 'cooldown') return 'ends'
  return 'work'
}

function getPaceRange(splits: Split[]): { fastest: number; slowest: number } | null {
  if (splits.length === 0) return null
  let prevKm = 0
  const paces: number[] = []
  for (const s of splits) {
    const segKm = s.km - prevKm
    prevKm = s.km
    if (segKm > 0) paces.push(s.timeSec / segKm)
  }
  if (paces.length === 0) return null
  return { fastest: Math.min(...paces), slowest: Math.max(...paces) }
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: ReturnType<typeof require>
  iconColor: string
  label: string
  value: string
  sub?: string
}

function MetricCard({ icon, iconColor, label, value, sub }: MetricCardProps) {
  return (
    <View style={[s.metricCard, { borderColor: iconColor + '66' }]}>
      <View style={s.metricLabelRow}>
        <Image source={icon} style={[s.metricIcon, { tintColor: iconColor }]} />
        <Text style={s.metricLabel}>{label}</Text>
      </View>
      <Text style={s.metricValue}>{value}</Text>
      {sub ? <Text style={s.metricSub}>{sub}</Text> : null}
    </View>
  )
}

// ─── Summary Grid ─────────────────────────────────────────────────────────────

function SummaryGrid({ run, unit }: { run: Run; unit: 'km' | 'mi' }) {
  const avgPace = run.timeSec / run.distanceKm
  const paceRange = getPaceRange(run.splits)
  const calories = Math.round(run.distanceKm * 62)
  const zone = computePrimaryZone(run)

  const rows: [MetricCardProps, MetricCardProps][] = [
    [
      {
        icon: require('../../assets/distance.png'), iconColor: colors.iconGold,
        label: 'Distance', value: fmtDistance(run.distanceKm, unit),
      },
      {
        icon: require('../../assets/time.png'), iconColor: colors.iconTeal,
        label: 'Time', value: fmtDuration(run.timeSec),
      },
    ],
    [
      {
        icon: require('../../assets/pace.png'), iconColor: colors.iconOrange,
        label: 'Avg Pace', value: fmtPace(avgPace, unit),
        sub: paceRange ? `${fmtPace(paceRange.fastest, unit)}–${fmtPace(paceRange.slowest, unit)}` : undefined,
      },
      {
        icon: require('../../assets/heart-rate.png'), iconColor: colors.hrLine,
        label: 'Avg HR',
        value: run.avgHr != null ? `${run.avgHr} bpm` : '—',
        sub: run.minHr != null && run.maxHr != null ? `${run.minHr}–${run.maxHr} bpm` : undefined,
      },
    ],
    [
      {
        icon: require('../../assets/elevation.png'), iconColor: colors.elevLine,
        label: 'Elevation', value: run.elevGain != null ? `${run.elevGain} m` : '—',
      },
      {
        icon: require('../../assets/calories.png'), iconColor: colors.iconOrange,
        label: 'Calories', value: `${calories} kcal`,
      },
    ],
    [
      {
        icon: require('../../assets/weather.png'), iconColor: colors.iconSky,
        label: 'Weather',
        value: run.weather != null ? `${run.weather.tempC}°C` : '—',
        sub: run.weather != null ? `Humidity: ${run.weather.humidity}%` : undefined,
      },
      {
        icon: require('../../assets/pace.png'), iconColor: colors.accent,
        label: 'Primary Zone',
        value: zone ? `Zone ${zone.zone}` : '—',
        sub: zone ? `${zone.name} · ${Math.round(zone.timeSec / 60)}m` : undefined,
      },
    ],
  ]

  return (
    <View style={s.gridWrap}>
      {rows.map((row, ri) => (
        <View key={ri} style={s.gridRow}>
          {row.map((card, ci) => (
            <MetricCard key={ci} {...card} />
          ))}
        </View>
      ))}
    </View>
  )
}

// ─── Charts Section ──────────────────────────────────────────────────────────

function ChartsSection({ run, typeColor, unit }: { run: Run; typeColor: string; unit: 'km' | 'mi' }) {
  const router = useRouter()
  const avgPace = run.timeSec / run.distanceKm
  const hrDots = hrSeries(run)

  // pace bars follow the intervals (segments) when available, else the km splits
  let pacePrevKm = 0
  const paceBars: PaceBar[] = run.segments
    ? run.segments
        .filter(seg => seg.distanceKm > 0)
        .map(seg => ({ pace: seg.timeSec / seg.distanceKm, kind: segKind(seg.type), dist: seg.distanceKm }))
    : run.splits.map(sp => {
        const segKm = sp.km - pacePrevKm
        pacePrevKm = sp.km
        return { pace: segKm > 0 ? sp.timeSec / segKm : avgPace, kind: 'work' as const, dist: segKm }
      })

  return (
    <>
      <View>
        <Text style={s.sectionLabel}>PACE</Text>
        <View style={ch.card}>
          <PaceBarsChart
            bars={paceBars}
            avgPace={avgPace}
            unit={unit}
          />
        </View>
      </View>
      <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}/zones`)}>
        <View style={s.tapHeader}>
          <Text style={[s.sectionLabel, { marginBottom: 0 }]}>HEART RATE</Text>
          <Text style={s.tapChevron}>›</Text>
        </View>
        <View style={ch.card}>
          <HrRangeBarsChart
            dots={hrDots}
            timeSec={run.timeSec}
          />
        </View>
      </TouchableOpacity>
    </>
  )
}

// ─── Segments Section ────────────────────────────────────────────────────────

function SegmentsSection({ run, typeColor, unit }: { run: Run; typeColor: string; unit: 'km' | 'mi' }) {
  const router = useRouter()
  if (!run.segments) return null
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}/segments`)}>
      <View style={s.tapHeader}>
        <Text style={[s.sectionLabel, { marginBottom: 0 }]}>STRUCTURE</Text>
        <Text style={s.tapChevron}>›</Text>
      </View>
      <SegmentsTable run={run} typeColor={typeColor} unit={unit} limit={5} />
    </TouchableOpacity>
  )
}

// ─── Map Placeholder ─────────────────────────────────────────────────────────

function MapPlaceholder() {
  return (
    <View>
      <Text style={s.sectionLabel}>MAP</Text>
      <View style={mp.card}>
        <Text style={mp.label}>Map coming in Phase 3</Text>
      </View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RunDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const run = MOCK_RUNS.find(r => r.id === id)

  if (!run) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Text style={s.notFound}>Run not found</Text>
      </SafeAreaView>
    )
  }

  const type = run.typeId ? TYPE_MAP[run.typeId] : null
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* disable swipe-back so scrubbing the HR chart doesn't pop the screen;
          the ‹ Back button remains the way out */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ScrollView contentContainerStyle={s.content}>
        {/* header */}
        <View style={s.header}>
          <View style={[s.headerBar, { backgroundColor: typeColor }]} />
          <View>
            <Text style={s.headerType}>{type?.name ?? 'Unclassified'}</Text>
            <Text style={s.headerDate}>{fmtDateFull(run.date)}</Text>
            <Text style={s.headerSource}>Synced from {SOURCE_LABEL[run.source] ?? run.source}</Text>
          </View>
        </View>

        {/* summary */}
        <SummaryGrid run={run} unit={UNIT} />

        {/* splits — tap to open the full splits screen */}
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}/splits`)}>
          <View style={s.tapHeader}>
            <Text style={[s.sectionLabel, { marginBottom: 0 }]}>SPLITS</Text>
            <Text style={s.tapChevron}>›</Text>
          </View>
          <SplitsTable run={run} unit={UNIT} limit={5} />
        </TouchableOpacity>

        {/* segments */}
        {run.segments && <SegmentsSection run={run} typeColor={typeColor} unit={UNIT} />}

        {/* charts */}
        <ChartsSection run={run} typeColor={typeColor} unit={UNIT} />
        <MapPlaceholder />
      </ScrollView>

      {/* floating back button — pinned top-left, always visible */}
      <TouchableOpacity onPress={() => router.back()} style={[s.backFab, { top: insets.top + 12 }]} activeOpacity={0.7}>
        <Text style={s.backFabIcon}>‹</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { padding: spacing.screenH, paddingTop: 72, gap: spacing.gap },

  backFab: {
    position: 'absolute',
    left: spacing.screenH,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  backFabIcon: {
    fontFamily: fonts.body,
    fontSize: 28,
    lineHeight: 30,
    color: colors.textPrimary,
    marginTop: -3,
    marginLeft: -2,
  },

  header:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerBar:  { width: 8, height: 52, borderRadius: 4 },
  headerType: { fontFamily: fonts.body, fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  headerDate: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, marginTop: 2 },
  headerSource: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },

  gridWrap: { gap: 10 },
  gridRow:  { flexDirection: 'row', gap: 10 },

  metricCard: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 14,
  },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  metricIcon:     { width: 12, height: 12 },
  metricLabel:    { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  metricValue:    { fontFamily: fonts.mono, fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  metricSub:      { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 3 },

  sectionLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  tapHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tapChevron: { fontFamily: fonts.body, fontSize: 18, color: colors.textGhost },

  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
})


const ch = StyleSheet.create({
  card: {
    backgroundColor: colors.bgChart,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    overflow: 'hidden',
  },
})

const mp = StyleSheet.create({
  card:  { backgroundColor: colors.bgChart, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: spacing.radius, height: 160, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
})
