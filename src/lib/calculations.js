// Pure calculation module for the Coffee Brewing Calculator.
//
// Phase 2 (Instrument × Brewing Method). Mirrors Logic.md + the Phase 2 PRD §3:
//   - All displayed water values are whole grams.
//   - For multi-pour methods, the FINAL pour absorbs the rounding remainder so
//     the cumulative total always equals the exact target (no rounding drift).
//   - The scale is tared to zero after the coffee is added; displayed pour
//     values are CUMULATIVE scale readings.
//
// Instruments: 'v60' (methods 1-pour / 3-pour / 10-pour / advanced; ice toggle)
//              'filter' (methods with-milk / with-water)
//              'mokka' is a "coming soon" placeholder — no calc here.

export const DEFAULTS = {
  v60: { ratio: 16, iceFactor: 0.4, bloomTime: '00:30' },
  filter: { waterRatio: 5, milkRatio: 3, dilutionRatio: 4, bloomTime: '00:30', waterTempC: '80–85' },
}

// Fixed pour counts for the preset V60 methods; Advanced supplies its own N.
export const V60_POURS = { '1-pour': 1, '3-pour': 3, '10-pour': 10 }

const round = (x) => Math.round(x)

/** Default bloom water = 2 × dose (whole grams). */
export const defaultBloom = (dose) => round(dose * 2)

/** Split `remaining` into `n` whole-gram pours; the last absorbs the remainder. */
function splitPours(remaining, n) {
  const each = round(remaining / n)
  const pours = []
  let acc = 0
  for (let i = 0; i < n - 1; i++) {
    pours.push(each)
    acc += each
  }
  pours.push(remaining - acc) // last absorbs rounding remainder
  return pours
}

function resolveBloom(dose, bloom) {
  return bloom == null || Number.isNaN(bloom) ? defaultBloom(dose) : round(bloom)
}

/** Build [Bloom, Pour 1…N] steps with cumulative scale readings. */
function buildSteps(bloomWater, pours) {
  const steps = [{ label: 'Bloom', add: bloomWater, cumulative: bloomWater }]
  let cum = bloomWater
  pours.forEach((p, i) => {
    cum += p
    steps.push({ label: `Pour ${i + 1}`, add: p, cumulative: cum })
  })
  return steps
}

/**
 * V60 — any method (1-pour / 3-pour / 10-pour / advanced).
 *
 * Bloom is fixed to 2 × dose for the presets and editable only in Advanced
 * (PRD R-2.1.c). Ice is a toggle on every method (R-2.1.a): ice = total × factor,
 * brew water = total − ice, pours split the brew water. Advanced uses ratio by
 * default but a directly-entered total overrides the ratio (R-2.1.d).
 */
export function calcV60({
  method = '3-pour',
  dose,
  ratio = DEFAULTS.v60.ratio,
  iceOn = false,
  iceFactor = DEFAULTS.v60.iceFactor,
  bloom,
  totalWater, // Advanced only: explicit total overrides ratio when provided
  nPours, // Advanced only: number of pours after the bloom
} = {}) {
  const errors = []
  const advanced = method === 'advanced'
  if (!(dose > 0)) errors.push('Enter a coffee dose greater than 0 g.')

  // Total water: Advanced may enter it directly (overrides ratio); otherwise dose × ratio.
  let total
  const explicitTotal = advanced && totalWater != null && String(totalWater) !== '' && !Number.isNaN(totalWater)
  if (explicitTotal) {
    total = round(totalWater)
    if (!(total > 0)) errors.push('Total water must be greater than 0 g.')
  } else {
    if (!(ratio > 0)) errors.push('Ratio must be greater than 0.')
    total = round(dose * ratio)
  }

  if (iceOn && !(iceFactor > 0 && iceFactor < 1)) errors.push('Ice factor must be between 0 and 1.')

  // Pour count.
  let n
  if (advanced) {
    n = Math.trunc(Number(nPours))
    if (!(n >= 1)) errors.push('Number of pours must be a whole number ≥ 1.')
  } else {
    n = V60_POURS[method]
    if (!n) errors.push(`Unknown V60 method: ${method}`)
  }
  if (errors.length) return { valid: false, errors }

  const ice = iceOn ? round(total * iceFactor) : 0
  const target = total - ice // brew water (= total when no ice)
  const bloomWater = advanced ? resolveBloom(dose, bloom) : defaultBloom(dose)
  if (!(bloomWater > 0)) errors.push('Bloom water must be greater than 0 g.')
  if (bloomWater >= target) {
    errors.push(iceOn ? 'Bloom water must be less than brew water (lower the ice factor or bloom).' : 'Bloom water must be less than total water.')
  }
  if (errors.length) return { valid: false, errors }

  const steps = buildSteps(bloomWater, splitPours(target - bloomWater, n))
  return {
    valid: true,
    errors: [],
    instrument: 'v60',
    method,
    withIce: iceOn,
    total,
    ice: iceOn ? ice : undefined,
    iceFactor: iceOn ? iceFactor : undefined,
    brewWater: iceOn ? target : undefined,
    bloomWater,
    target,
    nPours: n,
    steps,
  }
}

/**
 * Filter Coffee — South Indian decoction. No bloom (client decision 2026-06-26):
 * a single pour of the full decoction water (dose × water ratio).
 *
 * With Milk (Phase 1): decoction (water ratio 5) + milk to serve (milk ratio 3).
 * With Water: decoction + a water-dilution amount = dose × dilution ratio
 * (default 4, editable). Milk/dilution are served quantities, not poured on the
 * scale.
 */
export function calcFilter({
  method = 'with-milk',
  dose,
  waterRatio = DEFAULTS.filter.waterRatio,
  milkRatio = DEFAULTS.filter.milkRatio,
  dilutionRatio = DEFAULTS.filter.dilutionRatio,
} = {}) {
  const errors = []
  const withWater = method === 'with-water'
  if (!(dose > 0)) errors.push('Enter a coffee dose greater than 0 g.')
  if (!(waterRatio > 0)) errors.push('Water ratio must be greater than 0.')
  if (withWater) {
    if (!(dilutionRatio >= 0)) errors.push('Water (dilution) ratio must be 0 or greater.')
  } else {
    if (!(milkRatio >= 0)) errors.push('Milk ratio must be 0 or greater.')
  }
  if (errors.length) return { valid: false, errors }

  const total = round(dose * waterRatio) // decoction water, poured in one go (no bloom)
  const steps = [{ label: 'Pour', add: total, cumulative: total }]
  const out = { valid: true, errors: [], instrument: 'filter', method, total, bloomWater: null, target: total, nPours: 1, steps }
  if (withWater) {
    out.dilutionRatio = dilutionRatio
    out.dilutionWater = round(dose * dilutionRatio)
  } else {
    out.milkRatio = milkRatio
    out.milk = round(dose * milkRatio)
  }
  return out
}

/** Dispatcher used by the UI: calculate({ instrument, method, ...inputs }). */
export function calculate({ instrument, ...inputs } = {}) {
  switch (instrument) {
    case 'v60':
      return calcV60(inputs)
    case 'filter':
      return calcFilter(inputs)
    default:
      return { valid: false, errors: [`Unknown instrument: ${instrument}`] }
  }
}
