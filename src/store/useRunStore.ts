import { create } from 'zustand'
import { diffEdits, rowToRun } from '../db/merge'
import { getRunRow, loadRuns, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import { checkShoeAlerts } from '../shoes/alerts'
import { defaultFill } from '../shoes/shoes'
import type { Run, RunEdits } from '../types'
import { useRunTypeStore } from './useRunTypeStore'
import { activeShoes, useShoeStore } from './useShoeStore'

type State = {
  runs: Run[]  // newest first, edits already applied
  load: () => void
  reset: () => void
  editRun: (id: string, patch: RunEdits) => void
  /** RA-39: set the type of one or many runs; also answers the Dashboard "needs a type" card. Never renames. */
  setType: (ids: string[], typeId: string | null) => void
  /** RA-8: set the shoe of one or many runs (null clears). Can raise a shoe alert. */
  setShoe: (ids: string[], shoeId: string | null) => void
}

export const useRunStore = create<State>((set, get) => ({
  runs: [],
  load: () => set({ runs: loadRuns().map(rowToRun) }),
  reset: () => set({ runs: [] }),

  editRun: (id, patch) => {
    const row = getRunRow(id)
    if (!row) return
    const edits = diffEdits(rowToRun({ ...row, edits: {} }), row.edits, patch)
    writeChange('runs', 'update', { id, edits })
    get().load()
    syncNow()
  },

  // ponytail: one outbox op + one HTTP update per run (like the first import); bulk RPC only if it proves slow
  setType: (ids, typeId) => {
    // RA-8: a run without a shoe takes the type's default shoe (never replaces an existing one)
    const def = typeId ? useRunTypeStore.getState().typeMap[typeId]?.defaultShoeId : null
    const active = new Set(activeShoes(useShoeStore.getState().shoes).map(s => s.id))
    for (const id of ids) {
      const current = getRunRow(id)?.shoe_id ?? null  // SQLite, not memory: an existing shoe must never be replaced
      const shoe = defaultFill(current, def, active)
      writeChange('runs', 'update', { id, type_id: typeId, needs_type: false })
      // own op: if the shoe's push ever fails, the type change still reaches the cloud
      if (shoe !== current) writeChange('runs', 'update', { id, shoe_id: shoe })
    }
    get().load()
    syncNow()
    checkShoeAlerts()
  },

  setShoe: (ids, shoeId) => {
    for (const id of ids) writeChange('runs', 'update', { id, shoe_id: shoeId })
    get().load()
    syncNow()
    checkShoeAlerts()
  },
}))
