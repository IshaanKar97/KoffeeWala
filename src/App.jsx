import { useEffect, useMemo, useState } from 'react'
import { calculate, defaultBloom, DEFAULTS, V60_POURS } from './lib/calculations.js'
import Field, { TimeField, Toggle, Stepper } from './components/Field.jsx'
import { useBrewTimer, fmt } from './lib/useBrewTimer.js'
import { saveBrew } from './lib/logbook.js'
import Logbook from './components/Logbook.jsx'
import { useAuth } from './context/AuthContext.jsx'
import AuthPanel from './components/AuthPanel.jsx'

// Instrument × Brewing Method model (PRD §3.1). Mokka-Pot is a disabled
// "coming soon" placeholder — no calc/DB/logic in Phase 2.
const INSTRUMENTS = [
  { id: 'v60', label: 'V60' },
  { id: 'filter', label: 'Filter Coffee' },
  { id: 'mokka', label: 'Mokka-Pot', disabled: true },
]
const V60_METHODS = [
  { id: '1-pour', label: '1-Pour' },
  { id: '3-pour', label: '3-Pour' },
  { id: '10-pour', label: '10-Pour' },
  { id: 'advanced', label: 'Advanced' },
]
const FILTER_METHODS = [
  { id: 'with-milk', label: 'With Milk' },
  { id: 'with-water', label: 'With Water' },
]
const METHOD_LABEL = {
  '1-pour': '1-Pour',
  '3-pour': '3-Pour',
  '10-pour': '10-Pour',
  advanced: 'Advanced',
  'with-milk': 'With Milk',
  'with-water': 'With Water',
}

// Lap-able timer steps for the current brew. The terminal step is not lapped
// manually — stopping the timer records its time (PRD §6.6).
function lapStepsFor(instrument, pourCount) {
  if (instrument === 'filter') {
    // No bloom for Filter (client decision 2026-06-26): single pour + drawdown.
    return [
      { key: 'pour1', label: 'Pour' },
      { key: 'drawdown', label: 'Drawdown end' },
    ]
  }
  const steps = [{ key: 'bloom', label: 'Bloom' }]
  for (let i = 1; i <= pourCount; i++) steps.push({ key: `pour${i}`, label: `Pour ${i}` })
  return steps
}

// App sections — side nav (desktop) / bottom nav (mobile).
const NAV_ITEMS = [
  { id: 'calculator', label: 'Brew', icon: '☕' },
  { id: 'logbook', label: 'Logbook', icon: '📖' },
]

const num = (s) => (s == null || String(s).trim() === '' ? undefined : parseFloat(s))
const round2 = (x) => Math.round(x * 100) / 100

