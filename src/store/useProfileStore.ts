import { create } from 'zustand'
import { ensureProfileRow, loadProfile, writeChange } from '../db/queries'
import { syncNow } from '../db/sync'
import { useRunStore } from './useRunStore'
import { effectiveHrMax, nextAutoHrMax, type ProfileRow } from '../utils/profile'
import { zoneStarts, type Starts } from '../utils/zones'

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

/** The user's zone starts (Z2..Z5). Every screen that shows zones uses this, so a method change shows everywhere. */
export function useZoneStarts(): Starts {
  const profile = useProfileStore(s => s.profile)
  const runs = useRunStore(s => s.runs)
  return zoneStarts(profile, effectiveHrMax(profile, runs, new Date()))
}
