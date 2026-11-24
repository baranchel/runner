// RA-8: the shared brand/model catalogue and brand logos. Fetched only when Add shoe opens (not stored).
import { supabase } from './supabase'
import { logoFile } from '../shoes/shoes'

export interface CatalogueBrand { name: string; models: { name: string; km: number }[] }

/** Brands in picker order, models A–Z. null = offline / error (the user types brand and model). */
export async function fetchCatalogue(): Promise<CatalogueBrand[] | null> {
  try {
    const query = supabase.from('shoe_brands').select('name, sort, shoe_models(name, recommended_km)').order('sort')
    const timeout = new Promise<null>(r => setTimeout(() => r(null), 8000))
    const res = await Promise.race([query, timeout])
    if (!res || res.error || !res.data) return null
    const data = res.data
    return data.map((b: { name: string; shoe_models: { name: string; recommended_km: number }[] | null }) => ({
      name: b.name,
      models: (b.shoe_models ?? []).map(m => ({ name: m.name, km: m.recommended_km }))
        .sort((x, y) => x.name.localeCompare(y.name)),
    }))
  } catch {
    return null
  }
}

/** Public URL of a brand's logo (may 404 until Bar uploads it → the caller shows initials). */
export const logoUrl = (brand: string) => supabase.storage.from('brand-logos').getPublicUrl(logoFile(brand)).data.publicUrl
