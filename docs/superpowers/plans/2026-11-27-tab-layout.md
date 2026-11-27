# Tab Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the bottom tabs to Insights · Health · Dashboard · Runs · More (opening on Dashboard), per `docs/superpowers/specs/2026-11-27-tab-layout-design.md`.

**Architecture:** expo-router file-based tabs in `app/(tabs)/`. Today's Insights screen moves to `health.tsx` unchanged; `insights.tsx` becomes a Coming soon screen; `settings.tsx` becomes `more.tsx` (profile card + grouped rows); `compare.tsx` is deleted; `dashboard.tsx` gets a new card order, a dark New run card and an empty state. Tab icons are PNGs drawn with `<Image tintColor>`.

**Tech Stack:** Expo 58, expo-router `Tabs`, React Native, Zustand (`useProfileStore`), TypeScript.

**Rules for the implementer (from CLAUDE.md):**
- **Never run git commands.** Where a task says "Stop for Bar", list the changed files and stop; Bar commits.
- No new npm packages (`@expo/vector-icons` is not installed and is not added).
- Never create image assets. Task 4 needs PNGs from Bar; if they are missing, stop and ask.
- Verify with `npx tsc --noEmit` (must print nothing). There is no new pure logic, so no new self-check.

---

## File map

| File | Responsibility |
|---|---|
| `app/(tabs)/_layout.tsx` | Tab order, labels, initial tab, icons |
| `app/(tabs)/dashboard.tsx` | Running-only Dashboard |
| `app/(tabs)/health.tsx` | Apple Health cards (moved from `insights.tsx`) |
| `app/(tabs)/insights.tsx` | Coming soon screen (until RA-45) |
| `app/(tabs)/more.tsx` | Profile card + grouped settings rows (replaces `settings.tsx`) |
| `CLAUDE.md`, `FRONTEND_SPEC.md`, `architecture.md` | Docs |

---

### Task 1: Dashboard — card order, dark New run card, All runs link, empty state

**Files:**
- Modify: `app/(tabs)/dashboard.tsx` (`RecentRuns`, `Dashboard`, styles `newRun*`)

- [ ] **Step 1: Swap Last 30 days above This week**

In `export default function Dashboard()`, replace

```tsx
        <WeekCard />
        <ThirtyDayCard />
```

with

```tsx
        <ThirtyDayCard />
        <WeekCard />
```

- [ ] **Step 2: Recent runs — "All runs ›" and empty state**

Replace the whole `RecentRuns` function with:

```tsx
function RecentRuns({ router }: { router: ReturnType<typeof useRouter> }) {
  const recent = useRunStore(s => s.runs).slice(0, 4)  // store is newest first
  return (
    <View style={{ gap: 11 }}>
      <View style={s.rowBetween}>
        <Text style={s.sectionTitle}>Recent runs</Text>
        {recent.length > 0 && (
          <TouchableOpacity style={s.pill} onPress={() => router.push('/(tabs)/runs')}>
            <Text style={s.pillText}>All runs ›</Text>
          </TouchableOpacity>
        )}
      </View>
      {recent.length === 0
        ? <Text style={s.emptyRuns}>Your first run from Apple Health will show up here.</Text>
        : recent.map(run => <RunCard key={run.id} run={run} unit={UNIT} />)}
    </View>
  )
}
```

Add to the styles, under `// Recent runs`:

```tsx
  emptyRuns:    { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 14 },
```

- [ ] **Step 3: New run card goes dark**

Replace the `newRun*` styles (keep the shoe styles above them) with:

```tsx
  // New run card (dark, lime border) — RA-39; lime stays for the summary
  newRun:          { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.lime, borderRadius: 18, padding: 14, gap: 3 },
  newRunKickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newRunKicker:    { fontFamily: fonts.body, fontSize: 10, fontWeight: '700', letterSpacing: 0.4, color: colors.lime },
  newRunBadge:     { fontFamily: fonts.body, fontSize: 9, fontWeight: '700', color: colors.textPrimary, backgroundColor: colors.textPrimary + '22',
                     borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  newRunName:      { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  newRunMeta:      { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary },
  newRunActions:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 9 },
  newRunBtn:       { backgroundColor: colors.lime, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  newRunBtnText:   { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', color: colors.ink },
  newRunLink:      { fontFamily: fonts.body, fontSize: 11, fontWeight: '700', color: colors.lime, textDecorationLine: 'underline' },
```