const STORAGE_KEY = 'cbc-state-v2'
const DEFAULT_STATE = {
  instrument: 'v60',
  v60Method: '3-pour',
  filterMethod: 'with-milk',
  dose: '20',
  ratio: '16',
  iceOn: false,
  iceFactor: '0.4',
  advTotal: '',
  advBloom: '',
  advNPours: '3',
  waterRatio: '5',
  milkRatio: '3',
  dilutionRatio: '4',
  bloomTime: '00:30',
  grind: '',
  tempOn: false,
  waterTempC: '95',
}
const loadState = () => {
  try {
    return { ...DEFAULT_STATE, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function Stat({ label, value, accent = false }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${accent ? 'border-espresso/40 bg-tint' : 'border-line bg-surface'}`}>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-lg font-semibold text-roast">{value}</div>
    </div>
  )
}

export default function App() {
  const saved = useMemo(loadState, [])
  const [view, setView] = useState('calculator') // calculator | logbook
  const [instrument, setInstrument] = useState(saved.instrument)
  const [v60Method, setV60Method] = useState(saved.v60Method)
  const [filterMethod, setFilterMethod] = useState(saved.filterMethod)
  const [dose, setDose] = useState(saved.dose)
  const [ratio, setRatio] = useState(saved.ratio)
  const [iceOn, setIceOn] = useState(saved.iceOn)
  const [iceFactor, setIceFactor] = useState(saved.iceFactor)
  const [advTotal, setAdvTotal] = useState(saved.advTotal)
  const [advBloom, setAdvBloom] = useState(saved.advBloom)
  const [advNPours, setAdvNPours] = useState(saved.advNPours)
  const [waterRatio, setWaterRatio] = useState(saved.waterRatio)
  const [milkRatio, setMilkRatio] = useState(saved.milkRatio)
  const [dilutionRatio, setDilutionRatio] = useState(saved.dilutionRatio)
  const [bloomTime, setBloomTime] = useState(saved.bloomTime)
  const [grind, setGrind] = useState(saved.grind)
  const [tempOn, setTempOn] = useState(saved.tempOn)
  const [waterTempC, setWaterTempC] = useState(saved.waterTempC)
  const [copied, setCopied] = useState(false)
  const [rating, setRating] = useState('')
  const [notes, setNotes] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | warn | error
  const [saveError, setSaveError] = useState('')
  const [lastSavedSig, setLastSavedSig] = useState('')
  const { user, signOut } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)

  const method = instrument === 'v60' ? v60Method : filterMethod
  const isAdvanced = instrument === 'v60' && v60Method === 'advanced'
  const isV60Preset = instrument === 'v60' && v60Method !== 'advanced'

  // Number of pours after bloom — drives the timer rows (independent of validity).
  const pourCount = useMemo(() => {
    if (instrument === 'filter') return 1
    if (v60Method === 'advanced') return Math.max(0, Math.trunc(num(advNPours) || 0))
    return V60_POURS[v60Method]
  }, [instrument, v60Method, advNPours])

  const lapSteps = useMemo(() => lapStepsFor(instrument, pourCount), [instrument, pourCount])
  const terminalKey = lapSteps[lapSteps.length - 1].key
  const timer = useBrewTimer()

  // Reset the timer + captured laps when the brew shape changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => timer.clear(), [instrument, v60Method, filterMethod, pourCount])

  const inputs = useMemo(() => {
    if (instrument === 'filter') {
      return {
        instrument: 'filter',
        method: filterMethod,
        dose: num(dose),
        waterRatio: num(waterRatio),
        milkRatio: num(milkRatio),
        dilutionRatio: num(dilutionRatio),
      }
    }
    const base = { instrument: 'v60', method: v60Method, dose: num(dose), iceOn, iceFactor: num(iceFactor) }
    if (v60Method === 'advanced') {
      return { ...base, ratio: num(ratio), totalWater: num(advTotal), bloom: num(advBloom), nPours: num(advNPours) }
    }
    return { ...base, ratio: num(ratio) }
  }, [instrument, v60Method, filterMethod, dose, ratio, iceOn, iceFactor, advTotal, advBloom, advNPours, waterRatio, milkRatio, dilutionRatio])

  const result = useMemo(() => calculate(inputs), [inputs])

  // Inline validation: map each error to its input field (first message wins);
  // keep the last valid recipe on screen so bad input doesn't blank everything.
  const fieldErrors = useMemo(() => {
    const m = {}
    if (!result.valid) for (const e of result.errors) if (e.field && !m[e.field]) m[e.field] = e.message
    return m
  }, [result])
  const [lastValid, setLastValid] = useState(null)
  useEffect(() => {
    if (result.valid) setLastValid(result)
  }, [result])
  const shown = result.valid ? result : lastValid

  // Advanced: a directly-entered total water overrides the ratio.
  const advOverride = isAdvanced && num(advTotal) > 0
  const computedRatio = advOverride && num(dose) > 0 ? Math.round((num(advTotal) / num(dose)) * 10) / 10 : null

  // Errors whose field isn't a visible input (e.g. fixed-bloom vs total) get a small summary.
  const visibleFieldKeys = useMemo(() => {
    const keys = new Set(['dose'])
    if (instrument === 'filter') {
      keys.add('waterRatio')
      keys.add(filterMethod === 'with-milk' ? 'milkRatio' : 'dilutionRatio')
    } else {
      keys.add('ratio')
      if (iceOn) keys.add('iceFactor')
      if (isAdvanced) { keys.add('totalWater'); keys.add('nPours'); keys.add('bloom') }
    }
    return keys
  }, [instrument, filterMethod, iceOn, isAdvanced])
  const unmappedErrors = result.valid ? [] : result.errors.filter((e) => !visibleFieldKeys.has(e.field))

  // Soft warnings (D2): flag atypical-but-valid values without blocking the recipe.
  const fieldWarnings = useMemo(() => {
    const w = {}
    const out = (v, lo, hi) => v != null && (v < lo || v > hi)
    if (instrument === 'v60') {
      const r = num(ratio)
      if (out(r, 13, 20)) w.ratio = 'Unusual ratio — most V60 recipes are 15–18×.'
      if (iceOn) {
        const f = num(iceFactor)
        if (out(f, 0.25, 0.55)) w.iceFactor = 'Unusual — ice factor is typically 0.3–0.5×.'
      }
    } else {
      const wr = num(waterRatio)
      if (out(wr, 3, 8)) w.waterRatio = 'Unusual — decoction water ratio is typically 4–6×.'
      if (filterMethod === 'with-milk') {
        const mr = num(milkRatio)
        if (out(mr, 1, 5)) w.milkRatio = 'Unusual — milk ratio is typically 2–4×.'
      } else {
        const dr = num(dilutionRatio)
        if (out(dr, 2, 6)) w.dilutionRatio = 'Unusual — dilution ratio is typically 3–5×.'
      }
    }
    return w
  }, [instrument, filterMethod, ratio, iceOn, iceFactor, waterRatio, milkRatio, dilutionRatio])

  // Persist inputs across sessions.
  useEffect(() => {
    const state = {
      instrument, v60Method, filterMethod, dose, ratio, iceOn, iceFactor, advTotal, advBloom, advNPours,
      waterRatio, milkRatio, dilutionRatio, bloomTime, grind, tempOn, waterTempC,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore storage failures (private mode, quota) */
    }
  }, [instrument, v60Method, filterMethod, dose, ratio, iceOn, iceFactor, advTotal, advBloom, advNPours, waterRatio, milkRatio, dilutionRatio, bloomTime, grind, tempOn, waterTempC])

  const resetDefaults = () => {
    setRatio(DEFAULT_STATE.ratio)
    setIceOn(DEFAULT_STATE.iceOn)
    setIceFactor(DEFAULT_STATE.iceFactor)
    setAdvTotal(DEFAULT_STATE.advTotal)
    setAdvBloom(DEFAULT_STATE.advBloom)
    setAdvNPours(DEFAULT_STATE.advNPours)
    setWaterRatio(DEFAULT_STATE.waterRatio)
    setMilkRatio(DEFAULT_STATE.milkRatio)
    setDilutionRatio(DEFAULT_STATE.dilutionRatio)
    setBloomTime(DEFAULT_STATE.bloomTime)
    setGrind(DEFAULT_STATE.grind)
    setTempOn(DEFAULT_STATE.tempOn)
    setWaterTempC(DEFAULT_STATE.waterTempC)
  }

  const copyRecipe = async () => {
    if (!result.valid) return
    const lines = [`☕ ${instrument === 'v60' ? 'V60' : 'Filter Coffee'} — ${METHOD_LABEL[method]}${instrument === 'v60' && iceOn ? ' (Ice)' : ''}`]
    lines.push(`Dose ${num(dose)} g`)
    if (instrument === 'v60' && iceOn) lines.push(`Total ${result.total} g · Ice ${result.ice} g · Brew ${result.brewWater} g`)
    else lines.push(`Total water ${result.total} g`)
    if (instrument === 'filter' && filterMethod === 'with-milk') lines.push(`Milk to serve ${result.milk} g`)
    if (instrument === 'filter' && filterMethod === 'with-water') lines.push(`Dilution water ${result.dilutionWater} g`)
    if (instrument === 'v60') lines.push(`Bloom ${result.bloomWater} g (${bloomTime || '00:30'})`)
    lines.push('Pours (add → scale reads):')
    const pourSteps = instrument === 'filter' ? result.steps : result.steps.slice(1)
    pourSteps.forEach((s) => lines.push(`  ${s.label}: +${s.add} → ${s.cumulative} g`))
    const timed = lapSteps
      .map((ls) => {
        const t = ls.key === 'bloom' ? timer.laps.bloom || bloomTime : timer.laps[ls.key]
        return t ? `  ${ls.label}: ${t}` : null
      })
      .filter(Boolean)
    if (timed.length) {
      lines.push('Times (elapsed from start):')
      lines.push(...timed)
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  const buildPayload = () => {
    const nowDate = new Date()
    const today = nowDate.toISOString().slice(0, 10)
    // Recipe name = current date & time (PRD §4.2 R-2.2.e), e.g. "Jun 26, 2026, 2:30 PM".
    const brewName = nowDate.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    // Filter has no bloom; its single pour is result.steps[0]. V60 pours follow the bloom.
    const pourSteps = instrument === 'filter' ? result.steps : result.steps.slice(1)
    const payload = {
      brewName,
      instrument,
      method,
      withIce: instrument === 'v60' ? iceOn : false,
      coffee: num(dose),
      totalWater: result.total,
      bloomWater: instrument === 'v60' ? result.bloomWater : undefined,
      bloomTimeStr: instrument === 'v60' ? timer.laps.bloom || bloomTime || '00:30' : undefined,
      date: today,
      rating: rating === '' ? undefined : Number(rating),
      notes: notes || undefined,
      // pours: cumulative scale reading + lap time, one per pour.
      pours: pourSteps.map((s, i) => ({ water: s.cumulative, time: timer.laps[`pour${i + 1}`] || undefined })),
    }
    if (instrument === 'v60') {
      payload.ratio = num(ratio) ?? DEFAULTS.v60.ratio
      payload.nPours = result.nPours
      if (iceOn) {
        payload.ice = result.ice
        payload.iceFactor = result.iceFactor
        payload.brewWater = result.brewWater
      }
      payload.grindSize = grind || undefined
    } else {
      payload.ratio = num(waterRatio) ?? DEFAULTS.filter.waterRatio
      if (filterMethod === 'with-milk') {
        payload.milk = result.milk
        payload.milkRatio = num(milkRatio) ?? DEFAULTS.filter.milkRatio
      } else {
        payload.dilutionRatio = result.dilutionRatio
        payload.dilutionWater = result.dilutionWater
      }
      payload.drawdownTime = timer.laps.drawdown || undefined
    }
    if (tempOn && String(waterTempC).trim() !== '') payload.waterTemp = `${waterTempC}°C`
    return payload
  }

  const handleSave = async () => {
    if (!result.valid) return
    if (timer.running) {
      setSaveError('The brew timer is still running — stop it before saving.')
      setSaveStatus('warn')
      return
    }
    const sig = JSON.stringify({ instrument, v60Method, filterMethod, dose, ratio, iceOn, iceFactor, advTotal, advBloom, advNPours, waterRatio, milkRatio, dilutionRatio, bloomTime, laps: timer.laps, rating, notes })
    if (sig === lastSavedSig && !window.confirm('You already saved this brew. Save it again as a new Logbook entry?')) return
    setSaveStatus('saving')
    setSaveError('')
    try {
      await saveBrew(buildPayload())
      setLastSavedSig(sig)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 4000)
    } catch (e) {
      setSaveError(e.message)
      setSaveStatus('error')
    }
  }

  // Re-brew: load a logged brew's inputs back into the calculator.
  const reBrew = (brew) => {
    const inst = brew.instrument === 'filter' ? 'filter' : 'v60'
    setInstrument(inst)
    if (brew.coffee != null) setDose(String(brew.coffee))
    if (inst === 'filter') {
      setFilterMethod(brew.methodId === 'with-water' ? 'with-water' : 'with-milk')
      if (brew.ratio != null) setWaterRatio(String(brew.ratio))
      if (brew.milkRatio != null) setMilkRatio(String(brew.milkRatio))
      else if (brew.milk != null && brew.coffee) setMilkRatio(String(round2(brew.milk / brew.coffee)))
      if (brew.dilutionRatio != null) setDilutionRatio(String(brew.dilutionRatio))
    } else {
      const m = ['1-pour', '3-pour', '10-pour', 'advanced'].includes(brew.methodId) ? brew.methodId : '3-pour'
      setV60Method(m)
      setIceOn(!!brew.withIce)
      if (brew.iceFactor != null) setIceFactor(String(brew.iceFactor))
      if (brew.ratio != null) setRatio(String(brew.ratio))
      if (m === 'advanced') {
        if (brew.bloomWater != null) setAdvBloom(String(brew.bloomWater))
        if (brew.totalWater != null) setAdvTotal(String(brew.totalWater))
        const n = Array.isArray(brew.pours) ? brew.pours.length : null
        if (n) setAdvNPours(String(n))
      }
    }
    if (brew.bloomTime) setBloomTime(brew.bloomTime)
    if (inst === 'v60' && brew.grindSize) setGrind(brew.grindSize)
    if (brew.waterTemp) {
      setTempOn(true)
      const t = parseFloat(brew.waterTemp)
      setWaterTempC(Number.isNaN(t) ? '95' : String(t))
    }
    setView('calculator')
  }

  const presetBloom = num(dose) > 0 ? `${defaultBloom(num(dose))} g` : '—'
  const advBloomPlaceholder = num(dose) > 0 ? `${defaultBloom(num(dose))} (default)` : '2 × dose'

  return (
    <div className="min-h-screen bg-cream text-roast">
      {/* Desktop side navigation */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-1">
          <span className="text-2xl">☕</span>
          <span className="text-lg font-bold tracking-tight">KoffeeWala</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((it) => (
            <button
              key={it.id}
              onClick={() => setView(it.id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${view === it.id ? 'bg-espresso text-white' : 'text-roast hover:bg-tint'}`}
            >
              <span className="text-base">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-line pt-4">
          {user ? (
            <div className="space-y-1 text-sm">
              <p className="truncate text-muted" title={user.email}>{user.email}</p>
              <button onClick={signOut} className="text-xs font-medium text-espresso hover:text-espresso-700">Sign out</button>
            </div>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="w-full rounded-lg bg-espresso px-3 py-2 text-sm font-medium text-white hover:bg-espresso-700">
              Sign in
            </button>
          )}
        </div>
      </aside>

      {/* Main content — full width, 48px gap after the side nav */}
      <main className="px-4 pb-24 pt-6 md:ml-56 md:pb-10 md:pl-12 md:pr-8 md:pt-8">
        {/* Mobile top bar: brand + account */}
        <div className="mb-5 flex items-center justify-between md:hidden">
          <span className="flex items-center gap-2 text-lg font-bold"><span className="text-xl">☕</span>KoffeeWala</span>
          {user ? (
            <button onClick={signOut} className="text-xs font-medium text-espresso">Sign out</button>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="rounded-lg bg-espresso px-3 py-1.5 text-sm font-medium text-white">Sign in</button>
          )}
        </div>

        {/* Page heading (desktop) */}
        <header className="mb-6 hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight">{view === 'logbook' ? 'Logbook' : 'Brew Calculator'}</h1>
          <p className="mt-1 text-sm text-muted">
            {view === 'logbook'
              ? 'Your saved brews — filter, review, edit, or brew again.'
              : 'Scale-based pour targets. Tare the scale to zero after adding coffee — readings are cumulative.'}
          </p>
        </header>

        {view === 'logbook' &&
          (user ? (
            <Logbook onRebrew={reBrew} />
          ) : (
            <section className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
              <p className="text-muted">Sign in to view and manage your logbook.</p>
              <button onClick={() => setAuthOpen(true)} className="mt-3 rounded-lg bg-espresso px-4 py-2 text-sm font-medium text-white hover:bg-espresso-700">
                Sign in
              </button>
            </section>
          ))}

        {view === 'calculator' && (
          <>
            {/* Instrument selector */}
            <div className="mb-2">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Instrument</span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
                  {INSTRUMENTS.filter((ins) => !ins.disabled).map((ins) => (
                    <button
                      key={ins.id}
                      onClick={() => setInstrument(ins.id)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        instrument === ins.id ? 'bg-espresso text-white shadow' : 'text-muted hover:text-roast'
                      }`}
                    >
                      {ins.label}
                    </button>
                  ))}
                </div>
                {INSTRUMENTS.filter((ins) => ins.disabled).map((ins) => (
                  <span key={ins.id} title="Coming soon" className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted">
                    {ins.label}
                    <span className="rounded bg-cream px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">Soon</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Brewing method selector */}
            <div className="mb-5">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Brewing method</span>
              <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
                {(instrument === 'v60' ? V60_METHODS : FILTER_METHODS).map((m) => {
                  const active = method === m.id
                  const onSelect = instrument === 'v60' ? () => setV60Method(m.id) : () => setFilterMethod(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={onSelect}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${active ? 'bg-espresso text-white shadow' : 'text-muted hover:text-roast'}`}
                    >
                      {m.label}
                    </button>
                  )
                })}
                {/* Ice — a mode-altering switch (recomputes the recipe), V60 only */}
                {instrument === 'v60' && (
                  <span className="ml-1 flex items-center px-3 py-2">
                    <Toggle checked={iceOn} onChange={setIceOn} label="Iced" />
                  </span>
                )}
              </div>
            </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Inputs */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Inputs</h2>
              <button onClick={resetDefaults} className="text-xs font-medium text-espresso hover:text-espresso-700">
                Reset
              </button>
            </div>
            <div className="space-y-4">
              <Stepper label="Coffee dose" value={dose} onChange={setDose} suffix="g" step={1} error={fieldErrors.dose} />

              {instrument === 'filter' ? (
                <>
                  <Field label="Water ratio" value={waterRatio} onChange={setWaterRatio} suffix="×" hint="Decoction water = dose × ratio · typical 4–6" error={fieldErrors.waterRatio} warning={fieldWarnings.waterRatio} />
                  {filterMethod === 'with-milk' ? (
                    <Field label="Milk ratio" value={milkRatio} onChange={setMilkRatio} suffix="×" hint="Milk to serve = dose × ratio · typical 2–4" error={fieldErrors.milkRatio} warning={fieldWarnings.milkRatio} />
                  ) : (
                    <Field label="Water (dilution) ratio" value={dilutionRatio} onChange={setDilutionRatio} suffix="×" hint="Dilution water = dose × ratio · typical 3–5" error={fieldErrors.dilutionRatio} warning={fieldWarnings.dilutionRatio} />
                  )}
                </>
              ) : (
                <>
                  <Field
                    label="Ratio"
                    value={ratio}
                    onChange={setRatio}
                    suffix="×"
                    disabled={advOverride}
                    hint={advOverride ? `Overridden by total water${computedRatio ? ` (≈ ${computedRatio}×)` : ''}` : isAdvanced ? 'Total = dose × ratio · or set total water below' : 'Total water = dose × ratio · typical 15–18'}
                    error={fieldErrors.ratio}
                    warning={advOverride ? undefined : fieldWarnings.ratio}
                  />
                  {advOverride && (
                    <button onClick={() => setAdvTotal('')} className="-mt-2 block text-xs font-medium text-espresso hover:text-espresso-700">
                      Use ratio instead (clear total water)
                    </button>
                  )}

                  {isAdvanced && (
                    <>
                      <Field label="Total water (optional)" value={advTotal} onChange={setAdvTotal} suffix="g" placeholder="overrides ratio" hint={advOverride ? 'Driving the recipe — ratio is ignored' : 'Enter to set total directly; overrides the ratio'} error={fieldErrors.totalWater} />
                      <Field label="Number of pours" value={advNPours} onChange={setAdvNPours} step="1" hint="Pours after bloom, split equally" error={fieldErrors.nPours} />
                      <Field label="Bloom water" value={advBloom} onChange={setAdvBloom} suffix="g" placeholder={advBloomPlaceholder} hint="Editable in Advanced — leave blank for 2 × dose" error={fieldErrors.bloom} />
                    </>
                  )}

                  {isV60Preset && (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2">
                      <div className="text-xs uppercase tracking-wide text-muted">Bloom water (fixed)</div>
                      <div className="text-sm font-medium text-roast">{presetBloom} <span className="ml-1 text-xs font-normal text-muted">2 × dose · editable in Advanced</span></div>
                    </div>
                  )}

                  {iceOn && (
                    <div className="reveal-field">
                      <Field label="Ice factor" value={iceFactor} onChange={setIceFactor} step="0.05" suffix="×" hint="Ice = total water × factor · typical 0.3–0.5" error={fieldErrors.iceFactor} warning={fieldWarnings.iceFactor} />
                    </div>
                  )}
                </>
              )}

              {instrument === 'v60' && (
                <TimeField label="Bloom time" value={bloomTime} onChange={setBloomTime} hint="Rest after the bloom pour" />
              )}

              {instrument === 'v60' && (
                <label className="block">
                  <span className="block text-sm font-medium text-roast">Grind size <span className="font-normal text-muted">(optional)</span></span>
                  <input
                    type="text"
                    value={grind}
                    onChange={(e) => setGrind(e.target.value)}
                    placeholder="e.g. 14 clicks · medium-fine"
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30"
                  />
                  <span className="mt-1 block text-xs text-muted">Your grinder’s setting — saved as a note on the brew.</span>
                </label>
              )}

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-roast">
                  <input
                    type="checkbox"
                    checked={tempOn}
                    onChange={(e) => setTempOn(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-espresso focus:ring-espresso"
                  />
                  Record water temp
                </label>
                {tempOn && (
                  <div className="mt-1 flex items-center rounded-lg border border-line bg-surface focus-within:border-espresso focus-within:ring-2 focus-within:ring-espresso/30">
                    <input
                      type="number"
                      value={waterTempC}
                      onChange={(e) => setWaterTempC(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full rounded-lg bg-transparent px-3 py-2 outline-none"
                    />
                    <span className="px-3 text-sm text-muted">°C</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Results */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Recipe</h2>
              {result.valid && (
                <button
                  onClick={copyRecipe}
                  className="rounded-lg border border-line px-3 py-1 text-xs font-medium text-roast hover:border-espresso hover:text-espresso-700"
                >
                  {copied ? '✓ Copied' : 'Copy recipe'}
                </button>
              )}
            </div>

            {/* Brew Timer controls (PRD §6.6) */}
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
              <span className="font-mono text-2xl font-bold tabular-nums text-roast">{fmt(timer.elapsed)}</span>
              <div className="ml-auto flex gap-2">
                {timer.running ? (
                  <button onClick={() => timer.stop(terminalKey)} className="rounded-lg bg-roast px-3 py-1.5 text-sm font-medium text-white hover:bg-roast">
                    Stop
                  </button>
                ) : (
                  <button onClick={timer.start} className="rounded-lg bg-espresso px-3 py-1.5 text-sm font-medium text-white hover:bg-espresso-700">
                    Start
                  </button>
                )}
                <button onClick={timer.reset} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-roast hover:border-muted">
                  Reset
                </button>
              </div>
            </div>

            {!shown ? (
              <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
                Enter a coffee dose to see your recipe.
                {unmappedErrors.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-espresso-700">
                    {unmappedErrors.map((e, i) => <li key={i}>{e.message}</li>)}
                  </ul>
                )}
              </div>
            ) : (
              <div className={result.valid ? '' : 'opacity-60'}>
                {!result.valid && (
                  <div className="mb-3 rounded-lg border border-espresso/30 bg-tint px-3 py-2 text-xs text-espresso-700">
                    Showing your last valid recipe — fix the highlighted inputs to update.
                    {unmappedErrors.length > 0 && (
                      <ul className="mt-1 list-inside list-disc">
                        {unmappedErrors.map((e, i) => <li key={i}>{e.message}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                <div className="mb-4 grid grid-cols-2 gap-2">
                  <Stat label="Total water" value={`${shown.total} g`} accent />
                  {shown.instrument === 'v60' && shown.withIce && <Stat label="Ice (in vessel)" value={`${shown.ice} g`} />}
                  {shown.instrument === 'v60' && shown.withIce && <Stat label="Brew water" value={`${shown.brewWater} g`} />}
                  {shown.instrument === 'filter' && shown.method === 'with-milk' && <Stat label="Milk to serve" value={`${shown.milk} g`} />}
                  {shown.instrument === 'filter' && shown.method === 'with-water' && <Stat label="Dilution water" value={`${shown.dilutionWater} g`} />}
                  {shown.instrument === 'v60' && <Stat label="Bloom" value={`${shown.bloomWater} g`} />}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-muted">
                        <th className="py-2 font-medium">Step</th>
                        <th className="py-2 text-right font-medium">Add (g)</th>
                        <th className="py-2 text-right font-medium">Reads (g)</th>
                        {result.valid && <th className="py-2 pl-2 text-right font-medium">Time</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {result.valid
                        ? lapSteps.map((ls, i) => {
                            const step = result.steps[i]
                            const isTerminal = ls.key === terminalKey
                            const placeholder = isTerminal ? 'on stop' : ls.key === 'bloom' ? bloomTime || '00:30' : 'mm:ss'
                            return (
                              <tr key={ls.key} className="border-b border-cream last:border-0">
                                <td className="py-2 font-medium text-roast">{ls.label}</td>
                                <td className="py-2 text-right tabular-nums">{step ? `+${step.add}` : '—'}</td>
                                <td className="py-2 text-right font-semibold tabular-nums">{step ? step.cumulative : '—'}</td>
                                <td className="py-2 pl-2">
                                  <div className="flex items-center justify-end gap-1">
                                    {!isTerminal && (
                                      <button
                                        onClick={() => timer.lap(ls.key)}
                                        title={`Lap ${ls.label}`}
                                        className="rounded border border-espresso/40 bg-tint px-1.5 py-0.5 text-[11px] font-medium text-espresso-700 hover:bg-espresso/15"
                                      >
                                        Lap
                                      </button>
                                    )}
                                    <input
                                      type="text"
                                      value={timer.laps[ls.key] ?? ''}
                                      placeholder={placeholder}
                                      onChange={(e) => timer.editLap(ls.key, e.target.value)}
                                      className="w-14 rounded border border-line px-1 py-0.5 text-center font-mono text-xs tabular-nums outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30"
                                    />
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        : shown.steps.map((s, i) => (
                            <tr key={i} className="border-b border-cream last:border-0">
                              <td className="py-2 font-medium text-roast">{s.label}</td>
                              <td className="py-2 text-right tabular-nums">+{s.add}</td>
                              <td className="py-2 text-right font-semibold tabular-nums">{s.cumulative}</td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>

                {shown.instrument === 'filter' && (
                  <div className="mt-4 space-y-2 text-sm text-muted">
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">⚠️ Remove the tamper / metal disk before brewing.</p>
                    <p>🌀 Main pour: spiral from center, swirl, lid on.</p>
                    {shown.method === 'with-milk' && (
                      <p>🥛 Heat &amp; serve <span className="font-semibold text-roast">{shown.milk} g</span> milk alongside the decoction.</p>
                    )}
                    {shown.method === 'with-water' && (
                      <p>💧 Dilute the decoction with <span className="font-semibold text-roast">{shown.dilutionWater} g</span> hot water to taste.</p>
                    )}
                    <p>🌡️ Water 80–85 °C · expected drawdown 7–10 min.</p>
                  </div>
                )}

                {/* Save to logbook — requires sign-in (Phase 2 multi-user) */}
                {result.valid && (
                <div className="mt-4 border-t border-cream pt-4">
                  {user ? (
                    <>
                      <div className="flex items-end gap-3">
                        <label className="block">
                          <span className="block text-xs font-medium text-muted">Rating /10 <span className="text-muted">(optional)</span></span>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={rating}
                            onChange={(e) => setRating(e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="—"
                            className="mt-1 w-20 rounded-lg border border-line px-2 py-1 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30"
                          />
                        </label>
                      </div>
                      <label className="mt-2 block">
                        <span className="block text-xs font-medium text-muted">Tasting notes <span className="text-muted">(optional)</span></span>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          placeholder="e.g. bright, juicy, slightly sweet"
                          className="mt-1 w-full rounded-lg border border-line px-2 py-1 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30"
                        />
                      </label>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={handleSave}
                          disabled={saveStatus === 'saving'}
                          className="rounded-lg bg-espresso px-4 py-2 text-sm font-medium text-white hover:bg-espresso-700 disabled:opacity-50"
                        >
                          {saveStatus === 'saving' ? 'Saving…' : 'Save to Logbook'}
                        </button>
                        {saveStatus === 'saved' && <span className="text-sm font-medium text-green-700">✓ Saved</span>}
                        {saveStatus === 'warn' && <span className="text-sm font-medium text-espresso">{saveError}</span>}
                        {saveStatus === 'error' && <span className="text-sm text-red-600">{saveError}</span>}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted">
                      <button onClick={() => setAuthOpen(true)} className="font-medium text-espresso hover:underline">Sign in</button> to save this brew to your logbook.
                    </p>
                  )}
                </div>
                )}
              </div>
            )}

            <p className="mt-4 text-xs text-muted">Values rounded to whole grams.</p>
          </section>
        </div>
          </>
        )}

        <footer className="mt-8 text-center text-xs text-muted">KoffeeWala · v2</footer>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface md:hidden">
        {NAV_ITEMS.map((it) => (
          <button
            key={it.id}
            onClick={() => setView(it.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${view === it.id ? 'text-espresso' : 'text-muted'}`}
          >
            <span className="text-lg">{it.icon}</span>
            {it.label}
          </button>
        ))}
      </nav>

      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
