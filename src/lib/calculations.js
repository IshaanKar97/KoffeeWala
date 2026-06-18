// Pure calculation module for the Coffee Brewing Calculator.
//
// Mirrors Logic.md (reconciled & approved 2026-06-19):
//   - All displayed water values are whole grams.
//   - For multi-pour modes, the FINAL pour absorbs the rounding remainder so
//     the cumulative total always equals the exact target (no rounding drift).
//   - The scale is tared to zero after the coffee is added; displayed pour
//     values are CUMULATIVE scale readings.

export const DEFAULTS = {
  v60: { ratio: 16, iceFactor: 0.4, bloomTime: '00:30' },
  filter: { waterRatio: 5, milkRatio: 3, bloomTime: '00:30', waterTempC: '80–85' },
}

const round = (x) => Math.round(x)

/** Default bloom water = 2 × dose (whole grams). */
export const defaultBloom = (dose) => round(dose * 2)

/** Split `remaining` into 3 whole-gram pours; the last absorbs the remainder. */
function threePours(remaining) {
  const each = round(remaining / 3)
  const p1 = each
  const p2 = each
  const p3 = remaining - p1 - p2 // absorbs rounding remainder
  return [p1, p2, p3]
}

function resolveBloom(dose, bloom) {
  return bloom == null || Number.isNaN(bloom) ? defaultBloom(dose) : round(bloom)
}

/**
 * Mode A — V60 Without Ice.
 * @returns {{valid:boolean, errors:string[], mode?:string, total?:number,
 *   bloomWater?:number, target?:number, steps?:Array}}
 */
export function calcV60NoIce({ dose, ratio = DEFAULTS.v60.ratio, bloom } = {}) {
  const errors = []
  if (!(dose > 0)) errors.push('Enter a coffee dose greater than 0 g.')
  if (!(ratio > 0)) errors.push('Ratio must be greater than 0.')
  if (errors.length) return { valid: false, errors }

  const total = round(dose * ratio)
  const bloomWater = resolveBloom(dose, bloom)
  if (!(bloomWater > 0)) errors.push('Bloom water must be greater than 0 g.')
  if (bloomWater >= total) errors.push('Bloom water must be less than total water.')
  if (errors.length) return { valid: false, errors }

  const remaining = total - bloomWater
  const [p1, p2, p3] = threePours(remaining)
  const steps = [
    { label: 'Bloom', add: bloomWater, cumulative: bloomWater },
    { label: 'Pour 1', add: p1, cumulative: bloomWater + p1 },
    { label: 'Pour 2', add: p2, cumulative: bloomWater + p1 + p2 },
    { label: 'Pour 3', add: p3, cumulative: bloomWater + p1 + p2 + p3 },
  ]
  return { valid: true, errors: [], mode: 'v60-no-ice', total, bloomWater, target: total, steps }
}

/**
 * Mode B — V60 With Ice. Total water stays constant; ice is derived and placed
 * in the serving vessel. Cumulative readings track hot brew water only.
 */
export function calcV60Ice({ dose, ratio = DEFAULTS.v60.ratio, iceFactor = DEFAULTS.v60.iceFactor, bloom } = {}) {
  const errors = []
  if (!(dose > 0)) errors.push('Enter a coffee dose greater than 0 g.')
  if (!(ratio > 0)) errors.push('Ratio must be greater than 0.')
  if (!(iceFactor > 0 && iceFactor < 1)) errors.push('Ice factor must be between 0 and 1.')
  if (errors.length) return { valid: false, errors }

  const total = round(dose * ratio)
  const ice = round(total * iceFactor)
  const brewWater = total - ice
  const bloomWater = resolveBloom(dose, bloom)
  if (!(bloomWater > 0)) errors.push('Bloom water must be greater than 0 g.')
  if (bloomWater >= brewWater) errors.push('Bloom water must be less than brew water (lower the ice factor or bloom).')
  if (errors.length) return { valid: false, errors }

  const remaining = brewWater - bloomWater
  const [p1, p2, p3] = threePours(remaining)
  const steps = [
    { label: 'Bloom', add: bloomWater, cumulative: bloomWater },
    { label: 'Pour 1', add: p1, cumulative: bloomWater + p1 },
    { label: 'Pour 2', add: p2, cumulative: bloomWater + p1 + p2 },
    { label: 'Pour 3', add: p3, cumulative: bloomWater + p1 + p2 + p3 },
  ]
  return { valid: true, errors: [], mode: 'v60-ice', total, ice, brewWater, bloomWater, target: brewWater, steps }
}

/**
 * Mode C — South Indian Filter Coffee (decoction).
 * Bloom + single main pour. Milk is a served quantity (not poured on the scale).
 */
export function calcFilter({ dose, waterRatio = DEFAULTS.filter.waterRatio, milkRatio = DEFAULTS.filter.milkRatio, bloom } = {}) {
  const errors = []
  if (!(dose > 0)) errors.push('Enter a coffee dose greater than 0 g.')
  if (!(waterRatio > 0)) errors.push('Water ratio must be greater than 0.')
  if (!(milkRatio >= 0)) errors.push('Milk ratio must be 0 or greater.')
  if (errors.length) return { valid: false, errors }

  const total = round(dose * waterRatio)
  const milk = round(dose * milkRatio)
  const bloomWater = resolveBloom(dose, bloom)
  if (!(bloomWater > 0)) errors.push('Bloom water must be greater than 0 g.')
  if (bloomWater >= total) errors.push('Bloom water must be less than total water.')
  if (errors.length) return { valid: false, errors }

  const mainPour = total - bloomWater
  const steps = [
    { label: 'Bloom', add: bloomWater, cumulative: bloomWater },
    { label: 'Main pour', add: mainPour, cumulative: bloomWater + mainPour },
  ]
  return { valid: true, errors: [], mode: 'filter', total, milk, bloomWater, target: total, steps }
}

/** Convenience dispatcher used by the UI. */
export function calculate(mode, inputs) {
  switch (mode) {
    case 'v60-no-ice':
      return calcV60NoIce(inputs)
    case 'v60-ice':
      return calcV60Ice(inputs)
    case 'filter':
      return calcFilter(inputs)
    default:
      return { valid: false, errors: [`Unknown mode: ${mode}`] }
  }
}
