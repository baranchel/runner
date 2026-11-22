import { Alert, Image, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { RunCard } from '../../src/components/RunCard'
import {
  FilterPill, MonthHeader, SORTS, buildSections, pick, pickRunType, pickType, typeLabel,
  type RunSection, type SortKey,
} from '../../src/components/RunPickerList'
import { importNewRuns } from '../../src/healthkit/importRuns'
import { useRunStore } from '../../src/store/useRunStore'
import type { Run } from '../../src/types'
import { fmtDate } from '../../src/utils/format'
import { buttons, colors, fonts } from '../../src/utils/tokens'

// ponytail: hardcoded until useUserStore lands; replace with store selector
const UNIT: 'km' | 'mi' = 'km'
const BAR_SPACE = 76 // extra list bottom padding while the compare bar is showing

export default function Runs() {
  const runs = useRunStore(s => s.runs)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('newest')
  const sections = buildSections(runs, selectedTypeId, sort)

  const [refreshing, setRefreshing] = useState(false)
  const refresh = async () => {
    setRefreshing(true)
    await importNewRuns()  // syncs first
    setRefreshing(false)
  }

  const router = useRouter()
  const { select, bulk } = useLocalSearchParams<{ select?: string; bulk?: string }>()
  const setType = useRunStore(s => s.setType)
  // compare = pick 2 runs to compare; bulk = set one type on many runs (RA-39).
  // Tab screens stay mounted, so the mode persists until ✕ / Done / icon re-tap.
  const [mode, setMode] = useState<'none' | 'compare' | 'bulk'>('none')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Arriving from Run Detail's "Choose from all runs": start fresh with that run checked.
  useEffect(() => {
    if (!select) return
    setMode('compare')
    setSelectedIds([select])
    router.setParams({ select: undefined })
  }, [select])

  // Arriving from the Dashboard "Set all N": bulk mode with every waiting run checked.
  useEffect(() => {
    if (!bulk) return
    setMode('bulk')
    setSelectedTypeId(null)
    setSelectedIds(useRunStore.getState().runs.filter(r => r.needsType).map(r => r.id))
    router.setParams({ bulk: undefined })
  }, [bulk])

  function enterMode(m: 'none' | 'compare' | 'bulk') {
    setMode(m)
    setSelectedIds([])
  }
  const exitSelection = () => enterMode('none')

  // Bulk acts only on runs the current filter shows, so a filter change can't hide checked runs.
  const visibleIds = sections.flatMap(sec => sec.data.map(r => r.id))
  const visible = new Set(visibleIds)
  const chosen = selectedIds.filter(id => visible.has(id))
  const allChecked = visibleIds.length > 0 && chosen.length === visibleIds.length

  function onPressRun(run: Run) {
    if (mode === 'none') {
      router.push(`/run/${run.id}`)
      return
    }
    if (selectedIds.includes(run.id)) {
      setSelectedIds(ids => ids.filter(id => id !== run.id))
      return
    }
    if (mode === 'bulk') {
      setSelectedIds(ids => (ids.includes(run.id) ? ids : [...ids, run.id]))
      return
    }
    if (selectedIds.length >= 2) {
      Alert.alert('You can compare only 2 runs. Uncheck one first.')
      return
    }
    // guard inside the updater too: two fast taps before a re-render can't add a dup or a 3rd run
    setSelectedIds(ids => (ids.includes(run.id) || ids.length >= 2 ? ids : [...ids, run.id]))
  }

  // newer run first → A, older → B
  const pair = mode === 'compare' && selectedIds.length === 2
    ? selectedIds
        .map(id => runs.find(r => r.id === id))
        .filter((r): r is Run => r !== undefined)
        .sort((x, y) => y.date.localeCompare(x.date))
    : null

  const sortLabel = SORTS.find(x => x.key === sort)!.label

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.top}>
        <View style={s.titleRow}>
          <Text style={s.title}>All runs</Text>
          <TouchableOpacity hitSlop={8} onPress={() => enterMode(mode === 'bulk' ? 'none' : 'bulk')}>
            <Text style={s.selectText}>{mode === 'bulk' ? 'Done' : 'Select'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.searchRow}>
          {/* Placeholder — search lands with RA-35 */}
          <View style={s.search}>
            <Text style={s.searchText}>Search your runs</Text>
          </View>
          {/* Figma "+" slot → compare-mode toggle */}
          <TouchableOpacity
            style={[s.compareBtn, mode === 'compare' && s.compareBtnOn]}
            onPress={() => enterMode(mode === 'compare' ? 'none' : 'compare')}
          >
            <Image
              source={require('../../assets/compare.png')}
              style={[s.compareIcon, { tintColor: mode === 'compare' ? colors.ink : colors.textPrimary }]}
            />
          </TouchableOpacity>
        </View>

        <View style={s.filters}>
          <FilterPill label={typeLabel(selectedTypeId)} onPress={() => pickType(setSelectedTypeId)} />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.textSecondary} />}
        renderSectionHeader={({ section }) => (
          <MonthHeader section={section as RunSection} selectedTypeId={selectedTypeId} />
        )}
        renderSectionFooter={() => <View style={{ height: 14 }} />}
        extraData={[mode, selectedIds]}
        renderItem={({ item }) => (
          <RunCard
            run={item}
            unit={UNIT}
            checked={mode !== 'none' ? selectedIds.includes(item.id) : undefined}
            onPress={() => onPressRun(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={[s.listContent, (pair || mode === 'bulk') && { paddingBottom: 32 + BAR_SPACE }]}
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

      {mode === 'bulk' && (
        <View style={s.bar}>
          <TouchableOpacity hitSlop={8} onPress={() => setSelectedIds(allChecked ? [] : visibleIds)}>
            <Text style={s.barLink}>{allChecked ? 'Deselect all' : 'Select all'}</Text>
          </TouchableOpacity>
          <Text style={[s.barText, { textAlign: 'center' }]} numberOfLines={1}>{chosen.length} selected</Text>
          <TouchableOpacity
            style={[s.barBtn, chosen.length === 0 && { opacity: 0.4 }]}
            disabled={chosen.length === 0}
            onPress={() =>
              pickRunType(`Set type for ${chosen.length} run${chosen.length === 1 ? '' : 's'}`, undefined, id => {
                setType(chosen, id)
                exitSelection()
              })}
          >
            <Text style={s.barBtnText}>Set type ▾</Text>
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

  titleRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  selectText:  { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.lime },
  searchRow:   { flexDirection: 'row', gap: 12 },
  search:      { flex: 1, height: 44, borderRadius: 15, backgroundColor: colors.bgSurface, justifyContent: 'center', paddingHorizontal: 16 },
  searchText:  { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, opacity: 0.8 },
  compareBtn:  { width: 46, height: 44, borderRadius: 15, backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  compareBtnOn: { backgroundColor: colors.lime },
  compareIcon: { width: 20, height: 20 },

  filters:     { flexDirection: 'row', gap: 10 },

  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyText:   { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },

  bar:        { position: 'absolute', left: 24, right: 24, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: colors.bgElevated, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14,
                shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  barText:    { flex: 1, fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  barBtn:     buttons.primary,
  barBtnText: buttons.primaryText,
  barLink:     { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.lime },
  barClose:   { fontFamily: fonts.body, fontSize: 18, color: colors.textSecondary },
})
