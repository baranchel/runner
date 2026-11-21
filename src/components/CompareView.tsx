import { useState } from 'react'
import { useRouter } from 'expo-router'
import { Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { Circle, Line, Polyline, Svg, Text as SvgText } from 'react-native-svg'
import { RunPickerList } from './RunPickerList'
import { useTypeMap } from '../store/useRunTypeStore'
import { useZoneStarts } from '../store/useProfileStore'
import type { Run } from '../types'
import { COMPARE_METRICS, betterValue, distanceLabel, paceOf, paceTakeaway } from '../utils/compare'
import { fmtDate, fmtDistance, fmtMMSS, fmtPace } from '../utils/format'
import { colors, fonts, runTypeColor } from '../utils/tokens'

// ponytail: hardcoded until useUserStore lands; replace with store selector
const UNIT: 'km' | 'mi' = 'km'
type Slot = 'a' | 'b'

// per-split pace (sec/km); a partial last split uses its own length
function splitPaces(run: Run): number[] {
  return run.splits.map((sp, i) => {
    const len = sp.km - (i === 0 ? 0 : run.splits[i - 1].km)
    return len > 0 ? sp.timeSec / len : sp.timeSec
  })
}

function SlotCard({ slot, run, onPress }: { slot: Slot; run: Run | null; onPress: () => void }) {
  const typeMap = useTypeMap()
  const type = run?.typeId ? typeMap[run.typeId] : undefined
  return (
    <TouchableOpacity style={s.slot} activeOpacity={0.7} onPress={onPress}>
      <View style={s.slotTop}>
        <View style={s.slotLabelRow}>
          {run && <View style={[s.dot, { backgroundColor: type ? runTypeColor(type.hue) : colors.textGhost }]} />}
          <Text style={s.slotLabel}>RUN {slot.toUpperCase()}</Text>
        </View>
        <Text style={s.chevron}>▾</Text>
      </View>
      {run ? (
        <>
          <Text style={s.slotDate}>{fmtDate(run.date)}</Text>
          <Text style={s.slotMeta}>{fmtDistance(run.distanceKm, UNIT)} · {fmtPace(paceOf(run), UNIT)}</Text>
        </>
      ) : (
        <Text style={s.slotEmpty}>Pick a run</Text>
      )}
    </TouchableOpacity>
  )
}

const CH = 150          // svg height
const PAD_L = 36        // y-label column
const PAD_T = 8
const PAD_B = 22        // x labels
const INK = colors.ink

function PaceChart({ a, b }: { a: Run; b: Run }) {
  const [w, setW] = useState(0)
  const pa = splitPaces(a)
  const pb = splitPaces(b)
  const n = Math.max(pa.length, pb.length)
  const all = [...pa, ...pb]
  // nice 20s bounds around the data; faster (lower sec) on top
  const lo = Math.floor((Math.min(...all) - 5) / 20) * 20
  const hi = Math.ceil((Math.max(...all) + 5) / 20) * 20
  const ticks = [lo, Math.round((lo + hi) / 2), hi]
  const plotH = CH - PAD_T - PAD_B
  const plotW = w - PAD_L - 8
  const x = (i: number) => PAD_L + 6 + (n > 1 ? (i / (n - 1)) * (plotW - 6) : plotW / 2)
  const y = (p: number) => PAD_T + ((p - lo) / (hi - lo || 1)) * plotH
  const pts = (ps: number[]) => ps.map((p, i) => `${x(i)},${y(p)}`).join(' ')
  const showX = (i: number) => n <= 10 || i % 2 === 0 || i === n - 1

  return (
    <View style={s.chartCard}>
      <Text style={s.chartTitle}>Pace by kilometre</Text>
      <View style={s.legend}>
        <View style={s.legendItem}><View style={[s.legendLine, { backgroundColor: INK }]} /><Text style={s.legendText}>{fmtDate(a.date)}</Text></View>
        <View style={s.legendItem}><View style={[s.legendLine, { backgroundColor: INK, opacity: 0.55 }]} /><Text style={s.legendText}>{fmtDate(b.date)}</Text></View>
        <Text style={[s.legendText, s.legendUnit]}>min/km</Text>
      </View>
      <View onLayout={e => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Svg width={w} height={CH}>
            {ticks.map(t => (
              <Line key={t} x1={PAD_L} y1={y(t)} x2={w} y2={y(t)} stroke={INK} strokeOpacity={0.12} strokeWidth={1} />
            ))}
            {ticks.map(t => (
              <SvgText key={`l${t}`} x={0} y={y(t) + 3.5} fill={INK} fillOpacity={0.85} fontSize={10} fontFamily={fonts.mono}>
                {fmtMMSS(t)}
              </SvgText>
            ))}
            <Polyline points={pts(pb)} fill="none" stroke={INK} strokeOpacity={0.55} strokeWidth={2} strokeDasharray="5 4" />
            <Polyline points={pts(pa)} fill="none" stroke={INK} strokeWidth={2.5} />
            {pa.map((p, i) => <Circle key={i} cx={x(i)} cy={y(p)} r={3} fill={INK} />)}
            {Array.from({ length: n }, (_, i) => showX(i) && (
              <SvgText key={`x${i}`} x={x(i) - 3} y={CH - 4} fill={INK} fillOpacity={0.85} fontSize={10} fontFamily={fonts.mono}>
                {i + 1}
              </SvgText>
            ))}
          </Svg>
        )}
      </View>
      <Text style={s.axisTitle}>Kilometres</Text>
    </View>
  )
}

