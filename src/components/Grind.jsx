import { useRef, useState } from 'react'
import {
  GRADES, MICRON_MAX, SEED_GRINDERS, GRINDER_BRANDS,
  grinderLabel, clicksToMicrons, micronsToClicks, gradeFromMicrons, micronsFromGrade, makeCustomGrinder,
} from '../lib/grinders.js'

const FORMATS = [
  { id: 'clicks', label: 'Clicks' },
  { id: 'grade', label: 'Grade' },
  { id: 'microns', label: 'Microns' },
]

// ---- circular grinder dial (clicks) --------------------------------------
// A rotary knob that feels like setting a grinder's adjustment ring, flanked by
// −/+ steppers for single-click precision. Clicks map 0…maxClicks over a 270°
// arc (90° dead zone at the bottom). Drag the knob or use the buttons/arrow keys.
const DIAL_START = -135 // 7-o'clock
const DIAL_SWEEP = 270
const polar = (r, aDeg) => {
  const a = (aDeg * Math.PI) / 180
  return { x: 50 + r * Math.sin(a), y: 50 - r * Math.cos(a) }
}
const arcPath = (r, a1, a2) => {
  const p1 = polar(r, a1)
  const p2 = polar(r, a2)
  const large = a2 - a1 > 180 ? 1 : 0
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
}

function CircularGrindDial({ clicks, maxClicks, isSet, onChange }) {
  const svgRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const max = maxClicks > 0 ? maxClicks : 40
  const angleFor = (c) => DIAL_START + (Math.max(0, Math.min(max, c)) / max) * DIAL_SWEEP
  const cur = angleFor(clicks)
  const set = (c) => onChange(Math.max(0, Math.min(max, Math.round(c))))

  const clicksFromPointer = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    let ang = (Math.atan2(dx, -dy) * 180) / Math.PI // degrees from top, clockwise
    if (ang > 135) ang = 135
    else if (ang < -135) ang = -135
    return ((ang - DIAL_START) / DIAL_SWEEP) * max
  }
  const onDown = (e) => { svgRef.current.setPointerCapture(e.pointerId); setDragging(true); set(clicksFromPointer(e)) }
  const onMove = (e) => { if (dragging) set(clicksFromPointer(e)) }
  const onUp = (e) => { setDragging(false); try { svgRef.current.releasePointerCapture(e.pointerId) } catch { /* noop */ } }
  const onKey = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); set(clicks + 1) }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); set(clicks - 1) }
  }

  const ticks = []
  for (let i = 0; i <= max; i++) {
    const major = i % 5 === 0
    const a = angleFor(i)
    const o = polar(46, a)
    const inr = polar(major ? 38 : 42, a)
    ticks.push(<line key={i} x1={o.x} y1={o.y} x2={inr.x} y2={inr.y} style={{ stroke: i <= clicks ? 'var(--color-espresso)' : 'var(--color-line)' }} strokeWidth={major ? 1.4 : 0.7} strokeLinecap="round" />)
  }
  const knobEdge = polar(30, cur)
  const knobTip = polar(15, cur)

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => set(clicks - 1)}
        disabled={clicks <= 0}
        aria-label="Coarser (fewer clicks)"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-xl font-medium text-roast hover:border-espresso hover:text-espresso disabled:opacity-40"
      >−</button>

      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        role="slider"
        tabIndex={0}
        aria-label="Grind size (clicks)"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clicks}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onKeyDown={onKey}
        className="h-32 w-32 cursor-pointer touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-espresso/40"
        style={{ borderRadius: '9999px' }}
      >
        {/* track + progress */}
        <path d={arcPath(43, DIAL_START, DIAL_START + DIAL_SWEEP)} fill="none" style={{ stroke: 'var(--color-line)' }} strokeWidth="3" strokeLinecap="round" />
        {isSet && <path d={arcPath(43, DIAL_START, cur)} fill="none" style={{ stroke: 'var(--color-espresso)' }} strokeWidth="3" strokeLinecap="round" />}
        {ticks}
        {/* knob body */}
        <circle cx="50" cy="50" r="31" style={{ fill: 'var(--color-surface2)', stroke: 'var(--color-line)' }} strokeWidth="1.5" />
        {/* pointer notch */}
        <line x1={knobTip.x} y1={knobTip.y} x2={knobEdge.x} y2={knobEdge.y} style={{ stroke: 'var(--color-espresso)' }} strokeWidth="3.5" strokeLinecap="round" />
        {/* center readout */}
        <text x="50" y="49" textAnchor="middle" style={{ fill: 'var(--color-roast)', fontSize: '17px', fontWeight: 700 }}>{isSet ? clicks : '—'}</text>
        <text x="50" y="61" textAnchor="middle" style={{ fill: 'var(--color-muted)', fontSize: '7px', letterSpacing: '0.08em' }}>CLICKS</text>
      </svg>

      <button
        type="button"
        onClick={() => set(clicks + 1)}
        disabled={clicks >= max}
        aria-label="Finer (more clicks)"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-xl font-medium text-roast hover:border-espresso hover:text-espresso disabled:opacity-40"
      >+</button>
    </div>
  )
}

