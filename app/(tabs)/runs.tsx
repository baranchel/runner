import { View, Text, StyleSheet } from 'react-native'
import { colors, fonts } from '../../src/utils/tokens'

export default function Runs() {
  return (
    <View style={s.container}>
      <Text style={s.text}>Runs — coming soon</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgApp, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14 },
})