Also fix the stale comment `// New run card (lime) — RA-39` at the top of the styles to `// Shoe alert (RA-8)`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Stop for Bar** — changed: `app/(tabs)/dashboard.tsx`.

---

### Task 2: More screen (replaces You / Settings)

**Files:**
- Create: `app/(tabs)/more.tsx`
- Delete: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Create `app/(tabs)/more.tsx`**

Same logic as `settings.tsx` (log out with sync warning, type-DELETE confirm, Apple Health check on focus), new layout. Row icons: only `assets/heart-rate.png` exists today; other rows have no icon until Bar provides PNGs (Task 4).

```tsx
// More tab (replaces "You"): profile card + grouped settings rows. Spec: 2026-11-27-tab-layout-design.md
import { useCallback, useState, type ReactNode } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type ImageSourcePropType } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signOut, deleteAccount } from '../../src/api/auth'
import { clearAll, pendingCount } from '../../src/db/queries'
import { syncNow } from '../../src/db/sync'
import { needsHealthPrompt } from '../../src/healthkit/permissions'
import { useProfileStore } from '../../src/store/useProfileStore'
import { colors, fonts } from '../../src/utils/tokens'

export default function More() {
  const router = useRouter()
  const profile = useProfileStore(s => s.profile)
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  const initials = [profile?.first_name, profile?.last_name].map(n => n?.trim()[0] ?? '').join('').toUpperCase()

  const [error,      setError]      = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed,      setTyped]      = useState('')
  const [busy,       setBusy]       = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [canConnect, setCanConnect] = useState(false)
  // Tab stays mounted, so re-check on every focus (the user may have just connected).
  useFocusEffect(useCallback(() => { needsHealthPrompt().then(setCanConnect) }, []))

  // gate redirects to login on success; an explicit logout wipes the phone's copy
  const doLogOut = async () => {
    const err = await signOut()
    if (!err) clearAll()
    setError(err)
  }

  // Try to upload first; warn if changes would be lost.
  const logOut = async () => {
    if (loggingOut) return
    setError(null); setLoggingOut(true)
    await syncNow()
    setLoggingOut(false)
    if (pendingCount() === 0) return doLogOut()
    Alert.alert(
      'Unsynced changes',
      "Some changes haven't reached the cloud yet. Logging out now will lose them.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out anyway', style: 'destructive', onPress: doLogOut },
      ],
    )
  }

  const remove = async () => {
    if (typed !== 'DELETE' || busy) return
    setBusy(true); setError(null)
    const err = await deleteAccount()
    setBusy(false)
    if (err) setError(err)  // on success the gate redirects to login
    else clearAll()
  }

  const healthHelp = () => Alert.alert('Apple Health',
    'Runs missing? Open the iPhone Settings app → Health → Data Access & Devices → Chronodrom, and turn on all categories. ' +
    'New runs are imported when you open the app or pull down on All runs.')

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>More</Text>

        <TouchableOpacity style={s.profile} activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/personal-info', params: { mode: 'edit' } })}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials || '?'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName} numberOfLines={1}>{name || 'Your profile'}</Text>
            <Text style={s.profileSub}>Personal info</Text>
          </View>
          <Text style={s.profileChevron}>›</Text>
        </TouchableOpacity>

        <Group label="Training">
          <Row label="Heart-rate zones" icon={require('../../assets/heart-rate.png')}
            onPress={() => router.push({ pathname: '/hr-zones', params: { mode: 'edit' } })} />
        </Group>

        <Group label="Gear">
          <Row label="My shoes" onPress={() => router.push('/shoes')} />
        </Group>

        <Group label="Connections">
          <Row label="Apple Health" value={canConnect ? 'Connect' : 'Connected'}
            onPress={canConnect ? () => router.push('/health-access') : healthHelp} />
        </Group>

        <Group label="Account">
          <Row label={loggingOut ? 'Syncing…' : 'Log out'} onPress={logOut} chevron={false} />
          <Row label="Delete account" danger onPress={() => setConfirming(true)} chevron={false} />
        </Group>

        {confirming && (
          <View style={s.dangerBox}>
            <Text style={s.body}>This permanently deletes your account and all your data. This can't be undone.</Text>
            <Text style={s.body}>Type DELETE to confirm.</Text>
            <TextInput style={s.input} value={typed} onChangeText={setTyped}
              autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor={colors.textGhost} />
            <TouchableOpacity style={[s.dangerBtn, typed !== 'DELETE' && { opacity: 0.5 }]}
              onPress={remove} disabled={typed !== 'DELETE' || busy} activeOpacity={0.82}>
              <Text style={s.dangerBtnText}>{busy ? 'Deleting…' : 'Delete my account'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setConfirming(false); setTyped('') }} activeOpacity={0.7}>
              <Text style={s.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && <Text style={s.error}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}

// A group with no rows is simply not rendered by the screen (e.g. "App" until RA-6 / RA-44).
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text style={s.groupLabel}>{label.toUpperCase()}</Text>
      <View style={s.group}>{children}</View>
    </View>
  )
}

function Row({ label, icon, value, danger, chevron = true, onPress }: {
  label: string; icon?: ImageSourcePropType; value?: string; danger?: boolean; chevron?: boolean; onPress: () => void
}) {
  const color = danger ? colors.danger : colors.textPrimary
  return (
    <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onPress}>
      {icon && <Image source={icon} style={[s.rowIcon, { tintColor: danger ? colors.danger : colors.accent }]} />}
      <Text style={[s.rowText, { color }]}>{label}</Text>
      {value && <Text style={s.rowValue}>{value}</Text>}
      {chevron && <Text style={s.rowChevron}>›</Text>}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bgApp },
  content:  { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 32, gap: 18 },
  title:    { fontFamily: fonts.body, fontSize: 25, fontWeight: '600', color: colors.textPrimary },

  // Profile card (lavender) — achievements + goals get added here later
  profile:        { backgroundColor: colors.accent, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:         { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', color: colors.accent },
  profileName:    { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.ink },
  profileSub:     { fontFamily: fonts.body, fontSize: 11, color: colors.ink, opacity: 0.75, marginTop: 2 },
  profileChevron: { fontSize: 20, color: colors.ink },

  groupLabel: { fontFamily: fonts.body, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, color: colors.textGhost, marginBottom: 6, marginLeft: 4 },
  group:      { backgroundColor: colors.bgSurface, borderRadius: 14, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14,
                borderTopWidth: 1, borderTopColor: colors.borderSubtle, marginTop: -1 },
  rowIcon:    { width: 18, height: 18 },
  rowText:    { flex: 1, fontFamily: fonts.body, fontSize: 14, fontWeight: '500' },
  rowValue:   { fontFamily: fonts.body, fontSize: 12, color: colors.textGhost },
  rowChevron: { fontSize: 17, color: colors.textGhost },

  dangerBox:     { backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 16, gap: 10 },
  body:          { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  input:         { backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, color: colors.textPrimary, fontSize: 15 },
  dangerBtn:     { backgroundColor: colors.danger, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  dangerBtnText: { color: '#fff', fontFamily: fonts.body, fontSize: 15, fontWeight: '700' },
  cancel:        { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 12, marginTop: 6 },
  error:         { color: colors.danger, fontFamily: fonts.body, fontSize: 13 },
})
```

