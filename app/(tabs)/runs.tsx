import { ActionSheetIOS, Alert, Image, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { RunCard } from '../../src/components/RunCard'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../../src/mockData'
import type { Run } from '../../src/types'
import { fmtDate, fmtDistance, fmtDuration } from '../../src/utils/format'
import { colors, fonts, runTypeColor } from '../../src/utils/tokens'

// ponytail: hardcoded until useUserStore lands; replace with store selector
const UNIT: 'km' | 'mi' = 'km'
const TYPE_MAP = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))
const BAR_SPACE = 76 // extra list bottom padding while the compare bar is showing

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

type SortKey = 'newest' | 'distance' | 'time'
const SORTS: { key: SortKey; label: string; cmp: (a: Run, b: Run) => number }[] = [
  { key: 'newest',   label: 'Newest',   cmp: (a, b) => b.date.localeCompare(a.date) },
  { key: 'distance', label: 'Distance', cmp: (a, b) => b.distanceKm - a.distanceKm },
  { key: 'time',     label: 'Time',     cmp: (a, b) => b.timeSec - a.timeSec },
]

type SectionStats = { runCount: number; totalDistanceKm: number; totalTimeSec: number }

type RunSection = {
  key: string
  title: string
  allStats: SectionStats
  filteredStats: SectionStats | null
  data: Run[]
}

function computeStats(runs: Run[]): SectionStats {
  return {
    runCount: runs.length,
    totalDistanceKm: runs.reduce((s, r) => s + r.distanceKm, 0),
    totalTimeSec: runs.reduce((s, r) => s + r.timeSec, 0),
  }
}

function buildSections(runs: Run[], selectedTypeId: string | null, sort: SortKey): RunSection[] {
  // group by 'YYYY-MM'
  const groups = new Map<string, Run[]>()
  for (const run of runs) {
    const key = run.date.slice(0, 7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(run)
  }

  const cmp = SORTS.find(x => x.key === sort)!.cmp
  const sections: RunSection[] = []
  // months always newest first; sort applies within each month
  for (const key of [...groups.keys()].sort((a, b) => b.localeCompare(a))) {
    const monthRuns = groups.get(key)!
    const filteredRuns = selectedTypeId ? monthRuns.filter(r => r.typeId === selectedTypeId) : monthRuns

    // skip month entirely if filter active and no matching runs
    if (selectedTypeId && filteredRuns.length === 0) continue

    const [year, month] = key.split('-').map(Number)
    sections.push({
      key,
      title: `${MONTH_NAMES[month - 1]} ${year}`,
      allStats: computeStats(monthRuns),
      filteredStats: selectedTypeId ? computeStats(filteredRuns) : null,
      data: [...filteredRuns].sort(cmp),
    })
  }
  return sections
}

function fmtStats(stats: SectionStats): string {
  return `${stats.runCount} runs · ${fmtDistance(stats.totalDistanceKm, UNIT)} · ${fmtDuration(stats.totalTimeSec)}`
}

function MonthHeader({ section, selectedTypeId }: { section: RunSection; selectedTypeId: string | null }) {
  const filteredType = selectedTypeId ? (TYPE_MAP[selectedTypeId] ?? null) : null
  return (
    <View style={s.monthHeader}>
      <View style={s.rowBetween}>
        <Text style={s.monthTitle}>{section.title}</Text>
        <Text style={s.monthStats}>{fmtStats(section.allStats)}</Text>
      </View>
      {section.filteredStats && filteredType && (
        <View style={s.filteredRow}>
          <View style={[s.dot, { backgroundColor: runTypeColor(filteredType.hue) }]} />
          <Text style={[s.filteredLabel, { color: runTypeColor(filteredType.hue) }]}>{filteredType.name}</Text>
          <Text style={s.monthStats}>{fmtStats(section.filteredStats)}</Text>
        </View>
      )}
    </View>
  )
}

// Native iOS picker sheet — no dropdown component needed
function pick(title: string, labels: string[], onPick: (i: number) => void) {
  ActionSheetIOS.showActionSheetWithOptions(
    { title, options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
    i => { if (i < labels.length) onPick(i) },
  )
}

function FilterPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.pill} onPress={onPress}>
      <Text style={s.pillText}>{label}</Text>
      <Text style={s.pillChevron}>▾</Text>
    </TouchableOpacity>
  )
}

