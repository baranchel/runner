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
}))
