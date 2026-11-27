import { Fragment, useState } from 'react'
import { ActionSheetIOS, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { RunCard } from './RunCard'
import { useRunStore } from '../store/useRunStore'
import { useRunTypeStore, useTypeMap } from '../store/useRunTypeStore'
import type { Run } from '../types'
import { fmtDistance, fmtDuration } from '../utils/format'
import { buttons, colors, fonts, runTypeColor, zoneColor } from '../utils/tokens'
import { useZoneStarts } from '../store/useProfileStore'
import { sumZoneTimes, topZones, type HrHist } from '../utils/zones'

// Shared month-grouped run list pieces — used by All runs and the compare run picker.

// ponytail: hardcoded until useUserStore lands; replace with store selector
const UNIT: 'km' | 'mi' = 'km'

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

export type SortKey = 'newest' | 'distance' | 'time'
export const SORTS: { key: SortKey; label: string; cmp: (a: Run, b: Run) => number }[] = [
  { key: 'newest',   label: 'Newest',   cmp: (a, b) => b.date.localeCompare(a.date) },
  { key: 'distance', label: 'Distance', cmp: (a, b) => b.distanceKm - a.distanceKm },
  { key: 'time',     label: 'Time',     cmp: (a, b) => b.timeSec - a.timeSec },
]

/** Type-filter value for runs with no type (null already means "All types"). */
export const UNCLASSIFIED = 'unclassified'
export const matchesType = (r: Run, filterId: string) => (filterId === UNCLASSIFIED ? r.typeId === null : r.typeId === filterId)

type SectionStats = { runCount: number; totalDistanceKm: number; totalTimeSec: number }

export type RunSection = {
  key: string
  title: string
  allStats: SectionStats
  filteredStats: SectionStats | null
  data: Run[]
  /** RA-22: HR histograms of the runs shown (after the type filter) → header zone line */
  zoneHists: (HrHist | null)[]
}

function computeStats(runs: Run[]): SectionStats {
  return {
    runCount: runs.length,
    totalDistanceKm: runs.reduce((s, r) => s + r.distanceKm, 0),
    totalTimeSec: runs.reduce((s, r) => s + r.timeSec, 0),
  }
}

export function buildSections(runs: Run[], selectedTypeId: string | null, sort: SortKey = 'newest'): RunSection[] {
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
    const filteredRuns = selectedTypeId ? monthRuns.filter(r => matchesType(r, selectedTypeId)) : monthRuns

    // skip month entirely if filter active and no matching runs
    if (selectedTypeId && filteredRuns.length === 0) continue

    const [year, month] = key.split('-').map(Number)
    sections.push({
      key,
      title: `${MONTH_NAMES[month - 1]} ${year}`,
      allStats: computeStats(monthRuns),
      filteredStats: selectedTypeId ? computeStats(filteredRuns) : null,
      data: [...filteredRuns].sort(cmp),
      zoneHists: filteredRuns.map(r => r.hrHist),
    })
  }
  return sections
}

function fmtStats(stats: SectionStats): string {
  return `${stats.runCount} runs · ${fmtDistance(stats.totalDistanceKm, UNIT)} · ${fmtDuration(stats.totalTimeSec)}`
}

