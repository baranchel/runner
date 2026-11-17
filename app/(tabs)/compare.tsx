import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CompareView } from '../../src/components/CompareView'
import { colors } from '../../src/utils/tokens'

export default function Compare() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <CompareView />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
})
