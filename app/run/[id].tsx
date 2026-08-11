import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../../src/mockData'
import type { Run, Segment, Split } from '../../src/types'
import { fmtDateFull, fmtDistance, fmtDuration, fmtMMSS, fmtPace } from '../../src/utils/format'
import { colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'
import { computePrimaryZone } from '../../src/utils/zones'
import { Chart } from '../../src/components/Chart'
import { genSeries } from '../../src/utils/chart'

const UNIT = 'km' as const
const TYPE_MAP = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))

const SOURCE_LABEL: Record<string, string> = {
  apple_health: 'Apple Health',
  strava: 'Strava',
  garmin: 'Garmin',
}

const SEGMENT_DISPLAY: Record<string, { label: string; color: (typeColor: string) => string }> = {
  warmup:   { label: 'Warm-up',   color: () => colors.elevLine },
  cooldown: { label: 'Cool-down', color: () => colors.elevLine },
  rep:      { label: 'Work',      color: (tc) => tc },
  main:     { label: 'Work',      color: (tc) => tc },
  rest:     { label: 'Rest',      color: () => colors.textMuted },
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

// ─── Splits Table ─────────────────────────────────────────────────────────────

function SplitsTable({ run, unit }: { run: Run; unit: 'km' | 'mi' }) {
  let prevKm = 0
  return (
    <View>
      <Text style={s.sectionLabel}>SPLITS</Text>
      <View style={st.card}>
        {/* header */}
        <View style={[st.row, st.headerRow]}>
          <Text style={[st.cell, st.hdr, { flex: 0.4, color: colors.textDim }]}>#</Text>
          <Text style={[st.cell, st.hdr, { color: colors.accent }]}>Dist</Text>
          <Text style={[st.cell, st.hdr, { color: colors.iconOrange }]}>Pace</Text>
          <Text style={[st.cell, st.hdr, { color: colors.iconTeal }]}>Time</Text>
          <Text style={[st.cell, st.hdr, { color: colors.hrLine }]}>HR</Text>
        </View>
        {run.splits.map((split, i) => {
          const segKm = split.km - prevKm
          const pace = segKm > 0 ? split.timeSec / segKm : 0
          prevKm = split.km
          return (
            <View key={i} style={[st.row, i > 0 && st.borderTop]}>
              <Text style={[st.cell, st.val, { flex: 0.4, color: colors.textMuted }]}>{i + 1}</Text>
              <Text style={[st.cell, st.val, { color: colors.accent }]}>{fmtDistance(split.km, unit)}</Text>
              <Text style={[st.cell, st.val, { color: colors.iconOrange }]}>{pace > 0 ? fmtPace(pace, unit) : '—'}</Text>
              <Text style={[st.cell, st.val, { color: colors.iconTeal }]}>{fmtMMSS(split.timeSec)}</Text>
              <Text style={[st.cell, st.val, { color: colors.hrLine }]}>{split.avgHr ?? '—'}</Text>
            </View>
          )
        })}
      </View>
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
  const avgPace = run.timeSec / run.distanceKm
  const avgHr = run.avgHr ?? 140

  const paceSeries = genSeries(run.id + 'pace', 16, avgPace, 14, 0)
  const hrSeries   = genSeries(run.id + 'hr',   16, avgHr - 6, 8, 14)

  return (
    <>
      <View>
        <Text style={s.sectionLabel}>PACE</Text>
        <View style={ch.card}>
          <Chart
            series={paceSeries}
            strokeColor={typeColor}
            formatValue={(v) => fmtPace(v, unit)}
          />
        </View>
      </View>
      <View>
        <Text style={s.sectionLabel}>HEART RATE</Text>
        <View style={ch.card}>
          <Chart
            series={hrSeries}
            strokeColor={colors.hrLine}
            formatValue={(v) => `${Math.round(v)} bpm`}
          />
        </View>
      </View>
    </>
  )
}

// ─── Segments Section ────────────────────────────────────────────────────────

function SegmentsSection({ run, typeColor, unit }: { run: Run; typeColor: string; unit: 'km' | 'mi' }) {
  if (!run.segments) return null
  return (
    <View>
      <Text style={s.sectionLabel}>STRUCTURE</Text>
      <View style={st.card}>
        <View style={[st.row, st.headerRow]}>
          <Text style={[st.cell, st.hdr, { flex: 1.4 }]}>Type</Text>
          <Text style={[st.cell, st.hdr, { color: colors.iconGold }]}>Dist</Text>
          <Text style={[st.cell, st.hdr, { color: colors.iconOrange }]}>Pace</Text>
          <Text style={[st.cell, st.hdr, { color: colors.iconTeal }]}>Time</Text>
          <Text style={[st.cell, st.hdr, { color: colors.hrLine }]}>HR</Text>
        </View>
        {run.segments.map((seg, i) => {
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
              <Text style={[st.cell, st.val, { color: colors.hrLine }]} numberOfLines={1}>{seg.avgHr ?? '—'}</Text>
            </View>
          )
        })}
      </View>
    </View>
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
      <ScrollView contentContainerStyle={s.content}>
        {/* back */}
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>

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

        {/* splits */}
        <SplitsTable run={run} unit={UNIT} />

        {/* segments */}
        {run.segments && <SegmentsSection run={run} typeColor={typeColor} unit={UNIT} />}

        {/* charts */}
        <ChartsSection run={run} typeColor={typeColor} unit={UNIT} />
        <MapPlaceholder />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { padding: spacing.screenH, gap: spacing.gap },

  backBtn:  { marginBottom: 4 },
  backText: { fontFamily: fonts.body, fontSize: 12, color: colors.accent },

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

  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
})

const st = StyleSheet.create({
  card:      { backgroundColor: colors.bgChart, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: spacing.radius, overflow: 'hidden' },
  row:       { flexDirection: 'row' },
  rowCenter: { alignItems: 'center' },
  headerRow: { backgroundColor: colors.bgElevated },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  cell:      { flex: 1, paddingHorizontal: 10, paddingVertical: 10 },
  hdr:       { fontFamily: fonts.body, fontSize: 11, color: colors.textDim },
  val:       { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
})

const sg = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
})

const ch = StyleSheet.create({
  card: {
    backgroundColor: colors.bgChart,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
  },
})

const mp = StyleSheet.create({
  card:  { backgroundColor: colors.bgChart, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: spacing.radius, height: 160, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
})
