// Data layer for the Recipe Logbook (Phase 2 — Supabase).
//
// Talks directly to Supabase from the browser via supabase-js. Per-user access is
// enforced by Row-Level Security: every query is scoped to the signed-in user, and
// `user_id` defaults to auth.uid() server-side — so the client never sends it.
//
// The exported API (saveBrew / listBrews / updateBrew / deleteBrew) keeps the same
// flat brew-object shape the UI already uses; the mapping helpers below bridge that
// shape to the `brews` table (snake_case columns + a `pours` JSONB array).
import { supabase, isSupabaseConfigured } from './supabase.js'

const NOT_CONFIGURED = "Logbook unavailable — Supabase isn't configured (set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)."

// --- mode ↔ schema bridge -------------------------------------------------
// The current calculator has three modes; the schema models them as
// instrument + with_ice (+ method, expanded in Tasks 4–6).
function methodToSchema(brewMethod) {
  switch (brewMethod) {
    case 'V60 - With Ice':
      return { instrument: 'v60', with_ice: true, method: null }
    case 'Filter Coffee':
      return { instrument: 'filter', with_ice: false, method: 'with-milk' }
    case 'V60 - No Ice':
    default:
      return { instrument: 'v60', with_ice: false, method: null }
  }
}
function schemaToMethod(row) {
  if (row.instrument === 'filter') return 'Filter Coffee'
  return row.with_ice ? 'V60 - With Ice' : 'V60 - No Ice'
}

const numOrNull = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
const strOrNull = (v) => (v == null || String(v) === '' ? null : String(v))

// Discrete pour fields (pour1Water/pour1Time … pour10*) → positional JSONB array.
// Trailing empty pours are trimmed; index alignment (pour N → pours[N-1]) is kept.
function packPours(p) {
  const pours = []
  let lastFilled = 0
  for (let i = 1; i <= 10; i++) {
    const water = numOrNull(p[`pour${i}Water`])
    const time = strOrNull(p[`pour${i}Time`])
    pours[i - 1] = { water, time }
    if (water != null || time != null) lastFilled = i
  }
  return pours.slice(0, lastFilled)
}
function unpackPours(pours, out) {
  ;(pours || []).forEach((pour, i) => {
    out[`pour${i + 1}Water`] = pour?.water ?? null
    out[`pour${i + 1}Time`] = pour?.time ?? null
  })
}

/** Brew payload (UI shape) → `brews` table row.
 *  Prefers the explicit Phase 2 fields (instrument/method/withIce + pours array)
 *  from the calculator; falls back to the legacy method-string + pour1-3 shape
 *  used by the logbook edit form. */
function brewToRow(p) {
  let instrument = p.instrument
  let method = p.method
  let withIce = p.withIce
  if (!instrument) {
    const schema = methodToSchema(p.brewMethod)
    instrument = schema.instrument
    method = schema.method
    withIce = schema.with_ice
  }
  const pours = Array.isArray(p.pours)
    ? p.pours.map((x) => ({ water: numOrNull(x.water), time: strOrNull(x.time) }))
    : packPours(p)
  return {
    name: strOrNull(p.brewName),
    instrument,
    method: method ?? null,
    with_ice: !!withIce,
    coffee_g: numOrNull(p.coffee),
    ratio: numOrNull(p.ratio),
    total_water_g: numOrNull(p.totalWater),
    bloom_water_g: numOrNull(p.bloomWater),
    bloom_time: strOrNull(p.bloomTimeStr),
    brew_water_g: numOrNull(p.brewWater),
    ice_g: numOrNull(p.ice),
    ice_factor: numOrNull(p.iceFactor),
    milk_g: numOrNull(p.milk),
    milk_ratio: numOrNull(p.milkRatio),
    dilution_ratio: numOrNull(p.dilutionRatio),
    dilution_water_g: numOrNull(p.dilutionWater),
    drawdown_time: strOrNull(p.drawdownTime),
    grind_size: strOrNull(p.grindSize),
    water_temp: strOrNull(p.waterTemp),
    rating: numOrNull(p.rating),
    notes: strOrNull(p.notes),
    pours,
  }
}

/** `brews` table row → brew object (UI shape).
 *  Emits the Phase 2 fields (instrument/methodId/withIce + full pours array) plus
 *  the legacy flat fields (`method` display string, pour1-3) the current logbook
 *  list/edit still reads (full recipe-book rework is Task 7). */
function rowToBrew(row) {
  const out = {
    id: row.id,
    name: row.name || '',
    instrument: row.instrument,
    methodId: row.method,
    withIce: !!row.with_ice,
    method: schemaToMethod(row), // legacy display string
    createdAt: row.created_at || null,
    date: row.created_at ? row.created_at.slice(0, 10) : '',
    coffee: row.coffee_g,
    ratio: row.ratio,
    totalWater: row.total_water_g,
    bloomWater: row.bloom_water_g,
    brewWater: row.brew_water_g,
    ice: row.ice_g,
    iceFactor: row.ice_factor,
    milk: row.milk_g,
    milkRatio: row.milk_ratio,
    dilutionRatio: row.dilution_ratio,
    dilutionWater: row.dilution_water_g,
    rating: row.rating,
    notes: row.notes || '',
    grindSize: row.grind_size || '',
    waterTemp: row.water_temp || '',
    bloomTime: row.bloom_time || '',
    drawdownTime: row.drawdown_time || '',
    pours: Array.isArray(row.pours) ? row.pours : [],
  }
  unpackPours(row.pours, out)
  return out
}

/** Insert one brew for the signed-in user. Resolves with the saved brew or throws. */
export async function saveBrew(payload) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED)
  const { data, error } = await supabase.from('brews').insert(brewToRow(payload)).select().single()
  if (error) throw new Error(error.message)
  return rowToBrew(data)
}

/** List a page of the signed-in user's brews, newest first (Supabase range
 *  pagination). Resolves with { brews, total } or throws. */
export async function listBrews({ limit = 25, offset = 0 } = {}) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED)
  const { data, error, count } = await supabase
    .from('brews')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return { brews: (data || []).map(rowToBrew), total: count ?? null }
}

/** Update an existing brew (payload must include `id`). Resolves with the brew or throws. */
export async function updateBrew(payload) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED)
  const { id, ...rest } = payload
  if (!id) throw new Error('Cannot update a brew without an id.')
  const { data, error } = await supabase.from('brews').update(brewToRow(rest)).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return rowToBrew(data)
}

/** Permanently delete a brew by id. Resolves on success or throws. */
export async function deleteBrew(id) {
  if (!isSupabaseConfigured) throw new Error(NOT_CONFIGURED)
  if (!id) throw new Error('Cannot delete a brew without an id.')
  const { error } = await supabase.from('brews').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
