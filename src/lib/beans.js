// Data layer for the Bean Repository (Phase 3 Feature #2 — Decision #65).
//
// `beans` is per-user (RLS-scoped, like `brews`). `coffee_catalog` is shared
// across ALL users (client-confirmed 2026-07-13) and powers independent
// Brand / Coffee-Name autocomplete + amount prefill on an exact match.
import { supabase, isSupabaseConfigured } from './supabase.js'

const NOT_CONFIGURED = "Bean repository unavailable — Supabase isn't configured."
const DAY_MS = 86400000

function rowToBean(row) {
  return {
    id: row.id,
    brand: row.brand,
    coffeeName: row.coffee_name,
    roastDate: row.roast_date,
    initialAmount: row.initial_amount_g,
    remaining: row.remaining_amount_g,
    altitude: row.altitude || '',
    roastLevel: row.roast_level || '',
    notes: row.notes || '',
    createdAt: row.created_at,
  }
}

/** List the signed-in user's beans, newest first. */
export async function listBeans() {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED)
  const { data, error } = await supabase.from('beans').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map(rowToBean)
}

/** Add a new bean (a bag of coffee); also upserts the shared catalog. */
export async function addBean({ brand, coffeeName, roastDate, amount, altitude, roastLevel, notes }) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED)
  const { data, error } = await supabase
    .from('beans')
    .insert({
      brand,
      coffee_name: coffeeName,
      roast_date: roastDate,
      initial_amount_g: amount,
      remaining_amount_g: amount,
      altitude: altitude || null,
      roast_level: roastLevel || null,
      notes: notes || null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  await upsertCatalog(brand, coffeeName, amount)
  return rowToBean(data)
}

/** Edit a bean's total (initial) and remaining amounts — the only user-editable
 *  bean fields (client decision 2026-07-13). */
export async function updateBeanAmounts(id, { initialAmount, remaining }) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED)
  const { data, error } = await supabase
    .from('beans')
    .update({ initial_amount_g: initialAmount, remaining_amount_g: remaining })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return rowToBean(data)
}

/** Replenish an existing bean (new bag of the same coffee) — increases both
 *  initial and remaining by the same amount so the usage rate stays accurate. */
export async function replenishBean(id, addAmount) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED)
  const { data: cur, error: e1 } = await supabase.from('beans').select('initial_amount_g, remaining_amount_g').eq('id', id).single()
  if (e1) throw new Error(e1.message)
  const initial_amount_g = (cur.initial_amount_g || 0) + addAmount
  const remaining_amount_g = (cur.remaining_amount_g || 0) + addAmount
  const { data, error } = await supabase.from('beans').update({ initial_amount_g, remaining_amount_g }).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return rowToBean(data)
}

/** Deduct a brew's dose from the selected bean's remaining amount (clamped at
 *  0 — never negative). Non-fatal: a deduction failure shouldn't block the brew save. */
export async function deductForBrew(beanId, doseG) {
  if (!isSupabaseConfigured || !beanId || !(doseG > 0)) return
  const { data: cur, error: e1 } = await supabase.from('beans').select('remaining_amount_g').eq('id', beanId).single()
  if (e1) return
  const remaining_amount_g = Math.max(0, (cur.remaining_amount_g || 0) - doseG)
  await supabase.from('beans').update({ remaining_amount_g }).eq('id', beanId)
}

// --- Global Coffee Catalog (shared) ---------------------------------------

/** Distinct brands in the catalog, for the Brand autocomplete. */
export async function searchCatalogBrands() {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('coffee_catalog').select('brand')
  if (error) return []
  return [...new Set((data || []).map((r) => r.brand).filter(Boolean))].sort()
}

/** Distinct coffee names in the catalog, for the Coffee Name autocomplete. */
export async function searchCatalogNames() {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('coffee_catalog').select('coffee_name')
  if (error) return []
  return [...new Set((data || []).map((r) => r.coffee_name).filter(Boolean))].sort()
}

/** Exact (case-insensitive) Brand + Coffee Name match. Returns the catalog
 *  profile so the Add-Bean form can prefill amount + roast level / altitude /
 *  notes from a scraped or user-submitted entry (Phase 3 feature #3). */
export async function findCatalogMatch(brand, coffeeName) {
  if (!isSupabaseConfigured || !brand?.trim() || !coffeeName?.trim()) return null
  const { data, error } = await supabase
    .from('coffee_catalog')
    .select('brand, coffee_name, last_amount_g, roast_level, altitude, tasting_notes')
    .ilike('brand', brand.trim())
    .ilike('coffee_name', coffeeName.trim())
    .limit(1)
  if (error || !data?.length) return null
  const r = data[0]
  return {
    brand: r.brand,
    coffeeName: r.coffee_name,
    amount: r.last_amount_g,
    roastLevel: r.roast_level || '',
    altitude: r.altitude || '',
    tastingNotes: r.tasting_notes || '',
  }
}

async function upsertCatalog(brand, coffeeName, amount) {
  if (!isSupabaseConfigured || !brand?.trim() || !coffeeName?.trim()) return
  const { data } = await supabase
    .from('coffee_catalog')
    .select('id')
    .ilike('brand', brand.trim())
    .ilike('coffee_name', coffeeName.trim())
    .limit(1)
  if (data?.length) {
    await supabase.from('coffee_catalog').update({ last_amount_g: amount, updated_at: new Date().toISOString() }).eq('id', data[0].id)
  } else {
    await supabase.from('coffee_catalog').insert({ brand: brand.trim(), coffee_name: coffeeName.trim(), last_amount_g: amount })
  }
}

// --- Low-stock reminder (Logic.md "Bean Inventory & Low-Stock Reminder") ---

/** Days remaining for one bean, from actual brew history (rolling average).
 *  Returns null when it can't be estimated yet (no brews logged against it). */
export async function daysRemaining(bean) {
  const totalUsed = (bean.initialAmount || 0) - (bean.remaining || 0)
  if (!(totalUsed > 0)) return null
  const { data, error } = await supabase
    .from('brews')
    .select('created_at')
    .eq('bean_id', bean.id)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error || !data?.length) return null
  const daysElapsed = Math.max(1, (Date.now() - new Date(data[0].created_at).getTime()) / DAY_MS)
  const avgDaily = totalUsed / daysElapsed
  if (!(avgDaily > 0)) return null
  return bean.remaining / avgDaily
}

/** Beans with <7 days remaining (and an estimable usage rate). */
export async function getLowStockBeans(beans) {
  const out = []
  for (const bean of beans) {
    const d = await daysRemaining(bean)
    if (d != null && d < 7) out.push({ bean, daysRemaining: d })
  }
  return out
}