Note: `marginTop: -1` + `overflow: 'hidden'` on the group hides the first row's top divider, so only dividers between rows show.

- [ ] **Step 2: Delete `app/(tabs)/settings.tsx`**

Nothing links to `/settings` (checked with `grep -rn "settings" app src` — only the file itself). Re-run that grep; if anything else links to it, change the link to `/more`.

- [ ] **Step 3: Type-check** — `npx tsc --noEmit`, expected no output. (The tab layout still lists `settings`; Task 3 fixes it. expo-router only warns at runtime, tsc is unaffected.)

- [ ] **Step 4: Stop for Bar** — changed: `app/(tabs)/more.tsx` (new), `app/(tabs)/settings.tsx` (deleted).

---

### Task 3: Health move, Insights Coming soon, Compare tab removed, tab bar order

**Files:**
- Move: `app/(tabs)/insights.tsx` → `app/(tabs)/health.tsx`
- Create: `app/(tabs)/insights.tsx`
- Delete: `app/(tabs)/compare.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Move the Health screen**

Move `app/(tabs)/insights.tsx` to `app/(tabs)/health.tsx` (same folder depth, so the `../../src/...` imports stay valid). In the moved file change only:
- first comment line → `// Health tab (was the RA-29 Insights tab): Apple Health metrics as grouped trend cards. Layout from the Figma`
- `"lime kept for future insight cards."` → `"lime marks the most important card on a screen (none here)."`
- `export default function Insights()` → `export default function Health()`

