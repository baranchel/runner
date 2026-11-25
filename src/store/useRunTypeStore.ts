import { create } from 'zustand'
import { loadRunTypes, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import type { RunType } from '../types'

type State = {
  types: RunType[]
  typeMap: Record<string, RunType>
  load: () => void
  reset: () => void
  /** RA-8: new runs of this type get this shoe (null clears). One default per type by construction. */
  setDefaultShoe: (typeId: string, shoeId: string | null) => void
}

export const useRunTypeStore = create<State>((set, get) => ({
  types: [],
  typeMap: {},
  load: () => {
    const types = loadRunTypes().map(({ id, name, hue, default_shoe_id }) => ({ id, name, hue, defaultShoeId: default_shoe_id ?? null }))
    set({ types, typeMap: Object.fromEntries(types.map(t => [t.id, t])) })
  },
  reset: () => set({ types: [], typeMap: {} }),
  setDefaultShoe: (typeId, shoeId) => {
    writeChange('run_types', 'update', { id: typeId, default_shoe_id: shoeId })
    get().load()
    syncNow()
  },
}))

export const useTypeMap = () => useRunTypeStore(s => s.typeMap)
