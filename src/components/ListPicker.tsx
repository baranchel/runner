// Full-screen list in a modal: brand and model pickers (RA-8). Last row "Other…" when onOther is given.
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { buttons, colors, fonts } from '../utils/tokens'

export function ListPicker<T>({ visible, title, items, label, left, onPick, onOther, onClose }: {
  visible: boolean
  title: string
  items: T[]
  label: (item: T) => string
  left?: (item: T) => React.ReactNode
  onPick: (item: T) => void
  onOther?: () => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.screen, { paddingBottom: insets.bottom }]}>
        <View style={s.head}>
          <Text style={s.title}>{title}</Text>
          <TouchableOpacity style={buttons.outline} onPress={onClose}><Text style={buttons.outlineText}>Cancel</Text></TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={(it, i) => `${label(it)}-${i}`}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => onPick(item)}>
              {left?.(item)}
              <Text style={s.rowText}>{label(item)}</Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={onOther ? (
            <TouchableOpacity style={s.row} onPress={onOther}><Text style={[s.rowText, s.other]}>Other…</Text></TouchableOpacity>
          ) : undefined}
        />
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bgApp },
  head:    { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12 },
  title:   { flex: 1, fontFamily: fonts.body, fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12,
             borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
  rowText: { fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary },
  other:   { color: colors.textMuted },
})
