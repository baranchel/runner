import { useState, type ComponentProps } from 'react'
import { Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../../src/mockData'
import type { Run, Segment, Split } from '../../src/types'
import { fmtDateFull, fmtDistance, fmtDuration, fmtMMSS, fmtPace, parseMMSS } from '../../src/utils/format'
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

// ─── Edit Modal ──────────────────────────────────────────────────────────────

type EditFields = 'name' | 'distanceKm' | 'timeSec' | 'avgHr' | 'minHr' | 'maxHr' | 'elevGain'

// blank → null, otherwise a non-negative integer (NaN signals invalid)
function optInt(str: string): number | null {
  if (str.trim() === '') return null
  return /^\d+$/.test(str.trim()) ? Number(str) : NaN
}

function EditRunModal({ run, onClose, onSave }: {
  run: Run
  onClose: () => void
  onSave: (patch: Pick<Run, EditFields>) => void
}) {
  const [f, setF] = useState({
    name:     run.name,
    distance: String(run.distanceKm),
    time:     fmtMMSS(run.timeSec),
    avgHr:    run.avgHr?.toString() ?? '',
    minHr:    run.minHr?.toString() ?? '',
    maxHr:    run.maxHr?.toString() ?? '',
    elevGain: run.elevGain?.toString() ?? '',
  })
  const set = (k: keyof typeof f) => (v: string) => setF(prev => ({ ...prev, [k]: v }))

  const distanceKm = Number(f.distance.replace(',', '.'))
  const timeSec = parseMMSS(f.time)
  const ints = { avgHr: optInt(f.avgHr), minHr: optInt(f.minHr), maxHr: optInt(f.maxHr), elevGain: optInt(f.elevGain) }

  const error =
    f.name.trim() === '' ? 'Name is required'
    : !(distanceKm > 0) ? 'Distance must be a positive number'
    : !timeSec ? 'Time must be m:ss or h:mm:ss'
    : Object.values(ints).some(Number.isNaN) ? 'HR and elevation must be whole numbers'
    : null

  const field = (label: string, k: keyof typeof f, props: Partial<ComponentProps<typeof TextInput>> = {}) => (
    <View style={ed.field}>
      <Text style={ed.label}>{label}</Text>
      <TextInput
        style={ed.input}
        value={f[k]}
        onChangeText={set(k)}
        placeholderTextColor={colors.textGhost}
        {...props}
      />
    </View>
  )

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={ed.sheet} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={ed.bar}>
          <TouchableOpacity onPress={onClose}><Text style={ed.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={ed.title}>Edit Run</Text>
          <TouchableOpacity
            disabled={!!error}
            onPress={() => onSave({ name: f.name.trim(), distanceKm, timeSec: timeSec!, ...ints })}
          >
            <Text style={[ed.save, !!error && { opacity: 0.4 }]}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={ed.body} keyboardShouldPersistTaps="handled">
          {field('Name', 'name')}
          <View style={ed.row}>
            {field('Distance (km)', 'distance', { keyboardType: 'decimal-pad' })}
            {field('Time', 'time', { keyboardType: 'numbers-and-punctuation', placeholder: 'h:mm:ss' })}
          </View>
          <Text style={ed.pace}>
            Avg pace: {distanceKm > 0 && timeSec ? fmtPace(timeSec! / distanceKm, UNIT) : '—'}
          </Text>
          <View style={ed.row}>
            {field('Avg HR', 'avgHr', { keyboardType: 'number-pad', placeholder: '—' })}
            {field('Min HR', 'minHr', { keyboardType: 'number-pad', placeholder: '—' })}
            {field('Max HR', 'maxHr', { keyboardType: 'number-pad', placeholder: '—' })}
          </View>
          {field('Elevation gain (m)', 'elevGain', { keyboardType: 'number-pad', placeholder: '—' })}
          {error && <Text style={ed.error}>{error}</Text>}
          <Text style={ed.note}>Splits and charts keep the original recorded data.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RunDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [editing, setEditing] = useState(false)
  const [, rerender] = useState(0)
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
          <View style={{ flex: 1 }}>
            <Text style={s.headerType}>{run.name}</Text>
            <Text style={s.headerDate}>{type?.name ?? 'Unclassified'} · {fmtDateFull(run.date)}</Text>
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

      {/* floating edit button — pinned top-right, fixes bad HealthKit readings */}
      <TouchableOpacity onPress={() => setEditing(true)} style={[s.backFab, s.editFab, { top: insets.top + 12 }]} activeOpacity={0.7}>
        <Text style={s.editFabText}>Edit</Text>
      </TouchableOpacity>

      {editing && (
        <EditRunModal
          run={run}
          onClose={() => setEditing(false)}
          onSave={patch => {
            // ponytail: mutates the mock in place (visible app-wide on next render);
            // move to a runs store + SQLite overrides when src/store and src/db land
            Object.assign(run, patch)
            setEditing(false)
            rerender(n => n + 1)
          }}
        />
      )}
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

  editFab:     { left: undefined, right: spacing.screenH, width: undefined, paddingHorizontal: 16 },
  editFabText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.accent },

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

const ed = StyleSheet.create({
  sheet:  { flex: 1, backgroundColor: colors.bgApp },
  bar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.screenH, borderBottomWidth: 1, borderColor: colors.borderDefault },
  title:  { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cancel: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted },
  save:   { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.accent },
  body:   { padding: spacing.screenH, gap: 14 },
  row:    { flexDirection: 'row', gap: 10 },
  field:  { flex: 1, gap: 6 },
  label:  { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  input:  {
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14, color: colors.textPrimary, fontFamily: fonts.mono, fontSize: 15,
  },
  pace:   { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
  error:  { fontFamily: fonts.body, fontSize: 13, color: colors.danger },
  note:   { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
})

const mp = StyleSheet.create({
  card:  { backgroundColor: colors.bgChart, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: spacing.radius, height: 160, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
})
