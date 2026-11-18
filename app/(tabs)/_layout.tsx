import { Tabs } from 'expo-router';
import { colors, fonts } from '../../src/utils/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bgCard, borderTopColor: colors.borderSubtle },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textGhost,
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 11.5, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Running' }} />
      <Tabs.Screen name="runs" options={{ title: 'All runs' }} />
      <Tabs.Screen name="compare" options={{ title: 'Compare' }} />
      <Tabs.Screen name="settings" options={{ title: 'You' }} />
    </Tabs>
  );
}
