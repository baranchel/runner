import { create } from 'zustand'
import { diffEdits, rowToRun } from '../db/merge'
import { getRunRow, loadRuns, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import type { Run, RunEdits } from '../types'

type State = {
  runs: Run[]  // newest first, edits already applied
  load: () => void
  reset: () => void
  editRun: (id: string, patch: RunEdits) => void
  /** RA-39: set the type of one or many runs; also answers the Dashboard "needs a type" card. Never renames. */
  setType: (ids: string[], typeId: string | null) => void
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
    for (const id of ids) writeChange('runs', 'update', { id, type_id: typeId, needs_type: false })
    get().load()
    syncNow()
  },
}))
