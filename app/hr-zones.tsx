import { useState } from 'react'
import {
  Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuthStore } from '../src/store/useAuthStore'
import { useProfileStore } from '../src/store/useProfileStore'
import { useRunStore } from '../src/store/useRunStore'
import { effectiveHrMax, parseNum, type ZoneMethod } from '../src/utils/profile'
import { methodStarts, validStarts, zoneRangeLabel, ZONE_NAMES, type Starts } from '../src/utils/zones'
import { buttons, colors, fonts, zoneColor } from '../src/utils/tokens'

// RA-9: pick how the 5 HR zones are calculated. Onboarding (after personal info) and Settings (?mode=edit).
// Nothing is saved until the user confirms in the pop-up.
const METHODS: { key: ZoneMethod; label: string; title: string }[] = [
  { key: 'hrmax',  label: '% Max',   title: '% of max heart rate' },
  { key: 'hrr',    label: 'Reserve', title: 'Heart-rate reserve' },
  { key: 'lthr',   label: 'LTHR',    title: 'Lactate threshold' },
  { key: 'manual', label: 'Manual',  title: 'Set your own zones' },
]
const str = (n: number | null | undefined) => (n == null ? '' : String(Math.round(n)))
const numOrNull = (t: string) => parseNum(t) ?? null  // empty or invalid → missing
const badBpm = (n: number) => !(Number.isFinite(n) && n >= 40 && n <= 230)

function describe(m: ZoneMethod, hrMax: number): string {
  switch (m) {
    case 'hrmax': return `The simplest way. Zones start at 60, 70, 80 and 90% of your max heart rate (${hrMax} bpm).`
    case 'hrr':   return `Adds your resting heart rate: zones start at 60–90% of the gap between resting and max (${hrMax} bpm). Usually fits fitter runners better.`
    case 'lthr':  return 'The most accurate. Zones around your threshold heart rate, the HR you can hold for 30–60 min flat out. Your watch may show it, or run a 30-min all-out test and use your average HR over the last 20 min.'
    case 'manual': return "You decide where each zone starts. Use your coach's numbers or a lab test."
  }
}

