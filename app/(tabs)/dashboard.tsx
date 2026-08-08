import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../src/utils/tokens';

export default function Dashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Chronodrom</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgApp, alignItems: 'center', justifyContent: 'center' },
  text:      { color: colors.accent, fontFamily: fonts.body, fontSize: 32, fontWeight: '800' },
});
