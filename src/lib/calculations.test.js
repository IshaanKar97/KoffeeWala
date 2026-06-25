import { describe, it, expect } from 'vitest'
import { calcV60, calcFilter, calculate, defaultBloom } from './calculations.js'

// Helper: the last step's cumulative reading must equal the exact target.
const lastCumulative = (r) => r.steps[r.steps.length - 1].cumulative

describe('V60 — 3-pour (no ice)', () => {
  it('matches Logic.md Example 1 (20 g, ratio 16, fixed bloom)', () => {
    const r = calcV60({ method: '3-pour', dose: 20, ratio: 16 })
    expect(r.valid).toBe(true)
    expect(r.total).toBe(320)
    expect(r.bloomWater).toBe(40) // fixed 2 × dose
    expect(r.withIce).toBe(false)
    // pours 93, 93, 94 (last absorbs remainder)
    expect(r.steps.map((s) => s.add)).toEqual([40, 93, 93, 94])
    expect(r.steps.map((s) => s.cumulative)).toEqual([40, 133, 226, 320])
  })

  it('ignores a bloom override for presets (bloom fixed, PRD R-2.1.c)', () => {
    const r = calcV60({ method: '3-pour', dose: 20, ratio: 16, bloom: 50 })
    expect(r.bloomWater).toBe(40)
  })

  it('cumulative total always equals the target (no drift)', () => {
    for (let dose = 10; dose <= 30; dose += 0.5) {
      const r = calcV60({ method: '3-pour', dose, ratio: 16 })
      if (r.valid) expect(lastCumulative(r)).toBe(r.target)
    }
  })
})

describe('V60 — 3-pour (with ice)', () => {
  it('matches Logic.md Example 3 (20 g, ratio 16, ice factor 0.4)', () => {
    const r = calcV60({ method: '3-pour', dose: 20, ratio: 16, iceOn: true, iceFactor: 0.4 })
    expect(r.valid).toBe(true)
    expect(r.total).toBe(320)
    expect(r.ice).toBe(128)
    expect(r.brewWater).toBe(192)
    expect(r.bloomWater).toBe(40)
    // remaining 152 → 51, 51, 50 (last absorbs remainder)
    expect(r.steps.map((s) => s.add)).toEqual([40, 51, 51, 50])
    expect(r.steps.map((s) => s.cumulative)).toEqual([40, 91, 142, 192])
  })

  it('cumulative total equals brew water across a range', () => {
    for (let dose = 12; dose <= 30; dose += 0.5) {
      const r = calcV60({ method: '3-pour', dose, ratio: 16, iceOn: true, iceFactor: 0.4 })
      if (r.valid) expect(lastCumulative(r)).toBe(r.brewWater)
    }
  })

  it('rejects an ice factor that leaves brew water below bloom', () => {
    const r = calcV60({ method: '3-pour', dose: 20, ratio: 16, iceOn: true, iceFactor: 0.9 })
    expect(r.valid).toBe(false)
  })
})

describe('V60 — 1-pour', () => {
  it('bloom + a single pour for the remaining water', () => {
    const r = calcV60({ method: '1-pour', dose: 20, ratio: 16 })
    expect(r.valid).toBe(true)
    expect(r.nPours).toBe(1)
    expect(r.steps.map((s) => s.add)).toEqual([40, 280])
    expect(r.steps.map((s) => s.cumulative)).toEqual([40, 320])
  })
})

describe('V60 — 10-pour', () => {
  it('bloom + 10 equal pours, last absorbs remainder', () => {
    const r = calcV60({ method: '10-pour', dose: 20, ratio: 16 })
    expect(r.valid).toBe(true)
    expect(r.nPours).toBe(10)
    expect(r.steps.length).toBe(11) // bloom + 10
    // remaining 280 over 10 = 28 each, no remainder
    expect(r.steps.slice(1).map((s) => s.add)).toEqual([28, 28, 28, 28, 28, 28, 28, 28, 28, 28])
    expect(lastCumulative(r)).toBe(320)
  })

  it('still hits the exact target with an awkward remainder', () => {
    const r = calcV60({ method: '10-pour', dose: 21, ratio: 16 }) // total 336, bloom 42, remaining 294
    expect(lastCumulative(r)).toBe(r.target)
  })
})

