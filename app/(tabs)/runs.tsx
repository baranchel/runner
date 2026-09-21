import { SectionList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { MOCK_RUNS, MOCK_RUN_TYPES } from '../../src/mockData'
import type { Run } from '../../src/types'
import { fmtDate, fmtDistance, fmtDuration, fmtPace } from '../../src/utils/format'
import { colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'

// ponytail: hardcoded until useUserStore lands; replace with store selector
const UNIT: 'km' | 'mi' = 'km'
const TYPE_MAP = Object.fromEntries(MOCK_RUN_TYPES.map(t => [t.id, t]))

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

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

function buildSections(runs: Run[], selectedTypeId: string | null): RunSection[] {
  // group by 'YYYY-MM'
  const groups = new Map<string, Run[]>()
  for (const run of runs) {
    const key = run.date.slice(0, 7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(run)
  }

  // sort months newest first
  const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a))

  const sections: RunSection[] = []
  for (const key of sortedKeys) {
    const monthRuns = groups.get(key)!.sort((a, b) => b.date.localeCompare(a.date))
    const filteredRuns = selectedTypeId
      ? monthRuns.filter(r => r.typeId === selectedTypeId)
      : monthRuns

    // skip month entirely if filter active and no matching runs
    if (selectedTypeId && filteredRuns.length === 0) continue

    const [year, month] = key.split('-').map(Number)
    sections.push({
      key,
      title: `${MONTH_NAMES[month - 1].toUpperCase()} ${year}`,
      allStats: computeStats(monthRuns),
      filteredStats: selectedTypeId ? computeStats(filteredRuns) : null,
      data: filteredRuns,
    })
  }
  return sections
}

function fmtStats(stats: SectionStats): string {
  const dist = fmtDistance(stats.totalDistanceKm, UNIT)
  const time = fmtDuration(stats.totalTimeSec)
  return `${stats.runCount} runs · ${dist} · ${time}`
}

function MonthHeader({ section, selectedTypeId }: { section: RunSection; selectedTypeId: string | null }) {
  const filteredType = selectedTypeId ? (TYPE_MAP[selectedTypeId] ?? null) : null
  const typeColor = filteredType ? runTypeColor(filteredType.hue) : colors.textGhost

  return (
    <View style={mh.container}>
      <Text style={mh.title}>{section.title}</Text>
      <View style={mh.row}>
        <Text style={mh.label}>All runs</Text>
        <Text style={mh.stats}>{fmtStats(section.allStats)}</Text>
      </View>
      {section.filteredStats && filteredType && (
        <View style={mh.row}>
          <View style={[mh.dot, { backgroundColor: typeColor }]} />
          <Text style={[mh.label, { color: typeColor }]}>{filteredType.name}</Text>
          <Text style={mh.stats}>{fmtStats(section.filteredStats)}</Text>
        </View>
      )}
    </View>
  )
}

const mh = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.screenH,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  title: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 2,
  },
  stats: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
  },
})

function RunRow({ run }: { run: Run }) {
  const router = useRouter()
  const type = run.typeId ? TYPE_MAP[run.typeId] : undefined
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost

  const pace = run.timeSec / run.distanceKm
  return (
    <TouchableOpacity style={rr.card} onPress={() => router.push(`/run/${run.id}`)}>
      <View style={[rr.bar, { backgroundColor: typeColor }]} />
      <View style={rr.center}>
        <Text style={rr.typeName}>{type?.name ?? 'Unclassified'}</Text>
        <Text style={rr.date}>{fmtDate(run.date)}</Text>
        <Text style={rr.meta}>
          {fmtDistance(run.distanceKm, UNIT)} · {fmtPace(pace, UNIT)} · {fmtDuration(run.timeSec)}
        </Text>
      </View>
      <Text style={rr.chevron}>›</Text>
    </TouchableOpacity>
  )
}

const rr = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 12,
    gap: 12,
  },
  bar:      { width: 8, height: 36, borderRadius: 4 },
  center:   { flex: 1, gap: 2 },
  typeName: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  date:     { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  meta:     { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  chevron:  { fontFamily: fonts.body, fontSize: 18, color: colors.textGhost },
})

function TypeFilterBar({
  selectedTypeId,
  onSelect,
}: {
  selectedTypeId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <View style={tf.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tf.row}>
        <TouchableOpacity
          style={[tf.chip, selectedTypeId === null && tf.chipActive]}
          onPress={() => onSelect(null)}
        >
          <Text style={[tf.chipText, selectedTypeId === null && tf.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {MOCK_RUN_TYPES.map(type => {
          const active = selectedTypeId === type.id
          const typeColor = runTypeColor(type.hue)
          return (
            <TouchableOpacity
              key={type.id}
              style={[
                tf.chip,
                active && { backgroundColor: typeColor + '40', borderColor: typeColor + '80' },
              ]}
              onPress={() => onSelect(active ? null : type.id)}
            >
              <Text style={[tf.chipText, active && { color: typeColor }]}>{type.name}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const tf = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenH,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderFocus,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: 'transparent',
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
})

export default function Runs() {
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const sections = buildSections(MOCK_RUNS, selectedTypeId)

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <TypeFilterBar selectedTypeId={selectedTypeId} onSelect={setSelectedTypeId} />
      <SectionList
        sections={sections}
        keyExtractor={run => run.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <MonthHeader section={section as RunSection} selectedTypeId={selectedTypeId} />
        )}
        renderSectionFooter={() => <View style={{ height: 16 }} />}
        renderItem={({ item }) => (
          <View style={s.itemWrap}>
            <RunRow run={item} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>No runs match this filter.</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bgApp },
  listContent: { paddingBottom: 32 },
  itemWrap:    { paddingHorizontal: spacing.screenH, paddingTop: 10 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText:   { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
})