export default function Runs() {
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('newest')
  const sections = buildSections(MOCK_RUNS, selectedTypeId, sort)

  const router = useRouter()
  const { select } = useLocalSearchParams<{ select?: string }>()
  // Compare selection lives here; tab screens stay mounted, so it persists until ✕ or icon re-tap.
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Arriving from Run Detail's "Choose from all runs": start fresh with that run checked.
  useEffect(() => {
    if (!select) return
    setSelecting(true)
    setSelectedIds([select])
    router.setParams({ select: undefined })
  }, [select])

  function exitSelection() {
    setSelecting(false)
    setSelectedIds([])
  }

  function onPressRun(run: Run) {
    if (!selecting) {
      router.push(`/run/${run.id}`)
      return
    }
    if (selectedIds.includes(run.id)) {
      setSelectedIds(ids => ids.filter(id => id !== run.id))
      return
    }
    if (selectedIds.length >= 2) {
      Alert.alert('You can compare only 2 runs. Uncheck one first.')
      return
    }
    // guard inside the updater too: two fast taps before a re-render can't add a dup or a 3rd run
    setSelectedIds(ids => (ids.includes(run.id) || ids.length >= 2 ? ids : [...ids, run.id]))
  }

  // older run first → A, newer → B
  const pair = selectedIds.length === 2
    ? selectedIds
        .map(id => MOCK_RUNS.find(r => r.id === id))
        .filter((r): r is Run => r !== undefined)
        .sort((x, y) => x.date.localeCompare(y.date))
    : null

  const typeLabel = selectedTypeId ? TYPE_MAP[selectedTypeId]?.name ?? 'All types' : 'All types'
  const sortLabel = SORTS.find(x => x.key === sort)!.label

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.top}>
        <Text style={s.title}>All runs</Text>

        <View style={s.searchRow}>
          {/* Placeholder — search lands with RA-35 */}
          <View style={s.search}>
            <Text style={s.searchText}>Search your runs</Text>
          </View>
          {/* Figma "+" slot → compare-mode toggle */}
          <TouchableOpacity
            style={[s.reserved, selecting && s.reservedOn]}
            onPress={() => (selecting ? exitSelection() : setSelecting(true))}
          >
            <Image
              source={require('../../assets/compare.png')}
              style={[s.compareIcon, { tintColor: selecting ? colors.ink : colors.textPrimary }]}
            />
          </TouchableOpacity>
        </View>

        <View style={s.filters}>
          <FilterPill
            label={typeLabel}
            onPress={() => pick('Run type', ['All types', ...MOCK_RUN_TYPES.map(t => t.name)],
              i => setSelectedTypeId(i === 0 ? null : MOCK_RUN_TYPES[i - 1].id))}
          />
          <FilterPill
            label={sortLabel}
            onPress={() => pick('Sort by', SORTS.map(x => x.label), i => setSort(SORTS[i].key))}
          />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={run => run.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <MonthHeader section={section as RunSection} selectedTypeId={selectedTypeId} />
        )}
        renderSectionFooter={() => <View style={{ height: 14 }} />}
        extraData={[selecting, selectedIds]}
        renderItem={({ item }) => (
          <RunCard
            run={item}
            unit={UNIT}
            checked={selecting ? selectedIds.includes(item.id) : undefined}
            onPress={() => onPressRun(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={[s.listContent, pair && { paddingBottom: 32 + BAR_SPACE }]}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>No runs match this filter.</Text>
          </View>
        }
      />

      {pair && pair.length === 2 && (
        <View style={s.bar}>
          <Text style={s.barText} numberOfLines={1}>
            {fmtDate(pair[0].date)} vs {fmtDate(pair[1].date)}
          </Text>
          <TouchableOpacity
            style={s.barBtn}
            onPress={() => router.push({ pathname: '/compare/result', params: { a: pair[0].id, b: pair[1].id } })}
          >
            <Text style={s.barBtnText}>Compare ›</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={exitSelection} hitSlop={8}>
            <Text style={s.barClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bgApp },
  top:         { paddingHorizontal: 24, paddingTop: 14, gap: 16, paddingBottom: 6 },
  title:       { fontFamily: fonts.body, fontSize: 25, fontWeight: '600', color: colors.textPrimary },

  searchRow:   { flexDirection: 'row', gap: 12 },
  search:      { flex: 1, height: 44, borderRadius: 15, backgroundColor: colors.bgSurface, justifyContent: 'center', paddingHorizontal: 16 },
  searchText:  { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, opacity: 0.8 },
  reserved:    { width: 46, height: 44, borderRadius: 15, backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  reservedOn:  { backgroundColor: colors.lime },
  compareIcon: { width: 20, height: 20 },

  bar:        { position: 'absolute', left: 24, right: 24, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: colors.bgElevated, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14,
                shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  barText:    { flex: 1, fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  barBtn:     { backgroundColor: colors.lime, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  barBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.ink },
  barClose:   { fontFamily: fonts.body, fontSize: 18, color: colors.textSecondary },

  filters:     { flexDirection: 'row', gap: 10 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 8, height: 34, borderRadius: 17, paddingHorizontal: 13, backgroundColor: colors.bgSurface },
  pillText:    { fontFamily: fonts.body, fontSize: 11, fontWeight: '500', color: colors.textPrimary },
  pillChevron: { fontSize: 10, color: colors.textPrimary },

  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  monthHeader: { backgroundColor: colors.bgApp, paddingTop: 16, paddingBottom: 12, gap: 6 },
  rowBetween:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthTitle:  { fontFamily: fonts.body, fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  monthStats:  { fontFamily: fonts.mono, fontSize: 10, fontWeight: '500', color: colors.textSecondary, flexShrink: 1 },
  filteredRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  filteredLabel: { fontFamily: fonts.body, fontSize: 10, fontWeight: '600' },

  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyText:   { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
})
