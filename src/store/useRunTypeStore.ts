import { create } from 'zustand'
import { loadRunTypes } from '../db/queries'
import type { RunType } from '../types'

type State = {
  types: RunType[]
  typeMap: Record<string, RunType>
  load: () => void
  reset: () => void
}

export const useRunTypeStore = create<State>(set => ({
  types: [],
  typeMap: {},
  load: () => {
    const types = loadRunTypes().map(({ id, name, hue }) => ({ id, name, hue }))
    set({ types, typeMap: Object.fromEntries(types.map(t => [t.id, t])) })
  },
  reset: () => set({ types: [], typeMap: {} }),
}))

export const useTypeMap = () => useRunTypeStore(s => s.typeMap)
