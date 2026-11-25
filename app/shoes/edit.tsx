// RA-8 Add / Edit shoe. Brand → model from the catalogue (each list ends with "Other…" → typed),
// colour, name, in use from, limit (prefilled, editable), default-for run types (existing shoe). A new shoe goes on to "default for which
// runs?", then (past "in use from" with runs to offer) the past-runs step. Edit can retire or delete.
import { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'
import { fetchCatalogue, type CatalogueBrand } from '../../src/api/shoes'
import { ListPicker } from '../../src/components/ListPicker'
import { ColorDot, ShoeLogo } from '../../src/components/ShoeLogo'
import { confirmDeleteShoe, editShoe } from '../../src/shoes/alerts'
import { COLOR_KEYS, GENERIC_KM, pastRunCandidates, type ColorKey } from '../../src/shoes/shoes'
import { useRunStore } from '../../src/store/useRunStore'
import { useRunTypeStore } from '../../src/store/useRunTypeStore'
import { useShoeStore } from '../../src/store/useShoeStore'
import { fmtDate } from '../../src/utils/format'
import { isoDate } from '../../src/utils/profile'
import { buttons, colors, fonts } from '../../src/utils/tokens'

const today = () => isoDate(new Date())

export default function EditShoe() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const existing = useShoeStore(s => s.shoes.find(x => x.id === id))
  const { add, retire, unretire } = useShoeStore.getState()
  const defaultFor = useRunTypeStore(s => s.types).filter(t => existing && t.defaultShoeId === existing.id).map(t => t.name)

  const [catalogue, setCatalogue] = useState<CatalogueBrand[] | null | 'loading'>('loading')
  const [brand, setBrand] = useState(existing?.brand ?? '')
  const [model, setModel] = useState(existing?.model ?? '')
  const [typedBrand, setTypedBrand] = useState(false)   // "Other…" chosen → text field
  const [typedModel, setTypedModel] = useState(false)
  const [color, setColor] = useState<ColorKey | null>(existing?.color ?? null)
  const [name, setName] = useState(existing?.name ?? '')
  const [from, setFrom] = useState(existing?.in_use_from ?? today())
  const [showDate, setShowDate] = useState(false)
  const [limit, setLimit] = useState(existing ? String(Math.round(existing.limit_km)) : '')
  const [limitTouched, setLimitTouched] = useState(!!existing)  // user's own number is never overwritten
  const [hint, setHint] = useState('')
  const [picker, setPicker] = useState<'brand' | 'model' | null>(null)

  useEffect(() => { fetchCatalogue().then(c => {
    setCatalogue(c)
    if (!existing || !c) return
    const b = c.find(x => x.name === existing.brand)
    if (!b) { setTypedBrand(true); setTypedModel(true) }
    else if (!b.models.some(m => m.name === existing.model)) setTypedModel(true)
  }) }, [])
  const offline = catalogue === null
  const brandEntry = Array.isArray(catalogue) ? catalogue.find(b => b.name === brand) : undefined

  const prefill = (km: number, text: string) => {
    setHint(text)
    if (!limitTouched) setLimit(String(km))
  }
  const pickBrand = (b: CatalogueBrand) => { setBrand(b.name); setTypedBrand(false); setModel(''); setTypedModel(false); setHint(''); setPicker(null) }
  const pickModel = (m: { name: string; km: number }) => {
    setModel(m.name); setTypedModel(false); setPicker(null)
    prefill(m.km, `Recommended for ${m.name}: ${m.km} km`)
  }
  const otherModel = () => {
    setModel(''); setTypedModel(true); setPicker(null)
    prefill(GENERIC_KM, `Typical for running shoes: ${GENERIC_KM} km`)
  }

  const save = () => {
    const limitKm = Number(limit.replace(',', '.'))
    if (!brand.trim() || !model.trim()) return Alert.alert('Brand and model are needed.')
    if (!(limitKm > 0)) return Alert.alert('Set a limit in km.')
    const fields = { brand: brand.trim(), model: model.trim(), name: name.trim() || null, color, in_use_from: from, limit_km: limitKm }
    if (existing) {
      editShoe(existing.id, fields)  // lowers remembered alert levels + runs the 90% / 100% check
      return router.back()
    }
    const newId = add(fields)
    const offer = from < today() && pastRunCandidates(from, useRunStore.getState().runs).length > 0
    router.replace({ pathname: '/shoes/defaults', params: { id: newId, ...(offer ? { then: 'past-runs' } : {}) } })
  }

  const confirmDelete = () => { if (existing) confirmDeleteShoe(existing, () => router.back()) }

  const toggleRetire = () => {
    if (!existing) return
    if (existing.retired) { unretire(existing.id); return router.back() }
    Alert.alert(`Retire ${existing.model}?`, 'It keeps its runs and moves to the Retired list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Retire', style: 'destructive', onPress: () => { retire(existing.id); router.back() } },
    ])
  }

  const brandField = typedBrand || offline
  const modelField = typedModel || brandField || (brandEntry && brandEntry.models.length === 0)

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingTop: 28 }]} keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <View style={s.head}>
        <Text style={s.title}>{existing ? 'Edit shoe' : 'Add shoe'}</Text>
        <TouchableOpacity style={buttons.outline} onPress={() => router.back()}><Text style={buttons.outlineText}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={buttons.primary} onPress={save}><Text style={buttons.primaryText}>Save</Text></TouchableOpacity>
      </View>
      {offline && <Text style={s.note}>Catalogue unavailable — type brand and model.</Text>}

      <Text style={s.label}>Brand</Text>
      {brandField ? (
        <TextInput style={s.input} value={brand} onChangeText={setBrand} placeholder="Brand" placeholderTextColor={colors.textGhost} />
      ) : (
        <TouchableOpacity style={s.input} onPress={() => setPicker('brand')} disabled={catalogue === 'loading'}>
          {brand ? <ShoeLogo brand={brand} size={24} /> : null}
          <Text style={brand ? s.value : s.placeholder}>{brand || (catalogue === 'loading' ? 'Loading…' : 'Choose brand')}</Text>
          <Text style={s.chev}>›</Text>
        </TouchableOpacity>
      )}

      <Text style={s.label}>Model</Text>
      {modelField ? (
        <TextInput style={s.input} value={model} onChangeText={setModel} placeholder="Model"
          placeholderTextColor={colors.textGhost}
          onFocus={() => { if (!hint) prefill(GENERIC_KM, `Typical for running shoes: ${GENERIC_KM} km`) }} />
      ) : (
        <TouchableOpacity style={s.input} onPress={() => setPicker('model')} disabled={!brand}>
          <Text style={model ? s.value : s.placeholder}>{model || 'Choose model'}</Text>
          <Text style={s.chev}>›</Text>
        </TouchableOpacity>
      )}

      <Text style={s.label}>Colour (optional)</Text>
      <View style={s.swatches}>
        {COLOR_KEYS.map(c => (
          <TouchableOpacity key={c} onPress={() => setColor(color === c ? null : c)} style={[s.swatch, color === c && s.swatchOn]}>
            <ColorDot color={c} size={24} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Name (optional)</Text>
      <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Pegasus 42 race pair" placeholderTextColor={colors.textGhost} />

      <Text style={s.label}>In use from</Text>
      <TouchableOpacity style={s.input} onPress={() => setShowDate(v => !v)}>
        <Text style={s.value}>{from === today() ? 'Today' : fmtDate(from)}</Text><Text style={s.chev}>›</Text>
      </TouchableOpacity>
      {showDate && (
        <DateTimePicker mode="date" display="spinner" themeVariant="dark" maximumDate={new Date()}
          value={new Date(from + 'T12:00:00')}
          onChange={(_, d) => { if (d) setFrom(isoDate(d)) }} />
      )}

      <Text style={s.label}>Limit</Text>
      <View style={s.input}>
        <TextInput style={[s.value, s.mono, { flex: 1 }]} value={limit} keyboardType="number-pad"
          onChangeText={t => { setLimit(t); setLimitTouched(t !== '') }} placeholder="700" placeholderTextColor={colors.textGhost} />
        <Text style={s.value}>km</Text>
      </View>
      {!!hint && <Text style={s.hint}>{hint}</Text>}

      {existing && (
        <>
          <Text style={s.label}>Default for</Text>
          <TouchableOpacity style={s.input} onPress={() => router.push({ pathname: '/shoes/defaults', params: { id: existing.id } })}>
            <Text style={defaultFor.length ? s.value : s.placeholder} numberOfLines={1}>{defaultFor.join(', ') || 'No run types'}</Text>
            <Text style={s.chev}>›</Text>
          </TouchableOpacity>
        </>
      )}

      {existing && (
        <TouchableOpacity style={[buttons.outline, s.retire]} onPress={toggleRetire}>
          <Text style={buttons.outlineText}>{existing.retired ? 'Un-retire' : 'Retire shoe'}</Text>
        </TouchableOpacity>
      )}
      {existing && (
        <TouchableOpacity style={s.delete} onPress={confirmDelete} hitSlop={8}>
          <Text style={s.deleteText}>Delete shoe</Text>
        </TouchableOpacity>
      )}

      {Array.isArray(catalogue) && (
        <>
          <ListPicker visible={picker === 'brand'} title="Brand" items={catalogue} label={b => b.name}
            left={b => <ShoeLogo brand={b.name} size={28} />} onPick={pickBrand}
            onOther={() => {
              setBrand(''); setTypedBrand(true); setModel(''); setTypedModel(true); setPicker(null)
              prefill(GENERIC_KM, `Typical for running shoes: ${GENERIC_KM} km`)
            }}
            onClose={() => setPicker(null)} />
          <ListPicker visible={picker === 'model'} title={brand} items={brandEntry?.models ?? []} label={m => m.name}
            onPick={pickModel} onOther={otherModel} onClose={() => setPicker(null)} />
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: colors.bgApp },
  content:     { paddingHorizontal: 18, paddingBottom: 60 },
  head:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title:       { flex: 1, fontFamily: fonts.body, fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  note:        { fontFamily: fonts.body, fontSize: 12, color: colors.iconOrange, marginBottom: 6 },
  label:       { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 14, marginBottom: 6, marginLeft: 4 },
  input:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgElevated, borderWidth: 1,
                 borderColor: colors.borderStrong, borderRadius: 12, paddingHorizontal: 12, minHeight: 44,
                 fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary },
  value:       { fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary },
  placeholder: { fontFamily: fonts.body, fontSize: 15, color: colors.textGhost },
  mono:        { fontFamily: fonts.mono },
  chev:        { marginLeft: 'auto', color: colors.textGhost, fontSize: 18 },
  hint:        { fontFamily: fonts.body, fontSize: 11, color: colors.textGhost, marginTop: 4, marginLeft: 4 },
  swatches:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch:      { padding: 3, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  swatchOn:    { borderColor: colors.lime },
  retire:      { marginTop: 30, alignSelf: 'center' },
  delete:      { marginTop: 18, alignSelf: 'center' },
  deleteText:  { fontFamily: fonts.body, fontSize: 13, color: colors.danger },
})
