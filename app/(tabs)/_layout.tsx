import { Image, View, type ColorValue, type ImageSourcePropType } from 'react-native';
import { Tabs } from 'expo-router';
import { colors, fonts } from '../../src/utils/tokens';

// Spec: docs/superpowers/specs/2026-11-27-tab-layout-design.md — opens on Dashboard (middle).
export const unstable_settings = { initialRouteName: 'dashboard' };

const ICONS = {
  insights:  require('../../assets/tab-insights.png'),
  health:    require('../../assets/tab-health.png'),
  dashboard: require('../../assets/tab-dashboard.png'),
  runs:      require('../../assets/icon.png'),  // the runner (also the app icon; copy it to its own file if that changes)
  more:      require('../../assets/tab-more.png'),
};

function TabIcon({ src, color }: { src: ImageSourcePropType; color: ColorValue }) {
  return <Image source={src} style={{ width: 22, height: 22, tintColor: color }} />;
}

// tab-dashboard.png has its house ~8% right of centre (40 of 512 px); nudge it back. Remove if the PNG is re-exported centred.
const HOME_NUDGE = -40 / 512;

// Middle tab reads as "home": when active, ink glyph in a filled lavender circle.
function HomeIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
  if (!focused) return <Image source={ICONS.dashboard} style={{ width: 22, height: 22, tintColor: color, transform: [{ translateX: 22 * HOME_NUDGE }] }} />;
  return (
    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={ICONS.dashboard} style={{ width: 18, height: 18, tintColor: colors.ink, transform: [{ translateX: 18 * HOME_NUDGE }] }} />
    </View>
  );
}

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
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: ({ color }) => <TabIcon src={ICONS.insights} color={color} /> }} />
      <Tabs.Screen name="health" options={{ title: 'Health', tabBarIcon: ({ color }) => <TabIcon src={ICONS.health} color={color} /> }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ focused, color }) => <HomeIcon focused={focused} color={color} /> }} />
      <Tabs.Screen name="runs" options={{ title: 'Runs', tabBarIcon: ({ color }) => <TabIcon src={ICONS.runs} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon src={ICONS.more} color={color} /> }} />
    </Tabs>
  );
}
