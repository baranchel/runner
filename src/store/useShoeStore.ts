// RA-8 shoes in memory. Every change goes through writeChange (local + outbox) then syncNow, like runs.
import * as Crypto from 'expo-crypto'
import { create } from 'zustand'
import { loadShoes, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import { shoeProblem, type ShoeRow } from '../shoes/shoes'
import { useRunStore } from './useRunStore'
import { useRunTypeStore } from './useRunTypeStore'

export type NewShoe = Pick<ShoeRow, 'brand' | 'model' | 'name' | 'color' | 'in_use_from' | 'limit_km'>

type State = {
  shoes: ShoeRow[]
  load: () => void
  reset: () => void
  add: (shoe: NewShoe) => string
  update: (id: string, patch: Partial<Omit<ShoeRow, 'id'>>) => void
  /** Retire: leaves the picker and every type's default; its runs keep it. */
  retire: (id: string) => void
  unretire: (id: string) => void
  /** Delete a shoe added by mistake: its runs and types lose it (cloud FKs do the same), then the row goes. */
  remove: (id: string) => void
}

export const useShoeStore = create<State>((set, get) => ({
  shoes: [],
  load: () => set({ shoes: loadShoes() }),
  reset: () => set({ shoes: [] }),
  add: shoe => {
    guard(shoe)
    const id = Crypto.randomUUID()
    writeChange('shoes', 'insert', { id, ...shoe, extra_km: 0, retired: false, alert_level: 0, card_dismissed: 0 })
    get().load()
    syncNow()
    return id
  },
  update: (id, patch) => {
    guard(patch)
    writeChange('shoes', 'update', { id, ...patch })
    get().load()
    syncNow()
  },
  retire: id => {
    writeChange('shoes', 'update', { id, retired: true })
    for (const t of useRunTypeStore.getState().types) {
      if (t.defaultShoeId === id) writeChange('run_types', 'update', { id: t.id, default_shoe_id: null })
    }
    useRunTypeStore.getState().load()
    get().load()
    syncNow()
  },
  unretire: id => get().update(id, { retired: false }),
  remove: id => {
    for (const r of useRunStore.getState().runs) if (r.shoeId === id) writeChange('runs', 'update', { id: r.id, shoe_id: null })
    for (const t of useRunTypeStore.getState().types) {
      if (t.defaultShoeId === id) writeChange('run_types', 'update', { id: t.id, default_shoe_id: null })
    }
    writeChange('shoes', 'delete', { id })
    useRunStore.getState().load()
    useRunTypeStore.getState().load()
    get().load()
    syncNow()
  },
}))

// Screens validate first; this only stops a bad op from entering the outbox (it would fail for good).
function guard(p: Partial<ShoeRow>) {
  const problem = shoeProblem(p)
  if (problem) throw new Error(`[shoes] ${problem}`)
}

export const activeShoes = (shoes: ShoeRow[]) => shoes.filter(s => !s.retired)
