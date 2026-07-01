// Grind-size model: grinders + grade/micron/clicks conversions.
//
// Universal: grade <-> microns (200µm bands, 0–1400, per the Honest Coffee Guide
// chart https://honestcoffeeguide.com/coffee-grind-size-chart/).
// Grinder-specific: clicks <-> microns (each grinder has a max click count and a
// microns-per-click; conversions are approximate — the source data is itself a
// guide, and µmPerClick is editable per grinder).

export const MICRON_MIN = 0
export const MICRON_MAX = 1400

export const GRADES = [
  { name: 'Extra Fine', min: 0, max: 200 },
  { name: 'Fine', min: 200, max: 400 },
  { name: 'Medium Fine', min: 400, max: 600 },
  { name: 'Medium', min: 600, max: 800 },
  { name: 'Medium Coarse', min: 800, max: 1000 },
  { name: 'Coarse', min: 1000, max: 1200 },
  { name: 'Extra Coarse', min: 1200, max: 1400 },
]

// Seed repository — Timemore + Comandante (client scope, 2026-06-29). Timemore
// C3S grounded from the guide (0–950µm over ~25 clicks ≈ 38µm/click); Comandante
// ≈ 30µm/click (widely documented). Approximate; per-grinder µmPerClick editable.
export const SEED_GRINDERS = [
  { id: 'timemore-c3s', brand: 'Timemore', model: 'C3S', clicks: 25, umPerClick: 38 },
  { id: 'timemore-c3', brand: 'Timemore', model: 'C3', clicks: 25, umPerClick: 38 },
  { id: 'timemore-c3-esp', brand: 'Timemore', model: 'C3 ESP', clicks: 25, umPerClick: 30 },
  { id: 'timemore-c2', brand: 'Timemore', model: 'C2', clicks: 25, umPerClick: 38 },
  { id: 'timemore-c5', brand: 'Timemore', model: 'C5', clicks: 30, umPerClick: 36 },
  { id: 'comandante-c40', brand: 'Comandante', model: 'C40 MK4', clicks: 40, umPerClick: 30 },
  { id: 'comandante-c60', brand: 'Comandante', model: 'C60 Baracuda', clicks: 40, umPerClick: 30 },
  { id: 'comandante-x25', brand: 'Comandante', model: 'X25 Trailmaster', clicks: 40, umPerClick: 30 },
]
export const DEFAULT_GRINDER_ID = 'timemore-c3s'
export const GRINDER_BRANDS = [...new Set(SEED_GRINDERS.map((g) => g.brand))]
export const defaultGrinder = () => SEED_GRINDERS.find((g) => g.id === DEFAULT_GRINDER_ID)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const grinderLabel = (g) => (g ? `${g.brand} ${g.model}` : '—')
export const grinderMaxMicrons = (g) => Math.round(g.clicks * g.umPerClick)

export const clicksToMicrons = (g, clicks) => clamp(Math.round(clicks * g.umPerClick), 0, MICRON_MAX)
export const micronsToClicks = (g, um) => clamp(Math.round(um / g.umPerClick), 0, g.clicks)

export function gradeFromMicrons(um) {
  const c = clamp(um, MICRON_MIN, MICRON_MAX)
  const band = GRADES.find((b) => c >= b.min && c < b.max) || GRADES[GRADES.length - 1]
  return band.name
}
export function micronsFromGrade(name) {
  const b = GRADES.find((x) => x.name === name) || GRADES[3]
  return Math.round((b.min + b.max) / 2)
}

/** Readable one-line summary stored on a brew, e.g.
 *  "Medium · ~600µm · 16 clicks (Timemore C3S)". */
export function grindSummary(microns, grinder) {
  if (microns == null || Number.isNaN(microns)) return ''
  const parts = [gradeFromMicrons(microns), `~${microns}µm`]
  if (grinder) parts.push(`${micronsToClicks(grinder, microns)} clicks (${grinderLabel(grinder)})`)
  return parts.join(' · ')
}
/** Pull the canonical microns back out of a stored summary (for Re-brew). */
export function micronsFromSummary(str) {
  const m = String(str || '').match(/~?(\d+)\s*µm/)
  return m ? Number(m[1]) : null
}

/** Make a custom grinder from a name + max clicks + max microns. */
export function makeCustomGrinder(name, clicks, maxMicrons) {
  const c = Math.max(1, Math.round(clicks) || 1)
  const um = Math.max(1, Math.round(maxMicrons) || 1)
  return {
    id: `custom-${Date.now()}`,
    brand: 'Custom',
    model: name || 'My grinder',
    clicks: c,
    umPerClick: Math.round((um / c) * 10) / 10,
    custom: true,
  }
}