// ---- reference chart modal -----------------------------------------------
export function GrindChartModal({ grinder, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-roast/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-roast">Grind size chart</h3>
          <button onClick={onClose} className="text-muted hover:text-roast">✕</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-1.5 font-medium">Grade</th>
              <th className="py-1.5 text-right font-medium">Microns</th>
              {grinder && <th className="py-1.5 text-right font-medium">Clicks ({grinderLabel(grinder)})</th>}
            </tr>
          </thead>
          <tbody>
            {GRADES.map((b) => (
              <tr key={b.name} className="border-b border-line last:border-0">
                <td className="py-1.5 font-medium text-roast">{b.name}</td>
                <td className="py-1.5 text-right tabular-nums text-muted">{b.min}–{b.max} µm</td>
                {grinder && (
                  <td className="py-1.5 text-right tabular-nums text-muted">
                    {micronsToClicks(grinder, b.min)}–{micronsToClicks(grinder, b.max)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Grade ↔ micron bands are universal; clicks are estimated for the selected grinder and are approximate. Source:{' '}
          <a href="https://honestcoffeeguide.com/coffee-grind-size-chart/" target="_blank" rel="noreferrer" className="font-medium text-espresso hover:underline">Honest Coffee Guide ↗</a>
        </p>
      </div>
    </div>
  )
}

// ---- grinder picker (brand → model, or custom) ---------------------------
export function GrinderPicker({ onPick, onClose }) {
  const [brand, setBrand] = useState(GRINDER_BRANDS[0])
  const [custom, setCustom] = useState(false)
  const [name, setName] = useState('')
  const [clicks, setClicks] = useState('40')
  const [maxMicrons, setMaxMicrons] = useState('1200')

  const models = SEED_GRINDERS.filter((g) => g.brand === brand)
  const addCustom = () => {
    if (!name.trim()) return
    onPick(makeCustomGrinder(name.trim(), parseFloat(clicks), parseFloat(maxMicrons)))
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-roast/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-roast">Add a grinder</h3>
          <button onClick={onClose} className="text-muted hover:text-roast">✕</button>
        </div>

        {!custom ? (
          <>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {GRINDER_BRANDS.map((b) => (
                <button key={b} onClick={() => setBrand(b)} className={`rounded-full border px-3 py-0.5 text-xs font-medium ${brand === b ? 'border-espresso bg-espresso text-white' : 'border-line bg-surface text-muted hover:border-espresso'}`}>{b}</button>
              ))}
            </div>
            <div className="space-y-1">
              {models.map((g) => (
                <button key={g.id} onClick={() => onPick(g)} className="flex w-full items-center justify-between rounded-lg border border-line bg-surface2 px-3 py-2 text-left text-sm hover:border-espresso">
                  <span className="font-medium text-roast">{g.model}</span>
                  <span className="text-xs text-muted">{g.clicks} clicks · ~{Math.round(g.clicks * g.umPerClick)}µm</span>
                </button>
              ))}
            </div>
            <button onClick={() => setCustom(true)} className="mt-3 text-sm font-medium text-espresso hover:underline">+ Add a grinder not listed</button>
          </>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-xs font-medium text-muted">Grinder name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 1Zpresso JX-Pro" className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-roast outline-none focus:border-espresso" />
            </label>
            <div className="flex gap-3">
              <label className="block flex-1">
                <span className="block text-xs font-medium text-muted">Max clicks</span>
                <input type="number" min="1" value={clicks} onChange={(e) => setClicks(e.target.value)} onWheel={(e) => e.currentTarget.blur()} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-roast outline-none focus:border-espresso" />
              </label>
              <label className="block flex-1">
                <span className="block text-xs font-medium text-muted">Microns at max</span>
                <input type="number" min="1" value={maxMicrons} onChange={(e) => setMaxMicrons(e.target.value)} onWheel={(e) => e.currentTarget.blur()} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-roast outline-none focus:border-espresso" />
              </label>
            </div>
            <p className="text-xs text-muted">Used to convert clicks ↔ microns for this grinder (≈ {Math.round(((parseFloat(maxMicrons) || 0) / (parseFloat(clicks) || 1)) * 10) / 10} µm/click).</p>
            <div className="flex gap-2">
              <button onClick={() => setCustom(false)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted hover:border-roast">Back</button>
              <button onClick={addCustom} className="rounded-lg bg-espresso px-3 py-1.5 text-sm font-medium text-white hover:bg-espresso-700">Add grinder</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- the grind-size input -------------------------------------------------
export function GrindInput({ grind, setGrind, grinder, grinders, setActiveGrinderId, onAddGrinder }) {
  const [chartOpen, setChartOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)

  const microns = grind?.microns ?? null
  const format = grind?.format || 'clicks'
  const setFormat = (f) => setGrind({ format: f, microns })
  const setMicrons = (um) => setGrind({ format, microns: um == null ? null : Math.max(0, Math.min(MICRON_MAX, Math.round(um))) })

  const clicks = microns != null && grinder ? micronsToClicks(grinder, microns) : 0

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-roast">Grind size <span className="font-normal text-muted">(optional)</span></span>
        <button onClick={() => setChartOpen(true)} className="text-xs font-medium text-espresso hover:underline">View chart</button>
      </div>

      {/* Active grinder + change */}
      <div className="relative mt-1">
        <button onClick={() => setChangeOpen((o) => !o)} className="flex items-center gap-1 rounded-lg border border-line bg-surface2 px-2.5 py-1 text-xs font-medium text-roast hover:border-espresso">
          {grinderLabel(grinder)} <span className="text-muted">▾</span>
        </button>
        {changeOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setChangeOpen(false)} />
            <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg border border-line bg-surface p-1 shadow-lg">
              {grinders.map((g) => (
                <button key={g.id} onClick={() => { setActiveGrinderId(g.id); setChangeOpen(false) }} className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-tint ${g.id === grinder?.id ? 'font-semibold text-espresso' : 'text-roast'}`}>
                  {grinderLabel(g)}
                </button>
              ))}
              <button onClick={() => { setChangeOpen(false); setPickerOpen(true) }} className="mt-1 block w-full rounded border-t border-line px-2 py-1.5 text-left text-sm font-medium text-espresso hover:bg-tint">+ Add new grinder</button>
            </div>
          </>
        )}
      </div>

      {/* Format selector */}
      <div className="mt-2 inline-flex rounded-lg border border-line bg-surface p-0.5">
        {FORMATS.map((f) => (
          <button key={f.id} onClick={() => setFormat(f.id)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${format === f.id ? 'bg-espresso text-white' : 'text-muted hover:text-roast'}`}>{f.label}</button>
        ))}
      </div>

      {/* Value control per format */}
      <div className="mt-2">
        {format === 'clicks' && (
          <CircularGrindDial
            clicks={clicks}
            maxClicks={grinder?.clicks ?? 40}
            isSet={microns != null}
            onChange={(c) => setMicrons(clicksToMicrons(grinder, c))}
          />
        )}
        {format === 'grade' && (
          <select value={microns == null ? '' : gradeFromMicrons(microns)} onChange={(e) => setMicrons(e.target.value ? micronsFromGrade(e.target.value) : null)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-roast outline-none focus:border-espresso">
            <option value="">— Not set —</option>
            {GRADES.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        )}
        {format === 'microns' && (
          <div className="flex items-center rounded-lg border border-line bg-surface focus-within:border-espresso">
            <input type="number" inputMode="numeric" min="0" max={MICRON_MAX} value={microns ?? ''} placeholder="0–1400" onChange={(e) => setMicrons(e.target.value === '' ? null : Number(e.target.value))} onWheel={(e) => e.currentTarget.blur()} className="w-full bg-transparent px-3 py-2 text-sm text-roast outline-none" />
            <span className="px-3 text-sm text-muted">µm</span>
          </div>
        )}
      </div>

      {microns != null && (
        <p className="mt-1 text-xs text-muted">≈ {gradeFromMicrons(microns)} · ~{microns}µm · {grinder ? `${micronsToClicks(grinder, microns)} clicks` : ''}</p>
      )}

      {chartOpen && <GrindChartModal grinder={grinder} onClose={() => setChartOpen(false)} />}
      {pickerOpen && <GrinderPicker onPick={(g) => { onAddGrinder(g); setPickerOpen(false) }} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}