- [ ] **Step 2: Create the Coming soon screen `app/(tabs)/insights.tsx`**

```tsx
// Insights tab: "what you can understand from your data" (RA-45). Coming soon until RA-45 ships.
// Spec: docs/superpowers/specs/2026-11-27-tab-layout-design.md
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fonts } from '../../src/utils/tokens'

export default function Insights() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <Text style={s.title}>Insights</Text>
      <View style={s.center}>
        <View style={s.tile}><Text style={s.tileGlyph}>✦</Text></View>
        <Text style={s.head}>Coming soon</Text>
        <Text style={s.body}>Insights will explain what your running and health data mean, in plain words.</Text>
        <Text style={s.note}>Your health cards moved to the Health tab.</Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bgApp },
  title:     { fontFamily: fonts.body, fontSize: 25, fontWeight: '600', color: colors.textPrimary, paddingHorizontal: 24, paddingTop: 14 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  tile:      { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileGlyph: { fontSize: 28, color: colors.lime },
  head:      { fontFamily: fonts.body, fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  body:      { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.textSecondary, textAlign: 'center' },
  note:      { fontFamily: fonts.body, fontSize: 12, color: colors.textGhost, textAlign: 'center' },
})
```

(The ✦ glyph is a stand-in; Task 4 swaps it for `tab-insights.png`.)

- [ ] **Step 3: Delete `app/(tabs)/compare.tsx`**

`CompareView` stays: `/compare/result` uses it. Run `grep -rn "'/compare'\|(tabs)/compare" app src` — expected no matches (Run detail and All runs go to `/compare/result` or `/runs`). If any match, point it at `/runs` with `params: { select: <runId> }`.

- [ ] **Step 4: New tab order in `app/(tabs)/_layout.tsx`** (labels only; icons in Task 4)

```tsx
import { Tabs } from 'expo-router';
import { colors, fonts } from '../../src/utils/tokens';

// Spec: docs/superpowers/specs/2026-11-27-tab-layout-design.md — opens on Dashboard (middle).
export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bgCard, borderTopColor: colors.borderSubtle },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textGhost,
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 11.5, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="health" options={{ title: 'Health' }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="runs" options={{ title: 'Runs' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
```

- [ ] **Step 5: Type-check** — `npx tsc --noEmit`, expected no output.

- [ ] **Step 6: Stop for Bar** — changed: `app/(tabs)/health.tsx` (moved from `insights.tsx`), `app/(tabs)/insights.tsx` (new), `app/(tabs)/compare.tsx` (deleted), `app/(tabs)/_layout.tsx`. Bar can now test in Expo Go (`npx expo start`): app opens on Dashboard, 5 tabs, labels only.

