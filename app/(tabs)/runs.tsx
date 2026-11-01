import { useEffect, useState } from 'react'
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RunPickerList } from '../../src/components/RunPickerList'
import { MOCK_RUNS } from '../../src/mockData'
import type { Run } from '../../src/types'
import { fmtDate } from '../../src/utils/format'
import { colors, fonts, spacing } from '../../src/utils/tokens'

const BAR_SPACE = 76 // list bottom padding while the compare bar is showing

export default function Runs() {
  const router = useRouter()
  const { select } = useLocalSearchParams<{ select?: string }>()
  // Selection lives here; tab screens stay mounted, so it persists until ✕ or icon re-tap.
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

  const compareIcon = (
    <TouchableOpacity onPress={() => (selecting ? exitSelection() : setSelecting(true))} hitSlop={8}>
      <Image
        source={require('../../assets/compare.png')}
        style={[s.icon, { tintColor: selecting ? colors.accent : colors.textSecondary }]}
      />
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <RunPickerList
        onPressRun={onPressRun}
        checkedIds={selecting ? selectedIds : undefined}
        headerRight={compareIcon}
        bottomInset={pair ? BAR_SPACE : 0}
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
  safe: { flex: 1, backgroundColor: colors.bgApp },
  icon: { width: 22, height: 22 },

  bar: {
    position: 'absolute',
    left: spacing.screenH,
    right: spacing.screenH,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: spacing.radius,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  barText:    { flex: 1, fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  barBtn:     { backgroundColor: colors.accentBg, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  barBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  barClose:   { fontFamily: fonts.body, fontSize: 18, color: colors.textSecondary },
})
