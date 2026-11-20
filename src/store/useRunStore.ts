import { create } from 'zustand'
import { MOCK_RUNS } from '../mockData'
import { diffEdits, rowToRun, seedRows } from '../db/merge'
import { getRunRow, loadRuns, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import type { Run, RunEdits } from '../types'
import { useRunTypeStore } from './useRunTypeStore'

type State = {
  runs: Run[]  // newest first, edits already applied
  load: () => void
  reset: () => void
  editRun: (id: string, patch: RunEdits) => void
  seedSampleRuns: () => string | null  // dev only; returns an error message or null
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

  seedSampleRuns: () => {
    const types = useRunTypeStore.getState().types
    if (types.length === 0) return 'Run types not loaded yet. Connect to the internet and try again.'
    for (const row of seedRows(MOCK_RUNS, types)) writeChange('runs', 'insert', { ...row })
    get().load()
    syncNow()
    return null
  },
}))