---

### Task 4: Tab icons + Coming soon icon + More row icons (needs Bar's PNGs)

**Files:**
- Modify: `app/(tabs)/_layout.tsx`, `app/(tabs)/insights.tsx`, `app/(tabs)/more.tsx`
- Assets from Bar (512 × 512, black outline on transparent, same style as `assets/compare.png`): `assets/tab-insights.png`, `assets/tab-health.png`, `assets/tab-dashboard.png`, `assets/tab-more.png`. Optional: `assets/shoe.png`, `assets/apple-health.png`, `assets/logout.png`, `assets/delete.png`.

- [ ] **Step 1: Reference the assets even if they don't exist yet**

Bar is providing all 8 PNGs (decision 2026-11-27): write the `require(...)` lines for every file listed above, including the optional ones, whether or not the file exists yet. Never create the images. `tsc` passes either way; Metro won't bundle until the files are in `assets/`. Report which ones are still missing (`ls assets/*.png`). Runs reuses `assets/icon.png` (the runner).

- [ ] **Step 2: Icons in `app/(tabs)/_layout.tsx`**

Replace the file with:

```tsx
import { Image, View, type ImageSourcePropType } from 'react-native';
import { Tabs } from 'expo-router';
import { colors, fonts } from '../../src/utils/tokens';

// Spec: docs/superpowers/specs/2026-11-27-tab-layout-design.md — opens on Dashboard (middle).
const ICONS = {
  insights:  require('../../assets/tab-insights.png'),
  health:    require('../../assets/tab-health.png'),
  dashboard: require('../../assets/tab-dashboard.png'),
  runs:      require('../../assets/icon.png'),  // the runner (also the app icon; copy it to its own file if that changes)
  more:      require('../../assets/tab-more.png'),
};

function TabIcon({ src, color }: { src: ImageSourcePropType; color: string }) {
  return <Image source={src} style={{ width: 22, height: 22, tintColor: color }} />;
}

// Middle tab reads as "home": when active, ink glyph in a filled lavender circle.
function HomeIcon({ focused, color }: { focused: boolean; color: string }) {
  if (!focused) return <TabIcon src={ICONS.dashboard} color={color} />;
  return (
    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={ICONS.dashboard} style={{ width: 18, height: 18, tintColor: colors.ink }} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
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
```

- [ ] **Step 3: Coming soon tile icon** — in `app/(tabs)/insights.tsx` add `Image` to the `react-native` import, replace `<Text style={s.tileGlyph}>✦</Text>` with

```tsx
<Image source={require('../../assets/tab-insights.png')} style={s.tileIcon} />
```

and replace the `tileGlyph` style with `tileIcon: { width: 30, height: 30, tintColor: colors.lime },`.

- [ ] **Step 4: More row icons** — in `app/(tabs)/more.tsx` add `icon={require('../../assets/<file>.png')}` to: My shoes (`shoe.png`), Apple Health (`apple-health.png`), Log out (`logout.png`), Delete account (`delete.png`). Add all four, even if a file isn't there yet.

- [ ] **Step 5: Type-check** — `npx tsc --noEmit`, expected no output.

- [ ] **Step 6: Stop for Bar** — changed: the three files + the new PNGs in `assets/`.

---

### Task 5: Docs

**Files:** `CLAUDE.md`, `FRONTEND_SPEC.md`, `architecture.md`, `docs/HANDOFF.md`

- [ ] **Step 1: `CLAUDE.md`** — in the Conventions line starting "Insights read Apple Health live", replace `lime is reserved for insight cards.` with `lime marks the most important card(s) on a screen (any tab); lavender is the second highlight.` Add under **Stack** after the Insights line:

```markdown
- **Tabs** — Insights · Health · Dashboard · Runs · More, opening on Dashboard (`app/(tabs)/_layout.tsx`, PNG icons). Health = the RA-29 cards (`health.tsx`); Insights = Coming soon until RA-45. See `docs/superpowers/specs/2026-11-27-tab-layout-design.md`.
```