export function MonthHeader({ section, selectedTypeId }: { section: RunSection; selectedTypeId: string | null }) {
  const typeMap = useTypeMap()
  const starts = useZoneStarts()
  const zsec = sumZoneTimes(section.zoneHists, starts)
  const top = zsec ? topZones(zsec) : []
  const t = selectedTypeId && selectedTypeId !== UNCLASSIFIED ? typeMap[selectedTypeId] : null
  const filtered = selectedTypeId === UNCLASSIFIED ? { name: 'Unclassified', color: colors.textGhost }
    : t ? { name: t.name, color: runTypeColor(t.hue) } : null
  return (
    <View style={s.monthHeader}>
      <View style={s.rowBetween}>
        <Text style={s.monthTitle}>{section.title}</Text>
        <Text style={s.monthStats}>{fmtStats(section.allStats)}</Text>
      </View>
      {section.filteredStats && filtered && (
        <View style={s.filteredRow}>
          <View style={[s.dot, { backgroundColor: filtered.color }]} />
          <Text style={[s.filteredLabel, { color: filtered.color }]}>{filtered.name}</Text>
          <Text style={s.monthStats}>{fmtStats(section.filteredStats)}</Text>
        </View>
      )}
      {top.length > 0 && (
        <View style={s.filteredRow}>
          {top.map((z, k) => (
            <Fragment key={z.zone}>
              {k > 0 && <Text style={s.monthStats}>·</Text>}
              <View style={[s.dot, { backgroundColor: zoneColor(z.zone - 1) }]} />
              <Text style={s.monthStats}>Z{z.zone} {z.pct}%</Text>
            </Fragment>
          ))}
        </View>
      )}
    </View>
  )
}

// Native iOS picker sheet — no dropdown component needed
export function pick(title: string, labels: string[], onPick: (i: number) => void) {
  ActionSheetIOS.showActionSheetWithOptions(
    { title, options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
    i => { if (i < labels.length) onPick(i) },
  )
}

export function FilterPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.pill} onPress={onPress}>
      <Text style={s.pillText}>{label}</Text>
      <Text style={s.pillChevron}>▾</Text>
    </TouchableOpacity>
  )
}

export function pickType(onPick: (typeId: string | null) => void) {
  const types = useRunTypeStore.getState().types
  pick('Run type', ['All types', 'Unclassified', ...types.map(t => t.name)],
    i => onPick(i === 0 ? null : i === 1 ? UNCLASSIFIED : types[i - 2].id))
}

export function typeLabel(typeId: string | null) {
  if (!typeId) return 'All types'
  if (typeId === UNCLASSIFIED) return 'Unclassified'
  return useRunTypeStore.getState().typeMap[typeId]?.name ?? 'All types'
}

/** RA-39 run-type picker (pill, Dashboard card, bulk; RA-15 "Change"). current undefined = no ✓ (bulk). */
export function pickRunType(title: string, current: string | null | undefined, onPick: (typeId: string | null) => void) {
  const types = useRunTypeStore.getState().types
  const ids: (string | null)[] = [null, ...types.map(t => t.id)]
  const names = ['Unclassified', ...types.map(t => t.name)]
  pick(title, names.map((n, i) => (ids[i] === current ? `✓ ${n}` : n)), i => onPick(ids[i]))
}

// Picker list for choosing a run (compare). disabledIds = runs that can't be picked.
export function RunPickerList({ onPressRun, disabledIds = [] }: {
  onPressRun: (run: Run) => void
  disabledIds?: string[]
}) {
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const runs = useRunStore(s => s.runs)
  const sections = buildSections(runs, selectedTypeId)

  return (
    <View style={s.flex}>
      <View style={s.filters}>
        <FilterPill label={typeLabel(selectedTypeId)} onPress={() => pickType(setSelectedTypeId)} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={run => run.id}
        extraData={disabledIds}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <MonthHeader section={section as RunSection} selectedTypeId={selectedTypeId} />
        )}
        renderSectionFooter={() => <View style={{ height: 14 }} />}
        renderItem={({ item }) => (
          <RunCard run={item} unit={UNIT} onPress={() => onPressRun(item)} disabled={disabledIds.includes(item.id)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>No runs match this filter.</Text>
          </View>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  flex:        { flex: 1 },
  filters:     { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingBottom: 6 },
  pill:        { ...buttons.outline, flexDirection: 'row', gap: 8, height: 34, borderRadius: 17, paddingVertical: 0, paddingHorizontal: 13 },
  pillText:    buttons.outlineText,
  pillChevron: { fontSize: 10, color: colors.lime },

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
