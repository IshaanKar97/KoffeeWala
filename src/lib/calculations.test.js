import { describe, it, expect } from 'vitest'
import { calcV60NoIce, calcV60Ice, calcFilter } from './calculations.js'

// Helper: the last step's cumulative reading must equal the exact target.
const lastCumulative = (r) => r.steps[r.steps.length - 1].cumulative

describe('Mode A — V60 Without Ice', () => {
  it('matches Logic.md Example 1 (20 g, ratio 16, default bloom)', () => {
    const r = calcV60NoIce({ dose: 20, ratio: 16 })
    expect(r.valid).toBe(true)
    expect(r.total).toBe(320)
    expect(r.bloomWater).toBe(40)
    // pours 93, 93, 94 (last absorbs remainder)
    expect(r.steps.map((s) => s.add)).toEqual([40, 93, 93, 94])
    expect(r.steps.map((s) => s.cumulative)).toEqual([40, 133, 226, 320])
  })

  it('matches Logic.md Example 2 (edited bloom 50 g, no remainder)', () => {
    const r = calcV60NoIce({ dose: 20, ratio: 16, bloom: 50 })
    expect(r.steps.map((s) => s.add)).toEqual([50, 90, 90, 90])
    expect(r.steps.map((s) => s.cumulative)).toEqual([50, 140, 230, 320])
  })

  it('cumulative total always equals the target (no drift)', () => {
    for (let dose = 10; dose <= 30; dose += 0.5) {
      const r = calcV60NoIce({ dose, ratio: 16 })
      if (r.valid) expect(lastCumulative(r)).toBe(r.target)
    }
  })
})

describe('Mode B — V60 With Ice', () => {
  it('matches Logic.md Example 3 (20 g, ratio 16, ice factor 0.4)', () => {
    const r = calcV60Ice({ dose: 20, ratio: 16, iceFactor: 0.4 })
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
      const r = calcV60Ice({ dose, ratio: 16, iceFactor: 0.4 })
      if (r.valid) expect(lastCumulative(r)).toBe(r.brewWater)
    }
  })

  it('rejects an ice factor that leaves brew water below bloom', () => {
    const r = calcV60Ice({ dose: 20, ratio: 16, iceFactor: 0.9 })
    expect(r.valid).toBe(false)
  })
})

describe('Mode C — South Indian Filter Coffee', () => {
  it('matches Logic.md Example 4 (20 g, water ratio 5, milk ratio 3)', () => {
    const r = calcFilter({ dose: 20, waterRatio: 5, milkRatio: 3 })
    expect(r.valid).toBe(true)
    expect(r.total).toBe(100)
    expect(r.milk).toBe(60)
    expect(r.bloomWater).toBe(40)
    expect(r.steps.map((s) => s.add)).toEqual([40, 60])
    expect(r.steps.map((s) => s.cumulative)).toEqual([40, 100])
  })
})

describe('Validation', () => {
  it('flags a missing/zero dose', () => {
    expect(calcV60NoIce({ dose: 0 }).valid).toBe(false)
    expect(calcV60NoIce({}).valid).toBe(false)
  })

  it('flags bloom >= total', () => {
    expect(calcV60NoIce({ dose: 20, ratio: 16, bloom: 320 }).valid).toBe(false)
  })
})