function MetricsTable({ a, b }: { a: Run; b: Run }) {
  const [highlight, setHighlight] = useState(false)
  const router = useRouter()
  const starts = useZoneStarts()
  return (
    <View style={s.tableWrap}>
      <View style={s.toggleRow}>
        <Text style={s.toggleLabel}>Highlight better results</Text>
        <Switch
          value={highlight}
          onValueChange={setHighlight}
          trackColor={{ true: colors.lime, false: colors.borderFocus }}
          ios_backgroundColor={colors.borderFocus}
        />
      </View>
      <View style={s.tRow}>
        <View style={s.tLabelCol} />
        <Text style={[s.tHead, s.tCol]} onPress={() => router.push(`/run/${a.id}`)}>{fmtDate(a.date).toUpperCase()} ›</Text>
        <Text style={[s.tHead, s.tCol]} onPress={() => router.push(`/run/${b.id}`)}>{fmtDate(b.date).toUpperCase()} ›</Text>
      </View>
      {COMPARE_METRICS.map(m => {
        const va = m.get(a, starts)
        const vb = m.get(b, starts)
        const better = highlight ? betterValue(m, a, b, starts) : null
        return (
          <View key={m.label} style={[s.tRow, s.tDivider]}>
            <Text style={[s.tLabel, s.tLabelCol]}>{m.label}</Text>
            <Text style={[s.tCol, s.tValA, better === 'a' && s.tBetter]}>{va == null ? '—' : m.fmt(va, UNIT)}</Text>
            <Text style={[s.tCol, s.tValB, better === 'b' && s.tBetter]}>{vb == null ? '—' : m.fmt(vb, UNIT)}</Text>
          </View>
        )
      })}
    </View>
  )
}

