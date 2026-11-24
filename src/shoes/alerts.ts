// RA-8: 90% / 100% pop-ups. Called after anything that can add distance to a shoe.
// One pop-up per call (the first shoe with a new level); alert_level remembers it (synced).
import { Alert } from 'react-native'
import { useRunStore } from '../store/useRunStore'
import { useShoeStore } from '../store/useShoeStore'
import { displayName, lowerLevels, popupLevel, shoeDistance, type ShoeRow } from './shoes'

/** Save a shoe edit (Edit screen, past-runs step). A new limit / extra km lowers the remembered
 *  alert levels (so alerts can fire again later), then the 90% / 100% check runs. */
export function editShoe(id: string, patch: Partial<Omit<ShoeRow, 'id'>>) {
  const { shoes, update } = useShoeStore.getState()
  const shoe = shoes.find(s => s.id === id)
  if (!shoe) return
  const levels = 'limit_km' in patch || 'extra_km' in patch
    ? lowerLevels({ ...shoe, ...patch }, shoeDistance({ ...shoe, ...patch }, useRunStore.getState().runs))
    : {}
  update(id, { ...patch, ...levels })
  checkShoeAlerts()
}

export function checkShoeAlerts() {
  const runs = useRunStore.getState().runs
  const { shoes, update, retire } = useShoeStore.getState()
  for (const shoe of shoes) {
    const dist = shoeDistance(shoe, runs)
    const l = popupLevel(shoe, dist)
    if (!l) continue
    update(shoe.id, { alert_level: l })
    const name = displayName(shoe)
    const km = `${Math.round(dist)} / ${Math.round(shoe.limit_km)} km`
    if (l === 90) {
      Alert.alert(`${name} is at ${Math.floor((dist / shoe.limit_km) * 100)}%`, `${km}. Time to get a new pair.`)
    } else {
      Alert.alert(`${name} has reached its limit`, km, [
        { text: 'Close', style: 'cancel' },
        { text: 'Retire', onPress: () => retire(shoe.id) },
      ])
    }
    return
  }
}

/** Delete with confirmation (Edit screen, swipe left in My Shoes). onCancel e.g. closes the swipe. */
export function confirmDeleteShoe(shoe: ShoeRow, onDeleted?: () => void, onCancel?: () => void) {
  Alert.alert(`Delete ${displayName(shoe)}?`, "Its runs lose this shoe. This can't be undone. To keep its history, retire it instead.", [
    { text: 'Cancel', style: 'cancel', onPress: onCancel },
    { text: 'Delete', style: 'destructive', onPress: () => { useShoeStore.getState().remove(shoe.id); onDeleted?.() } },
  ])
}
