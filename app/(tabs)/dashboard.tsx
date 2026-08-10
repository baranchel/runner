import { ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import SummaryCard from '../../src/components/SummaryCard'
import { MOCK_RUNS } from '../../src/mockData'
import { colors, spacing } from '../../src/utils/tokens'

export default function Dashboard() {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <SummaryCard
          runs={MOCK_RUNS}
          today={new Date()}
          unit="km"
        />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bgApp },
  content: { padding: spacing.screenH, gap: spacing.gap },
})