// Run comparison from the Strides Figma: pick A/B on top, results fill in below.
export function CompareView({ initialA = null, initialB = null, topPad = 14 }: {
  initialA?: Run | null
  initialB?: Run | null
  topPad?: number
}) {
  const [slots, setSlots] = useState<Record<Slot, Run | null>>({ a: initialA, b: initialB })
  const [picking, setPicking] = useState<Slot | null>(null)
  const { a, b } = slots
  const other = picking === 'a' ? b : picking === 'b' ? a : null

  return (
    <>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: topPad }]}>
        <View style={s.header}>
          <Text style={s.title}>See how you’re growing.</Text>
          <Text style={s.subtitle}>Two runs. A little more perspective.</Text>
        </View>

        <View style={s.selectors}>
          {a && b && <Text style={s.kicker}>{distanceLabel(a, b)}</Text>}
          <View style={s.slots}>
            <SlotCard slot="a" run={a} onPress={() => setPicking('a')} />
            <SlotCard slot="b" run={b} onPress={() => setPicking('b')} />
          </View>
        </View>

        {a && b ? (
          <>
            <PaceChart a={a} b={b} />
            <Text style={s.headline}>{fmtDate(a.date)} vs {fmtDate(b.date)}</Text>
            <MetricsTable a={a} b={b} />
            <View style={s.takeaway}>
              <Text style={s.takeawayText}>{paceTakeaway(a, b)}</Text>
            </View>
          </>
        ) : (
          <Text style={s.hint}>Pick two runs to compare.</Text>
        )}
      </ScrollView>

      <Modal visible={picking !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(null)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select run {picking?.toUpperCase()}</Text>
            <TouchableOpacity onPress={() => setPicking(null)} hitSlop={8}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <RunPickerList
            onPressRun={run => {
              if (picking) setSlots(prev => ({ ...prev, [picking]: run }))
              setPicking(null)
            }}
            disabledIds={other ? [other.id] : []}
          />
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  content:  { paddingHorizontal: 24, paddingBottom: 32, gap: 22 },
  header:   { gap: 6 },
  title:    { fontFamily: fonts.body, fontSize: 25, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },

  selectors: { gap: 12 },
  kicker:    { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.3 },
  slots:     { flexDirection: 'row', gap: 16 },
  slot:      { flex: 1, minHeight: 110, borderRadius: 20, backgroundColor: colors.bgSurface, padding: 15, gap: 8 },
  slotTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slotLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  slotLabel: { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  chevron:   { fontSize: 12, color: colors.textPrimary },
  slotDate:  { fontFamily: fonts.body, fontSize: 21, fontWeight: '600', color: colors.textPrimary },
  slotMeta:  { fontFamily: fonts.mono, fontSize: 11, fontWeight: '500', color: colors.textPrimary },
  slotEmpty: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, marginTop: 8 },
  hint:      { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  chartCard:  { backgroundColor: colors.accent, borderRadius: 26, padding: 20, gap: 10 },
  chartTitle: { fontFamily: fonts.body, fontSize: 17, fontWeight: '600', color: colors.ink },
  legend:     { flexDirection: 'row', alignItems: 'center', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendLine: { width: 15, height: 3, borderRadius: 1 },
  legendText: { fontFamily: fonts.body, fontSize: 10, fontWeight: '500', color: colors.ink },
  legendUnit: { marginLeft: 'auto', opacity: 0.85 },
  axisTitle:  { fontFamily: fonts.body, fontSize: 10, fontWeight: '500', color: colors.ink, opacity: 0.85, textAlign: 'center' },

  headline:   { fontFamily: fonts.body, fontSize: 17, fontWeight: '600', color: colors.textPrimary, marginBottom: -8 },
  tableWrap:  { gap: 0 },
  toggleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  toggleLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  tRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  tDivider:   { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  tLabelCol:  { flex: 1.3 },
  tCol:       { flex: 1 },
  tHead:      { fontFamily: fonts.body, fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  tLabel:     { fontFamily: fonts.body, fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  tValA:      { fontFamily: fonts.mono, fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  tValB:      { fontFamily: fonts.mono, fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  tBetter:    { color: colors.lime, fontWeight: '700' },

  takeaway:     { backgroundColor: colors.lime, borderRadius: 17, paddingVertical: 16, paddingHorizontal: 17 },
  takeawayText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.ink },

  modal:       { flex: 1, backgroundColor: colors.bgApp },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  modalTitle:  { fontFamily: fonts.body, fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  close:       { fontFamily: fonts.body, fontSize: 18, color: colors.textSecondary },
})
