import { useState } from 'react'
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RunPickerList, TYPE_MAP } from '../../src/components/RunPickerList'
import type { Run } from '../../src/types'
import { fmtDate, fmtDistance } from '../../src/utils/format'
import { colors, fonts, runTypeColor, spacing } from '../../src/utils/tokens'

const UNIT = 'km' as const
type Slot = 'a' | 'b'

function SlotCard({ run, onPress }: { run: Run | null; onPress: () => void }) {
  const type = run?.typeId ? TYPE_MAP[run.typeId] : undefined
  const typeColor = type ? runTypeColor(type.hue) : colors.textGhost
  return (
    <TouchableOpacity style={s.slot} activeOpacity={0.7} onPress={onPress}>
      {run ? (
        <View style={s.slotBody}>
          <View style={[s.slotBar, { backgroundColor: typeColor }]} />
          <View style={s.flex}>
            <Text style={s.slotType} numberOfLines={1}>{type?.name ?? 'Unclassified'}</Text>
            <Text style={s.slotMeta}>{fmtDate(run.date)} · {fmtDistance(run.distanceKm, UNIT)}</Text>
          </View>
        </View>
      ) : (
        <Text style={s.slotEmpty}>Select run</Text>
      )}
    </TouchableOpacity>
  )
}

export default function Compare() {
  const router = useRouter()
  const [slots, setSlots] = useState<Record<Slot, Run | null>>({ a: null, b: null })
  const [picking, setPicking] = useState<Slot | null>(null)

  const other = picking === 'a' ? slots.b : picking === 'b' ? slots.a : null
  const ready = slots.a !== null && slots.b !== null

  function pick(run: Run) {
    if (!picking) return
    setSlots(prev => ({ ...prev, [picking]: run }))
    setPicking(null)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.content}>
        <Text style={s.title}>Compare runs</Text>

        <View style={s.slots}>
          <SlotCard run={slots.a} onPress={() => setPicking('a')} />
          <SlotCard run={slots.b} onPress={() => setPicking('b')} />
        </View>

        <TouchableOpacity
          style={[s.button, !ready && s.buttonDisabled]}
          disabled={!ready}
          onPress={() => router.push({ pathname: '/compare/result', params: { a: slots.a!.id, b: slots.b!.id } })}
        >
          <Text style={s.buttonText}>Compare</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={picking !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPicking(null)}
      >
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select run</Text>
            <TouchableOpacity onPress={() => setPicking(null)} hitSlop={8}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <RunPickerList onPressRun={pick} disabledIds={other ? [other.id] : []} />
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  flex:    { flex: 1 },
  content: { padding: spacing.screenH, gap: spacing.gap },
  title:   { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.textPrimary },

  slots: { flexDirection: 'row', gap: 10 },
  slot: {
    flex: 1,
    minHeight: 84,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: spacing.radius,
    padding: 12,
    justifyContent: 'center',
  },
  slotBody:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotBar:   { width: 6, height: 36, borderRadius: 3 },
  slotType:  { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  slotMeta:  { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint, marginTop: 2 },
  slotEmpty: { fontFamily: fonts.body, fontSize: 14, color: colors.textGhost },

  button: {
    backgroundColor: colors.accentBg,
    borderRadius: spacing.radius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.35 },
  buttonText:     { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  modal:       { flex: 1, backgroundColor: colors.bgApp },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenH,
    paddingVertical: 16,
  },
  modalTitle: { fontFamily: fonts.body, fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  close:      { fontFamily: fonts.body, fontSize: 18, color: colors.textSecondary },
})
