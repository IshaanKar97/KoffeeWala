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
    // Full catalog profile (Phase 3 Feature #3 — Decision #67), carried onto
    // the bean when added from the Coffee Repository.
    roastery: row.roastery || '',
    originCountry: row.origin_country || '',
    originRegion: row.origin_region || '',
    originEstate: row.origin_estate || '',
    variety: row.variety || '',
    process: row.process || '',
    tastingNotes: row.tasting_notes || '',
    variants: row.variants || null,
    availability: row.availability || '',
    sourceUrl: row.source_url || '',
    source: row.source || 'user',
    createdAt: row.created_at,
  }
}

function rowToCatalogEntry(row) {
  return {
    id: row.id,
    brand: row.brand,
    coffeeName: row.coffee_name,
    lastAmount: row.last_amount_g,
    roastery: row.roastery || '',
    originCountry: row.origin_country || '',
    originRegion: row.origin_region || '',
    originEstate: row.origin_estate || '',
    altitude: row.altitude || '',
    variety: row.variety || '',
    process: row.process || '',
    roastLevel: row.roast_level || '',
    tastingNotes: row.tasting_notes || '',
    variants: row.variants || null,
    availability: row.availability || '',
    sourceUrl: row.source_url || '',
    source: row.source || 'user',
  }
}

/** List the signed-in user's beans, newest first. */
export async function listBeans() {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED)
  const { data, error } = await supabase.from('beans').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map(rowToBean)
}

/** Add a new bean (a bag of coffee); also upserts the shared catalog.
 *  Accepts the full optional catalog profile so a bean added via manual entry
 *  or the Add-Bean typeahead can carry it (Phase 3 Feature #3 — Decision #67). */
export async function addBean({
  brand, coffeeName, roastDate, amount, altitude, roastLevel, notes,
  roastery, originCountry, originRegion, originEstate, variety, process, tastingNotes,
  variants, availability, sourceUrl, source,
}) {
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
      roastery: roastery || null,
      origin_country: originCountry || null,
      origin_region: originRegion || null,
      origin_estate: originEstate || null,
      variety: variety || null,
      process: process || null,
      tasting_notes: tastingNotes || null,
      variants: variants || null,
      availability: availability || null,
      source_url: sourceUrl || null,
      source: source || 'user',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  await upsertCatalog(brand, coffeeName, amount)
  return rowToBean(data)
}

/** Add a bean directly from a Browse-Catalog entry — the fast path (§13.3):
 *  only Roast Date + Amount are asked; everything else carries over from the
 *  catalog record as-is (including provenance). Does not re-touch the catalog
 *  row (the entry already exists — no upsert needed). */
export async function addBeanFromCatalog(entry, { roastDate, amount }) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED)
  const { data, error } = await supabase
    .from('beans')
    .insert({
      brand: entry.brand,
      coffee_name: entry.coffeeName,
      roast_date: roastDate,
      initial_amount_g: amount,
      remaining_amount_g: amount,
      altitude: entry.altitude || null,
      roast_level: entry.roastLevel || null,
      roastery: entry.roastery || null,
      origin_country: entry.originCountry || null,
      origin_region: entry.originRegion || null,
      origin_estate: entry.originEstate || null,
      variety: entry.variety || null,
      process: entry.process || null,
      tasting_notes: entry.tastingNotes || null,
      variants: entry.variants || null,
      availability: entry.availability || null,
      source_url: entry.sourceUrl || null,
      source: entry.source || 'user',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
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

/** Exact (case-insensitive) Brand + Coffee Name match. Returns the full catalog
 *  profile (Phase 3 Feature #3 — Decision #67) so the Add-Bean form can prefill
 *  everything available — amount, roast level, altitude, origin, variety,
 *  process, tasting notes — from a scraped or user-submitted entry. */
export async function findCatalogMatch(brand, coffeeName) {
  if (!isSupabaseConfigured || !brand?.trim() || !coffeeName?.trim()) return null
  const { data, error } = await supabase
    .from('coffee_catalog')
    .select('*')
    .ilike('brand', brand.trim())
    .ilike('coffee_name', coffeeName.trim())
    .limit(1)
  if (error || !data?.length) return null
  const entry = rowToCatalogEntry(data[0])
  return { ...entry, amount: entry.lastAmount }
}

/** Browse/filter the shared Coffee Repository (§13.3) — every catalog entry,
 *  scraped or user-submitted. Filters are all optional and combine with AND;
 *  `search` matches brand, coffee name, or tasting notes (case-insensitive
 *  substring). Ordered by roastery/brand so entries from the same source
 *  group together. */
export async function browseCatalog({ search, roastLevel, altitude } = {}) {
  if (!isSupabaseConfigured) return []
  let query = supabase.from('coffee_catalog').select('*')
  if (roastLevel) query = query.eq('roast_level', roastLevel)
  if (altitude?.trim()) query = query.ilike('altitude', `%${altitude.trim()}%`)
  const { data, error } = await query.order('roastery', { ascending: true }).order('brand', { ascending: true })
  if (error) return []
  let rows = data || []
  const q = search?.trim().toLowerCase()
  if (q) {
    rows = rows.filter((r) =>
      r.brand?.toLowerCase().includes(q) ||
      r.coffee_name?.toLowerCase().includes(q) ||
      r.tasting_notes?.toLowerCase().includes(q)
    )
  }
  return rows.map(rowToCatalogEntry)
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

/** Beans with fewer than `thresholdDays` remaining (and an estimable usage
 *  rate). Threshold is user-configurable in Profile (default 7). */
export async function getLowStockBeans(beans, thresholdDays = 7) {
  const out = []
  for (const bean of beans) {
    const d = await daysRemaining(bean)
    if (d != null && d < thresholdDays) out.push({ bean, daysRemaining: d })
  }
  return out
}
