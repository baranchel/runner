// The only code that sends data rows to / reads them from Supabase. src/db/sync.ts drives it.
import { supabase } from './supabase'

export type PushResult = 'ok' | 'retry' | 'failed'

/** Send one outbox op. 'retry' = try again later (offline, expired session, server hiccup). */
export async function pushOp(
  tbl: string, kind: 'insert' | 'update', rowId: string, patch: Record<string, unknown>,
): Promise<PushResult> {
  const { updated_at: _ignored, ...row } = patch  // the server stamps updated_at itself
  try {
    let res
    if (kind === 'insert') {
      // ignoreDuplicates: a run already in the cloud is left as is (never overwrites type/notes/edits)
      res = await supabase.from(tbl).upsert(row, { onConflict: tbl === 'runs' ? 'user_id,id' : 'id', ignoreDuplicates: true })
    } else {
      res = await supabase.from(tbl).update(row).eq('id', rowId).select('id')
    }
    const { error, status } = res
    if (!error) {
      if (kind === 'update' && Array.isArray(res.data) && res.data.length === 0) {
        console.warn('[sync] update matched no row', tbl, rowId)
        return 'failed'
      }
      return 'ok'
    }
    if (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500) return 'retry'
    console.warn('[sync] rejected', tbl, kind, rowId, status, error.message)
    return 'failed'
  } catch {
    return 'retry'
  }
}

const PAGE = 1000           // Supabase returns at most 1000 rows per request
const OVERLAP_MS = 60_000   // re-read the last minute: server now() is transaction start, late commits land "in the past"

/** Rows changed after `since` (all rows when null), oldest first. null = request failed. */
export async function pullSince(tbl: string, since: string | null): Promise<Record<string, unknown>[] | null> {
  const rows: Record<string, unknown>[] = []
  let after: { t: string; id: string } | null = null
  try {
    for (;;) {
      let q = supabase.from(tbl).select('*').order('updated_at').order('id').limit(PAGE)
      if (after) q = q.or(`updated_at.gt."${after.t}",and(updated_at.eq."${after.t}",id.gt.${after.id})`)
      // Postgres sends microseconds (.123456); trim to ms so Hermes' Date.parse can't return NaN
      else if (since) q = q.gte('updated_at', new Date(Date.parse(since.replace(/(\.\d{3})\d+/, '$1')) - OVERLAP_MS).toISOString())
      const { data, error } = await q
      if (error) return null
      rows.push(...data)
      if (data.length < PAGE) return rows
      const last = data[data.length - 1]
      after = { t: String(last.updated_at), id: String(last.id) }
    }
  } catch {
    return null
  }
}