describe('V60 — Advanced', () => {
  it('editable bloom + N pours, equal split (total = dose × ratio by default)', () => {
    const r = calcV60({ method: 'advanced', dose: 20, ratio: 16, bloom: 60, nPours: 4 })
    expect(r.valid).toBe(true)
    expect(r.bloomWater).toBe(60) // editable in Advanced
    expect(r.nPours).toBe(4)
    // remaining 260 over 4 = 65 each
    expect(r.steps.slice(1).map((s) => s.add)).toEqual([65, 65, 65, 65])
    expect(lastCumulative(r)).toBe(320)
  })

  it('a directly-entered total overrides the ratio (PRD R-2.1.d)', () => {
    const r = calcV60({ method: 'advanced', dose: 20, ratio: 16, totalWater: 300, bloom: 40, nPours: 2 })
    expect(r.total).toBe(300) // not 320 from ratio
    expect(r.steps.slice(1).map((s) => s.add)).toEqual([130, 130])
    expect(lastCumulative(r)).toBe(300)
  })

  it('ice uses the entered total (ice = total × factor)', () => {
    const r = calcV60({ method: 'advanced', dose: 20, totalWater: 300, bloom: 40, nPours: 2, iceOn: true, iceFactor: 0.4 })
    expect(r.ice).toBe(120)
    expect(r.brewWater).toBe(180)
    expect(lastCumulative(r)).toBe(180)
  })

  it('rejects a non-positive pour count', () => {
    expect(calcV60({ method: 'advanced', dose: 20, ratio: 16, nPours: 0 }).valid).toBe(false)
  })
})

describe('Filter — With Milk', () => {
  it('single full pour, no bloom (20 g, water ratio 5, milk ratio 3)', () => {
    const r = calcFilter({ method: 'with-milk', dose: 20, waterRatio: 5, milkRatio: 3 })
    expect(r.valid).toBe(true)
    expect(r.total).toBe(100)
    expect(r.milk).toBe(60)
    expect(r.dilutionWater).toBeUndefined()
    expect(r.bloomWater).toBeNull() // no bloom (client decision 2026-06-26)
    // one pour of the full decoction water
    expect(r.steps.map((s) => s.label)).toEqual(['Pour'])
    expect(r.steps.map((s) => s.add)).toEqual([100])
    expect(r.steps.map((s) => s.cumulative)).toEqual([100])
  })
})

describe('Filter — With Water', () => {
  it('decoction (single pour) + dilution water = dose × dilution ratio (default 4)', () => {
    const r = calcFilter({ method: 'with-water', dose: 20, waterRatio: 5, dilutionRatio: 4 })
    expect(r.valid).toBe(true)
    expect(r.total).toBe(100) // decoction unchanged
    expect(r.dilutionWater).toBe(80)
    expect(r.milk).toBeUndefined()
    expect(r.bloomWater).toBeNull()
    expect(r.steps.map((s) => s.cumulative)).toEqual([100])
  })
})

describe('Dispatcher + validation', () => {
  it('routes by instrument', () => {
    expect(calculate({ instrument: 'v60', method: '3-pour', dose: 20, ratio: 16 }).total).toBe(320)
    expect(calculate({ instrument: 'filter', method: 'with-milk', dose: 20 }).total).toBe(100)
    expect(calculate({ instrument: 'mokka' }).valid).toBe(false)
  })

  it('flags a missing/zero dose', () => {
    expect(calcV60({ method: '3-pour', dose: 0 }).valid).toBe(false)
    expect(calcV60({ method: '3-pour' }).valid).toBe(false)
  })

  it('defaultBloom is 2 × dose', () => {
    expect(defaultBloom(20)).toBe(40)
  })
})
