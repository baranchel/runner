import { create } from 'zustand'
import { ensureProfileRow, loadProfile, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import { nextAutoHrMax, type ProfileRow } from '../utils/profile'

type Patch = Partial<Omit<ProfileRow, 'id' | 'updated_at'>>

type State = {
  profile: ProfileRow | null
  load: () => void
  reset: () => void
  save: (userId: string, patch: Patch) => void
  /** After an import: raise the auto HRmax if a run went higher (never touches a typed value). */
  bumpAutoHrMax: (runs: readonly { maxHr: number | null }[]) => void
}

export const useProfileStore = create<State>((set, get) => ({
  profile: null,
  load: () => set({ profile: loadProfile() }),
  reset: () => set({ profile: null }),

  save: (userId, patch) => {
    ensureProfileRow(userId)
    writeChange('profiles', 'update', { id: userId, ...patch })
    get().load()
    syncNow()
  },

  bumpAutoHrMax: runs => {
    const p = get().profile
    const next = p ? nextAutoHrMax(p, runs) : null
    if (p && next != null) get().save(p.id, { hr_max: next })
  },
}))