- [ ] **Step 2: `FRONTEND_SPEC.md`**
  - Replace the `### Bottom Tab Bar` block (title line through "Font: 11.5 px / 600") with:

```markdown
### Bottom Tab Bar
Five tabs, left → right: **Insights · Health · Dashboard · Runs · More**; the app opens on Dashboard (middle).
- PNG icons 22 px with `tintColor`: active `accent`, inactive `text-ghost`. Dashboard when active: 18 px `ink` glyph in a 30 px `accent` circle.
- Labels 11.5 px / 600. Bar `bg-card`, top border `border-subtle`.
- No Compare tab: compare from Runs (compare button) or Run Detail.
```

  - Rename the heading `## Insights tab (RA-29)` to `## Health tab (RA-29, was the Insights tab)` and in its "Group colours" bullet replace `Lime is reserved for insight cards (RA-45).` with `No lime here (lime = the most important card on a screen).`
  - Append a section:

```markdown
## Tab layout (2026-11-27)

Full design: `docs/superpowers/specs/2026-11-27-tab-layout-design.md`.
- **Lime rule:** lime marks the most important card(s) on a screen; lavender (`accent` fill, `ink` text) is the second highlight.
- **Dashboard order:** (target card, RA-23) · New run card · shoe alerts · Last 30 days (lime) · This week (lavender) · Recent runs (4, "All runs ›"). New run card: `bg-surface`, 1 px lime border, lime kicker + "Choose type ▾" (lime fill, ink text) + "Set all N ›" (lime). No runs → "Your first run from Apple Health will show up here." (13, `text-secondary`, centered).
- **Insights:** Coming soon screen until RA-45 (tile 64, radius 20, `bg-surface`, lime icon; "Coming soon" 18 / 600; body 13 `text-secondary`; note 12 `text-ghost`).
- **More:** title 25 / 600. Profile card `accent`, radius 20, padding 14: initials circle 46 (`ink` fill, `accent` text 16 / 700), name 15 / 700 `ink`, "Personal info" 11 `ink` 75 %, ›. Groups: label 11 / 600 uppercase `text-ghost`; rows in one `bg-surface` block radius 14, 1 px `border-subtle` dividers, 18 px icon (`accent`), label 14 / 500, value 12 `text-ghost`, ›. Groups: Training · Gear · Connections · (App) · Account; empty groups hidden. Delete account row in `danger`, same type-DELETE confirm.
```

- [ ] **Step 3: `architecture.md`** — in the `(tabs)/` file tree replace the six lines from `_layout.tsx` to `settings.tsx` with:

```
    _layout.tsx                ← bottom tab bar (Insights, Health, Dashboard, Runs, More); opens on Dashboard
    insights.tsx               ← Coming soon (RA-45 Smart Insights later)
    health.tsx                 ← Apple Health trend cards (RA-29)
    dashboard.tsx              ← Dashboard (running only)
    runs.tsx                   ← Runs tab (screen title "All runs")
    more.tsx                   ← profile card + settings rows
```

- [ ] **Step 4: `docs/HANDOFF.md`** — in "Brainstorm progress", add a line: `**Implemented** (plan docs/superpowers/plans/2026-11-27-tab-layout.md); device test pending.`

- [ ] **Step 5: Stop for Bar** — changed: the four docs.

---

## Device test (Bar, Expo Go)

1. App opens on Dashboard (middle tab, lavender circle when icons are in).
2. All 5 tabs open; no Compare tab.
3. Dashboard: Last 30 days above This week; "All runs ›" opens Runs. With a run that needs a type: dark New run card, Choose type works, "Set all N ›" opens Runs in bulk mode.
4. Run detail → compare → "Choose from all runs ›" opens Runs in compare mode with the run checked.
5. Health: cards, Edit, a detail screen.
6. Insights: Coming soon.
7. More: profile card shows your name and opens Personal info; Heart-rate zones, My shoes, Apple Health rows work; Log out; Delete account → Cancel.
