import { useState, type ComponentProps } from 'react'
import { FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { RunCard } from '../../src/components/RunCard'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRunStore } from '../../src/store/useRunStore'
import { useTypeMap } from '../../src/store/useRunTypeStore'
import type { EditFields, Run, RunEdits, Segment, Split } from '../../src/types'
import { fmtDateFull, fmtDistance, fmtDuration, fmtMMSS, fmtPace, parseMMSS } from '../../src/utils/format'
import { buttons, colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'
import { computePrimaryZone } from '../../src/utils/zones'
import { Chart, HrRangeBarsChart, PaceBarsChart } from '../../src/components/Chart'
import type { PaceBar, PaceKind } from '../../src/components/Chart'
import { SplitsTable, tableStyles as st } from '../../src/components/SplitsTable'
import { SegmentsTable } from '../../src/components/SegmentsTable'
import { hrSeries } from '../../src/utils/chart'

const UNIT = 'km' as const

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

// ─── Hero ────────────────────────────────────────────────────────────────────

const ICONS = {
  distance:  require('../../assets/distance.png'),
  time:      require('../../assets/time.png'),
  pace:      require('../../assets/pace.png'),
  hr:        require('../../assets/heart-rate.png'),
  elevation: require('../../assets/elevation.png'),
  calories:  require('../../assets/calories.png'),
  weather:   require('../../assets/weather.png'),
}

// lavender card: big distance + the three headline stats (Dashboard week-card style)
function Hero({ run, unit }: { run: Run; unit: 'km' | 'mi' }) {
  const [num, unitLabel] = fmtDistance(run.distanceKm, unit).split(' ')
  const stats = [
    { icon: ICONS.time, label: 'Time',     value: fmtMMSS(run.timeSec) },
    { icon: ICONS.pace, label: 'Avg pace', value: fmtPace(run.timeSec / run.distanceKm, unit) },
    { icon: ICONS.hr,   label: 'Avg HR',   value: run.avgHr != null ? `${run.avgHr} bpm` : '—' },
  ]
  return (
    <View style={hero.card}>
      <View style={hero.labelRow}>
        <Image source={ICONS.distance} style={hero.icon} />
        <Text style={hero.label}>DISTANCE</Text>
      </View>
      <View style={hero.bigRow}>
        <Text style={hero.big}>{num}</Text>
        <Text style={hero.unit}>{unitLabel}</Text>
      </View>
      <View style={hero.stats}>
        {stats.map(st => (
          <View key={st.label} style={hero.stat}>
            <View style={hero.labelRow}>
              <Image source={st.icon} style={hero.icon} />
              <Text style={hero.statLabel}>{st.label}</Text>
            </View>
            <Text style={hero.statValue}>{st.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ─── Stat Grid ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: ReturnType<typeof require>
  label: string
  value: string
  sub?: string
}

function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <View style={s.statCard}>
      <View style={s.statLabelRow}>
        <Image source={icon} style={s.statIcon} />
        <Text style={s.statLabel}>{label}</Text>
      </View>
      <Text style={s.statValue}>{value}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  )
}

function StatGrid({ run, unit }: { run: Run; unit: 'km' | 'mi' }) {
  const paceRange = getPaceRange(run.splits)
  const zone = computePrimaryZone(run)
  const cards: StatCardProps[] = [
    {
      icon: ICONS.pace, label: 'PACE RANGE',
      value: paceRange ? `${fmtMMSS(paceRange.fastest)}–${fmtMMSS(paceRange.slowest)}` : '—',
      sub: unit === 'km' ? 'min/km' : 'min/mi',
    },
    {
      icon: ICONS.hr, label: 'HR RANGE',
      value: run.minHr != null && run.maxHr != null ? `${run.minHr}–${run.maxHr}` : '—',
      sub: 'bpm',
    },
    { icon: ICONS.elevation, label: 'ELEVATION', value: run.elevGain != null ? `${run.elevGain} m` : '—' },
    { icon: ICONS.calories,  label: 'CALORIES',  value: run.calories != null ? `${run.calories} kcal` : '—' },
    {
      icon: ICONS.weather, label: 'WEATHER',
      value: run.weather != null ? `${run.weather.tempC}°C` : '—',
      sub: run.weather != null ? `Humidity ${run.weather.humidity}%` : undefined,
    },
    {
      icon: ICONS.hr, label: 'PRIMARY ZONE',
      value: zone ? `Zone ${zone.zone}` : '—',
      sub: zone ? `${zone.name} · ${Math.round(zone.timeSec / 60)}m` : undefined,
    },
  ]
  return (
    <View style={s.grid}>
      {cards.map(c => <StatCard key={c.label} {...c} />)}
    </View>
  )
}

// fastest full km — placeholder for RA-36 (Run Insights)
function fastestKm(splits: Split[]): { km: number; pace: number } | null {
  let best: { km: number; pace: number } | null = null
  let prevKm = 0
  splits.forEach((sp, i) => {
    const len = sp.km - prevKm
    prevKm = sp.km
    if (len < 0.99) return // skip a partial last split
    const pace = sp.timeSec / len
    if (!best || pace < best.pace) best = { km: i + 1, pace }
  })
  return best
}

function SectionTitle({ title, link, onPress }: { title: string; link?: string; onPress?: () => void }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {link && (
        <TouchableOpacity style={s.linkPill} onPress={onPress} hitSlop={6}>
          <Text style={s.linkText}>{link} →</Text>
        </TouchableOpacity>
      )}
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
        <SectionTitle title="Pace" />
        <View style={ch.card}>
          <PaceBarsChart
            bars={paceBars}
            avgPace={avgPace}
            unit={unit}
          />
        </View>
      </View>
      <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}/zones`)}>
        <SectionTitle title="Heart rate" link="Zones" onPress={() => router.push(`/run/${run.id}/zones`)} />
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
      <SectionTitle title="Structure" link="See all" onPress={() => router.push(`/run/${run.id}/segments`)} />
      <SegmentsTable run={run} typeColor={typeColor} unit={unit} limit={5} />
    </TouchableOpacity>
  )
}

// ─── Map Placeholder ─────────────────────────────────────────────────────────

function MapPlaceholder() {
  return (
    <View>
      <SectionTitle title="Map" />
      <View style={mp.card}>
        <Text style={mp.label}>Map coming in Phase 3</Text>
      </View>
    </View>
  )
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

// blank → null, otherwise a non-negative integer (NaN signals invalid)
function optInt(str: string): number | null {
  if (str.trim() === '') return null
  return /^\d+$/.test(str.trim()) ? Number(str) : NaN
}

// Run field → the modal's text field it comes from
const FORM_KEY = {
  name: 'name', distanceKm: 'distance', timeSec: 'time',
  avgHr: 'avgHr', minHr: 'minHr', maxHr: 'maxHr', elevGain: 'elevGain',
} as const satisfies Record<EditFields, string>

function EditRunModal({ run, onClose, onSave }: {
  run: Run
  onClose: () => void
  onSave: (patch: RunEdits) => void
}) {
  const prefill = {
    name:     run.name,
    distance: String(run.distanceKm),
    time:     fmtMMSS(run.timeSec),
    avgHr:    run.avgHr?.toString() ?? '',
    minHr:    run.minHr?.toString() ?? '',
    maxHr:    run.maxHr?.toString() ?? '',
    elevGain: run.elevGain?.toString() ?? '',
  }
  const [start] = useState(prefill)  // what the user saw when the modal opened
  const [f, setF] = useState(prefill)
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
            onPress={() => {
              // send only fields the user touched: the text round-trip (rounded time, trimmed name)
              // must not turn untouched HealthKit values into edits
              const all: RunEdits = { name: f.name.trim(), distanceKm, timeSec: timeSec!, ...ints }
              onSave(Object.fromEntries(Object.entries(all)
                .filter(([k]) => f[FORM_KEY[k as EditFields]] !== start[FORM_KEY[k as EditFields]])) as RunEdits)
            }}
          >
            <View style={[buttons.primary, !!error && { opacity: 0.4 }]}><Text style={buttons.primaryText}>Save</Text></View>
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

// ─── Compare Sheet ───────────────────────────────────────────────────────────

function CompareSheet({ run, visible, onClose }: { run: Run; visible: boolean; onClose: () => void }) {
  const router = useRouter()
  const typeMap = useTypeMap()
  const runs = useRunStore(s => s.runs)
  const typeName = run.typeId ? (typeMap[run.typeId]?.name ?? 'Unclassified') : 'unclassified'
  const others = runs
    .filter(r => r.id !== run.id && r.typeId === run.typeId)
    .sort((x, y) => y.date.localeCompare(x.date))

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={cs.sheet}>
        <View style={cs.header}>
          <Text style={cs.title}>Compare with…</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={cs.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={others}
          keyExtractor={r => r.id}
          contentContainerStyle={cs.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <RunCard
              run={item}
              unit={UNIT}
              onPress={() => {
                onClose()
                router.push({ pathname: '/compare/result', params: { a: run.id, b: item.id } })
              }}
            />
          )}
          ListEmptyComponent={<Text style={cs.empty}>No other {typeName} runs</Text>}
        />
        <TouchableOpacity
          style={cs.allRow}
          activeOpacity={0.7}
          onPress={() => {
            onClose()
            router.navigate({ pathname: '/runs', params: { select: run.id } })
          }}
        >
          <Text style={cs.allText}>Choose from all runs</Text>
          <Text style={cs.allChevron}>›</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RunDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [editing, setEditing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const run = useRunStore(s => s.runs.find(r => r.id === id))
  const editRun = useRunStore(s => s.editRun)
  const typeMap = useTypeMap()

  if (!run) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Text style={s.notFound}>Run not found</Text>
      </SafeAreaView>
    )
  }

  const type = run.typeId ? typeMap[run.typeId] : null
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost
  const fast = fastestKm(run.splits)

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* disable swipe-back so scrubbing the HR chart doesn't pop the screen;
          the ‹ Back button remains the way out */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ScrollView contentContainerStyle={s.content}>
        {/* header */}
        <View style={s.header}>
          <View style={s.kickerRow}>
            <View style={[s.typeDot, { backgroundColor: typeColor }]} />
            <Text style={s.kicker}>{(type?.name ?? 'Unclassified').toUpperCase()} · {fmtDateFull(run.date).toUpperCase()}</Text>
          </View>
          <Text style={s.title}>{run.name}</Text>
          <Text style={s.source}>Synced from {SOURCE_LABEL[run.source] ?? run.source}</Text>
        </View>

        {/* summary */}
        <View style={s.summary}>
          <Hero run={run} unit={UNIT} />
          <StatGrid run={run} unit={UNIT} />
          {fast && (
            <View style={s.lime}>
              <Text style={s.limeText}>Fastest km: km {fast.km} · {fmtPace(fast.pace, UNIT)}</Text>
            </View>
          )}
        </View>

        {/* splits — tap to open the full splits screen */}
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/run/${run.id}/splits`)}>
          <SectionTitle title="Splits" link="See all" onPress={() => router.push(`/run/${run.id}/splits`)} />
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

      {/* top-right floating actions: compare with another run, edit bad HealthKit readings */}
      <View style={[s.fabRow, { top: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => setSheetOpen(true)} style={[s.backFab, s.fabInRow]} activeOpacity={0.7}>
          <Image source={require('../../assets/compare.png')} style={s.compareFabIcon} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEditing(true)} style={[s.backFab, s.fabInRow, s.editFab]} activeOpacity={0.7}>
          <Text style={s.editFabText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <CompareSheet run={run} visible={sheetOpen} onClose={() => setSheetOpen(false)} />

      {editing && (
        <EditRunModal
          run={run}
          onClose={() => setEditing(false)}
          onSave={patch => {
            editRun(run.id, patch)
            setEditing(false)
          }}
        />
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: 24, paddingTop: 72, paddingBottom: 32, gap: 26 },

  // floating buttons: rounded squares like the All runs compare button
  backFab: {
    position: 'absolute',
    left: 24,
    width: 46,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
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
  fabRow:         { position: 'absolute', right: 24, flexDirection: 'row', gap: 10, zIndex: 10 },
  fabInRow:       { position: 'relative', left: undefined },
  compareFabIcon: { width: 20, height: 20, tintColor: colors.textPrimary },

  editFab:     { width: undefined, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.lime },
  editFabText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.lime },

  header:    { gap: 6 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeDot:   { width: 8, height: 8, borderRadius: 4 },
  kicker:    { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.3 },
  title:     { fontFamily: fonts.body, fontSize: 25, fontWeight: '600', color: colors.textPrimary },
  source:    { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },

  summary: { gap: 10 },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.bgSurface, borderRadius: 18, padding: 14, gap: 6 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIcon:  { width: 13, height: 13, tintColor: colors.textPrimary },
  statLabel: { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.3 },
  statValue: { fontFamily: fonts.mono, fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  statSub:   { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: -2 },

  lime:     { backgroundColor: colors.lime, borderRadius: 17, paddingVertical: 15, paddingHorizontal: 17 },
  limeText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.ink },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.body, fontSize: 19, fontWeight: '600', color: colors.textPrimary },
  linkPill:     buttons.outline,
  linkText:     buttons.outlineText,

  notFound: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
})

// lavender hero, ink on lavender (Dashboard week-card language)
const hero = StyleSheet.create({
  card:      { backgroundColor: colors.accent, borderRadius: 26, padding: 22 },
  labelRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon:      { width: 13, height: 13, tintColor: colors.ink },
  label:     { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.ink, letterSpacing: 0.3 },
  bigRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  big:       { fontFamily: fonts.mono, fontSize: 56, fontWeight: '600', color: colors.ink },
  unit:      { fontFamily: fonts.body, fontSize: 16, fontWeight: '600', color: colors.ink },
  stats:     { flexDirection: 'row', marginTop: 14, gap: 8 },
  stat:      { flex: 1, gap: 4 },
  statLabel: { fontFamily: fonts.body, fontSize: 10, fontWeight: '500', color: colors.ink, opacity: 0.8 },
  statValue: { fontFamily: fonts.mono, fontSize: 16, fontWeight: '600', color: colors.ink },
})

const ch = StyleSheet.create({
  card: { backgroundColor: colors.bgSurface, borderRadius: 18, overflow: 'hidden' },
})

const ed = StyleSheet.create({
  sheet:  { flex: 1, backgroundColor: colors.bgApp },
  bar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.screenH, borderBottomWidth: 1, borderColor: colors.borderDefault },
  title:  { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  cancel: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted },
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
  card:  { backgroundColor: colors.bgSurface, borderRadius: 18, height: 160, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
})

const cs = StyleSheet.create({
  sheet:  { flex: 1, backgroundColor: colors.bgApp },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH,
    paddingVertical: 16,
  },
  title: { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  close: { fontFamily: fonts.body, fontSize: 18, color: colors.textSecondary },
  list:  { paddingHorizontal: spacing.screenH, paddingBottom: 16 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.screenH,
    marginBottom: 32,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.lime,
    borderRadius: 18,
  },
  allText:    { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.lime },
  allChevron: { fontFamily: fonts.body, fontSize: 18, color: colors.lime },
})