export default function HrZones() {
  const router = useRouter()
  const editing = useLocalSearchParams<{ mode?: string }>().mode === 'edit'
  const session = useAuthStore(s => s.session)
  const profile = useProfileStore(s => s.profile)
  const runs = useRunStore(s => s.runs)
  const hrMax = effectiveHrMax(profile, runs, new Date())

  const [sel, setSel] = useState<ZoneMethod>(profile?.zone_method ?? 'hrmax')
  const [restText, setRestText] = useState(str(profile?.resting_hr))
  const [lthrText, setLthrText] = useState(str(profile?.lthr))
  const [manualText, setManualText] = useState<string[]>(() =>
    (validStarts(profile?.zone_bounds) ? profile!.zone_bounds! : methodStarts('hrmax', { hrMax, restingHr: null, lthr: null, manual: null })!)
      .map(String))
  const [confirming, setConfirming] = useState(false)

  const manual = manualText.map(t => Number(t.trim() === '' ? NaN : t))
  const inputs = { hrMax, restingHr: numOrNull(restText), lthr: numOrNull(lthrText), manual }
  const starts = Object.fromEntries(METHODS.map(m => [m.key, methodStarts(m.key, inputs)])) as Record<ZoneMethod, Starts | null>
  const current = starts[sel]

  // Shared bpm axis for all columns (% Max always exists, so this is never empty).
  const drawn = Object.values(starts).filter((s): s is Starts => s != null)
  const lo = Math.min(...drawn.map(s => s[0])) - 20
  const hi = Math.max(...drawn.map(s => s[3])) + 20

  const bump = (i: number, d: number) =>
    setManualText(t => t.map((v, j) => (j === i ? String((Number(v) || 0) + d) : v)))
  const setManual = (i: number, v: string) => setManualText(t => t.map((x, j) => (j === i ? v.replace(/[^0-9]/g, '') : x)))
  const copyFrom = (m: ZoneMethod) => { const s = starts[m]; if (s) setManualText(s.map(String)) }
  const manualBad = (i: number) => badBpm(manual[i]) || (i > 0 && !(manual[i] > manual[i - 1]))

  const title = METHODS.find(m => m.key === sel)!.title
  const cta = sel === 'manual' ? 'Use my zones' : `Use ${METHODS.find(m => m.key === sel)!.label}`

  const confirm = () => {
    if (!session || !current) return
    useProfileStore.getState().save(session.user.id, {
      zone_method: sel,
      ...(sel === 'hrr' ? { resting_hr: inputs.restingHr } : {}),
      ...(sel === 'lthr' ? { lthr: inputs.lthr } : {}),
      ...(sel === 'manual' ? { zone_bounds: current } : {}),
    })
    setConfirming(false)
    if (editing) router.back()
    else router.replace('/')  // index → dashboard
  }

  return (
    <KeyboardAvoidingView style={st.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        <Text style={st.title}>Your heart-rate zones</Text>
        <Text style={st.body}>Same heart, four ways to split it into 5 zones. Tap one to compare.</Text>

        <View style={st.cols}>
          {METHODS.map(m => (
            <Column key={m.key} s={starts[m.key]} lo={lo} hi={hi} on={m.key === sel} onPress={() => setSel(m.key)} />
          ))}
        </View>
        <View style={st.labels}>
          {METHODS.map(m => {
            const on = m.key === sel
            return (
              <TouchableOpacity key={m.key} style={st.labelCell} onPress={() => setSel(m.key)} activeOpacity={0.7}>
                <View style={[st.radio, on && st.radioOn]} />
                <Text style={[st.labelText, on && st.labelOn]}>{m.label}</Text>
                {m.key === 'hrmax' && <Text style={[st.labelSub, on && st.labelOn]}>Default</Text>}
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={st.card}>
          <Text style={st.cardTitle}>{title}</Text>
          <Text style={st.desc}>{describe(sel, hrMax)}</Text>

          {sel === 'hrr' && <BpmField label="Resting heart rate" value={restText} onChange={setRestText} />}
          {sel === 'lthr' && <BpmField label="Your LTHR" value={lthrText} onChange={setLthrText} />}

          {sel === 'manual' ? (
            <View>
              <Text style={st.hint}>Set the heart rate (bpm) where each zone starts.</Text>
              <View style={st.chips}>
                <Text style={st.desc}>Start from:</Text>
                {METHODS.filter(m => m.key !== 'manual' && starts[m.key]).map(m => (
                  <TouchableOpacity key={m.key} style={buttons.outline} onPress={() => copyFrom(m.key)} activeOpacity={0.7}>
                    <Text style={buttons.outlineText}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={st.row}>
                <View style={[st.sw, { backgroundColor: zoneColor(0) }]} />
                <Text style={st.rowText}>Z1 {ZONE_NAMES[0]}</Text>
                <Text style={st.range}>{badBpm(manual[0]) ? '—' : `below ${manual[0]}`}</Text>
              </View>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={[st.row, st.rowDivider]}>
                  <View style={[st.sw, { backgroundColor: zoneColor(i + 1) }]} />
                  <Text style={st.rowText}>Z{i + 2} starts at</Text>
                  <View style={st.stepper}>
                    <TouchableOpacity style={st.stepBtn} onPress={() => bump(i, -1)} activeOpacity={0.7}><Text style={st.stepTxt}>−</Text></TouchableOpacity>
                    <TextInput style={[st.stepInput, manualBad(i) && st.inputBad]} value={manualText[i]}
                      onChangeText={v => setManual(i, v)} keyboardType="number-pad" maxLength={3} />
                    <TouchableOpacity style={st.stepBtn} onPress={() => bump(i, 1)} activeOpacity={0.7}><Text style={st.stepTxt}>+</Text></TouchableOpacity>
                  </View>
                  <Text style={st.end}>{i < 3 ? (badBpm(manual[i + 1]) ? '' : `–${manual[i + 1] - 1}`) : 'and up'}</Text>
                </View>
              ))}
              {!current && <Text style={st.error}>Each zone must start higher than the one before it (40–230 bpm).</Text>}
            </View>
          ) : current ? (
            <RangeTable s={current} />
          ) : null}
        </View>

        <TouchableOpacity style={[buttons.primary, st.cta, !current && { opacity: 0.5 }]}
          onPress={() => { Keyboard.dismiss(); setConfirming(true) }} disabled={!current} activeOpacity={0.82}>
          <Text style={[buttons.primaryText, st.ctaText]}>{cta}</Text>
        </TouchableOpacity>
        {editing && (
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={st.secondary}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => setConfirming(false)}>
        <View style={st.veil}>
          <View style={st.modal}>
            <Text style={st.cardTitle}>{sel === 'manual' ? 'Use your own zones?' : `Use ${title}?`}</Text>
            <Text style={st.desc}>Your zones will be:</Text>
            {current && <RangeTable s={current} />}
            <Text style={[st.desc, { marginTop: 8 }]}>
              All your past runs will be updated to these zones. You can change this anytime in Settings.
            </Text>
            <TouchableOpacity style={[buttons.primary, st.cta]} onPress={confirm} activeOpacity={0.82}>
              <Text style={[buttons.primaryText, st.ctaText]}>Yes, use these zones</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirming(false)} activeOpacity={0.7}>
              <Text style={st.secondary}>Go back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

/** One method as a stack of the 5 zone colours, Z1 at the bottom, on the shared lo–hi bpm axis. */
function Column({ s, lo, hi, on, onPress }: { s: Starts | null; lo: number; hi: number; on: boolean; onPress: () => void }) {
  if (!s) {
    return (
      <TouchableOpacity style={[st.col, st.colEmpty, on ? st.colOn : st.colDim]} onPress={onPress} activeOpacity={0.8}>
        <Text style={st.colQ}>?</Text>
      </TouchableOpacity>
    )
  }
  const edges = [lo, ...s, hi]
  return (
    <TouchableOpacity style={[st.col, on ? st.colOn : st.colDim]} onPress={onPress} activeOpacity={0.8}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={{ flex: Math.max(0, edges[i + 1] - edges[i]), backgroundColor: zoneColor(i) }} />
      ))}
    </TouchableOpacity>
  )
}

function RangeTable({ s }: { s: Starts }) {
  return (
    <View>
      {ZONE_NAMES.map((name, i) => (
        <View key={name} style={[st.row, i > 0 && st.rowDivider]}>
          <View style={[st.sw, { backgroundColor: zoneColor(i) }]} />
          <Text style={st.rowText}>Z{i + 1} {name}</Text>
          <Text style={st.range}>{zoneRangeLabel(i, s)}</Text>
        </View>
      ))}
    </View>
  )
}

function BpmField({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) {
  return (
    <View style={st.field}>
      <Text style={st.fieldLabel}>{label}</Text>
      <View style={st.inputWrap}>
        <TextInput style={st.inputFlex} value={value} onChangeText={onChange} keyboardType="number-pad"
          maxLength={3} placeholder="—" placeholderTextColor={colors.textGhost} />
        <Text style={st.unit}>bpm</Text>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.bgApp },
  container: { paddingHorizontal: 24, paddingTop: 70, paddingBottom: 40, gap: 12 },
  title:     { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 25, fontWeight: '600' },
  body:      { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },

  cols:      { flexDirection: 'row', gap: 8, height: 180, marginTop: 4 },
  col:       { flex: 1, flexDirection: 'column-reverse', borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  colOn:     { borderColor: colors.lime },
  colDim:    { opacity: 0.55 },
  colEmpty:  { backgroundColor: colors.bgSurface, borderStyle: 'dashed', borderColor: colors.borderFocus, alignItems: 'center', justifyContent: 'center' },
  colQ:      { color: colors.textMuted, fontFamily: fonts.body, fontSize: 18 },
  labels:    { flexDirection: 'row', gap: 8 },
  labelCell: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  radio:     { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.textGhost },
  radioOn:   { borderWidth: 4, borderColor: colors.lime },
  labelText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 11, fontWeight: '600' },
  labelSub:  { color: colors.textMuted, fontFamily: fonts.body, fontSize: 10 },
  labelOn:   { color: colors.lime },

  card:      { backgroundColor: colors.bgSurface, borderRadius: 14, borderWidth: 1, borderColor: colors.borderDefault, padding: 14, gap: 6 },
  cardTitle: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600' },
  desc:      { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  hint:      { backgroundColor: colors.bgApp, borderRadius: 10, padding: 10, color: colors.accent, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginVertical: 6 },
  chips:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 },

  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  rowDivider:{ borderTopWidth: 1, borderTopColor: colors.borderDefault },
  sw:        { width: 11, height: 11, borderRadius: 3 },
  rowText:   { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 13, flex: 1 },
  range:     { color: colors.textPrimary, fontFamily: fonts.mono, fontSize: 13 },
  stepper:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn:   { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.bgApp, alignItems: 'center', justifyContent: 'center' },
  stepTxt:   { color: colors.accent, fontFamily: fonts.body, fontSize: 18 },
  stepInput: { width: 48, height: 30, borderRadius: 8, borderWidth: 1, borderColor: colors.accent, color: colors.textPrimary,
               textAlign: 'center', fontFamily: fonts.mono, fontSize: 13, padding: 0 },
  inputBad:  { borderColor: colors.danger },
  end:       { width: 52, textAlign: 'right', color: colors.textMuted, fontFamily: fonts.mono, fontSize: 11 },
  error:     { color: colors.danger, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },

  field:     { gap: 4, marginTop: 4 },
  fieldLabel:{ color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, fontWeight: '500' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgApp, borderWidth: 1, borderColor: colors.borderFocus, borderRadius: 10 },
  inputFlex: { flex: 1, paddingVertical: 11, paddingHorizontal: 14, color: colors.textPrimary, fontFamily: fonts.body, fontSize: 14 },
  unit:      { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, paddingHorizontal: 12 },

  cta:       { marginTop: 8, paddingVertical: 15, alignSelf: 'stretch' },
  ctaText:   { fontSize: 15 },
  secondary: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },

  veil:      { flex: 1, backgroundColor: 'rgba(10,7,20,0.7)', justifyContent: 'center', padding: 24 },
  modal:     { backgroundColor: colors.bgSurface, borderRadius: 18, borderWidth: 1, borderColor: colors.borderDefault, padding: 18, gap: 4 },
})
