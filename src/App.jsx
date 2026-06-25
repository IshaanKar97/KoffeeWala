import { useEffect, useMemo, useState } from 'react'
import { calculate, defaultBloom, DEFAULTS, V60_POURS } from './lib/calculations.js'
import Field from './components/Field.jsx'
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
  grind: '14 clicks',
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
    <div className={`rounded-lg border px-3 py-2 ${accent ? 'border-amber-300 bg-amber-50' : 'border-stone-200 bg-stone-50'}`}>
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className="text-lg font-semibold text-stone-900">{value}</div>
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
    const hhmm = nowDate.toTimeString().slice(0, 5)
    const instLabel = instrument === 'v60' ? 'V60' : 'Filter Coffee'
    const iceTag = instrument === 'v60' && iceOn ? ' · Ice' : ''
    // Filter has no bloom; its single pour is result.steps[0]. V60 pours follow the bloom.
    const pourSteps = instrument === 'filter' ? result.steps : result.steps.slice(1)
    const payload = {
      brewName: `${instLabel} ${METHOD_LABEL[method]}${iceTag} · ${num(dose)}g · ${today} ${hhmm}`,
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
    <div className="min-h-screen bg-gradient-to-b from-stone-100 to-stone-200 text-stone-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">☕ Coffee Brewing Calculator</h1>
            <p className="mt-1 text-stone-600">
              Scale-based pour targets. Tare the scale to zero after adding coffee — readings are cumulative.
            </p>
          </div>
          <div className="shrink-0 pt-1 text-right text-sm">
            {user ? (
              <div className="flex flex-col items-end gap-1">
                <span className="max-w-[12rem] truncate text-stone-600" title={user.email}>{user.email}</span>
                <button onClick={signOut} className="text-xs font-medium text-amber-700 hover:text-amber-900">Sign out</button>
              </div>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800">
                Sign in
              </button>
            )}
          </div>
        </header>

        {/* View toggle: Calculator / Logbook */}
        <div className="mb-6 flex gap-1 border-b border-stone-300">
          {[
            ['calculator', 'Calculator'],
            ['logbook', 'Logbook'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                view === id ? 'border-amber-700 text-amber-800' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === 'logbook' &&
          (user ? (
            <Logbook onRebrew={reBrew} />
          ) : (
            <section className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
              <p className="text-stone-600">Sign in to view and manage your logbook.</p>
              <button onClick={() => setAuthOpen(true)} className="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
                Sign in
              </button>
            </section>
          ))}

        {view === 'calculator' && (
          <>
            {/* Instrument selector */}
            <div className="mb-3">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">Instrument</span>
              <div className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-300 bg-white p-1 shadow-sm">
                {INSTRUMENTS.map((ins) => (
                  <button
                    key={ins.id}
                    onClick={() => !ins.disabled && setInstrument(ins.id)}
                    disabled={ins.disabled}
                    title={ins.disabled ? 'Coming soon' : undefined}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      ins.disabled
                        ? 'cursor-not-allowed text-stone-400'
                        : instrument === ins.id
                          ? 'bg-amber-700 text-white shadow'
                          : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {ins.label}
                    {ins.disabled && <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-500">Soon</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Brewing method selector */}
            <div className="mb-6">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">Brewing method</span>
              <div className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-300 bg-white p-1 shadow-sm">
                {(instrument === 'v60' ? V60_METHODS : FILTER_METHODS).map((m) => {
                  const active = method === m.id
                  const onSelect = instrument === 'v60' ? () => setV60Method(m.id) : () => setFilterMethod(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={onSelect}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${active ? 'bg-amber-700 text-white shadow' : 'text-stone-600 hover:text-stone-900'}`}
                    >
                      {m.label}
                    </button>
                  )
                })}
                {/* Ice toggle — V60 only, applies to every method */}
                {instrument === 'v60' && (
                  <label className="ml-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-stone-700">
                    <input
                      type="checkbox"
                      checked={iceOn}
                      onChange={(e) => setIceOn(e.target.checked)}
                      className="h-4 w-4 rounded border-stone-300 text-amber-700 focus:ring-amber-600"
                    />
                    Ice
                  </label>
                )}
              </div>
            </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Inputs */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Inputs</h2>
              <button onClick={resetDefaults} className="text-xs font-medium text-amber-700 hover:text-amber-900">
                Reset
              </button>
            </div>
            <div className="space-y-4">
              <Field label="Coffee dose" value={dose} onChange={setDose} suffix="g" placeholder="e.g. 20" />

              {instrument === 'filter' ? (
                <>
                  <Field label="Water ratio" value={waterRatio} onChange={setWaterRatio} suffix="×" hint="Decoction water = dose × ratio (default 5)" />
                  {filterMethod === 'with-milk' ? (
                    <Field label="Milk ratio" value={milkRatio} onChange={setMilkRatio} suffix="×" hint="Milk to serve = dose × ratio (default 3)" />
                  ) : (
                    <Field label="Water (dilution) ratio" value={dilutionRatio} onChange={setDilutionRatio} suffix="×" hint="Dilution water = dose × ratio (default 4)" />
                  )}
                </>
              ) : (
                <>
                  <Field label="Ratio" value={ratio} onChange={setRatio} suffix="×" hint={isAdvanced ? 'Total = dose × ratio (overridden if you set total water below)' : 'Total water = dose × ratio (default 16)'} />

                  {isAdvanced && (
                    <>
                      <Field label="Total water (optional)" value={advTotal} onChange={setAdvTotal} suffix="g" placeholder="overrides ratio" hint="Enter to set total directly; overrides the ratio" />
                      <Field label="Number of pours" value={advNPours} onChange={setAdvNPours} step="1" hint="Pours after bloom, split equally" />
                      <Field label="Bloom water" value={advBloom} onChange={setAdvBloom} suffix="g" placeholder={advBloomPlaceholder} hint="Editable in Advanced — leave blank for 2 × dose" />
                    </>
                  )}

                  {isV60Preset && (
                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                      <div className="text-xs uppercase tracking-wide text-stone-500">Bloom water (fixed)</div>
                      <div className="text-sm font-medium text-stone-800">{presetBloom} <span className="ml-1 text-xs font-normal text-stone-500">2 × dose</span></div>
                    </div>
                  )}

                  {iceOn && (
                    <Field label="Ice factor" value={iceFactor} onChange={setIceFactor} step="0.05" suffix="×" hint="Ice = total water × factor (default 0.4)" />
                  )}
                </>
              )}

              {instrument === 'v60' && (
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700">Bloom time</span>
                  <input
                    type="text"
                    value={bloomTime}
                    onChange={(e) => setBloomTime(e.target.value)}
                    placeholder="00:30"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/30"
                  />
                </label>
              )}

              {instrument === 'v60' && (
                <label className="block">
                  <span className="block text-sm font-medium text-stone-700">Grind size</span>
                  <input
                    type="text"
                    value={grind}
                    onChange={(e) => setGrind(e.target.value)}
                    placeholder="e.g. 14 clicks"
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/30"
                  />
                </label>
              )}

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={tempOn}
                    onChange={(e) => setTempOn(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-amber-700 focus:ring-amber-600"
                  />
                  Record water temp
                </label>
                {tempOn && (
                  <div className="mt-1 flex items-center rounded-lg border border-stone-300 bg-white focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-600/30">
                    <input
                      type="number"
                      value={waterTempC}
                      onChange={(e) => setWaterTempC(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full rounded-lg bg-transparent px-3 py-2 outline-none"
                    />
                    <span className="px-3 text-sm text-stone-500">°C</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Results */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Recipe</h2>
              {result.valid && (
                <button
                  onClick={copyRecipe}
                  className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-amber-600 hover:text-amber-800"
                >
                  {copied ? '✓ Copied' : 'Copy recipe'}
                </button>
              )}
            </div>

            {/* Brew Timer controls (PRD §6.6) */}
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <span className="font-mono text-2xl font-bold tabular-nums text-stone-900">{fmt(timer.elapsed)}</span>
              <div className="ml-auto flex gap-2">
                {timer.running ? (
                  <button onClick={() => timer.stop(terminalKey)} className="rounded-lg bg-stone-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800">
                    Stop
                  </button>
                ) : (
                  <button onClick={timer.start} className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800">
                    Start
                  </button>
                )}
                <button onClick={timer.reset} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400">
                  Reset
                </button>
              </div>
            </div>

            {!result.valid ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <ul className="list-inside list-disc space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <Stat label="Total water" value={`${result.total} g`} accent />
                  {instrument === 'v60' && iceOn && <Stat label="Ice (in vessel)" value={`${result.ice} g`} />}
                  {instrument === 'v60' && iceOn && <Stat label="Brew water" value={`${result.brewWater} g`} />}
                  {instrument === 'filter' && filterMethod === 'with-milk' && <Stat label="Milk to serve" value={`${result.milk} g`} />}
                  {instrument === 'filter' && filterMethod === 'with-water' && <Stat label="Dilution water" value={`${result.dilutionWater} g`} />}
                  {instrument === 'v60' && <Stat label="Bloom" value={`${result.bloomWater} g`} />}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left text-stone-500">
                        <th className="py-2 font-medium">Step</th>
                        <th className="py-2 text-right font-medium">Add (g)</th>
                        <th className="py-2 text-right font-medium">Reads (g)</th>
                        <th className="py-2 pl-2 text-right font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lapSteps.map((ls, i) => {
                        const step = result.steps[i]
                        const isTerminal = ls.key === terminalKey
                        const placeholder = isTerminal ? 'on stop' : ls.key === 'bloom' ? bloomTime || '00:30' : 'mm:ss'
                        return (
                          <tr key={ls.key} className="border-b border-stone-100 last:border-0">
                            <td className="py-2 font-medium text-stone-800">{ls.label}</td>
                            <td className="py-2 text-right tabular-nums">{step ? `+${step.add}` : '—'}</td>
                            <td className="py-2 text-right font-semibold tabular-nums">{step ? step.cumulative : '—'}</td>
                            <td className="py-2 pl-2">
                              <div className="flex items-center justify-end gap-1">
                                {!isTerminal && (
                                  <button
                                    onClick={() => timer.lap(ls.key)}
                                    title={`Lap ${ls.label}`}
                                    className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
                                  >
                                    Lap
                                  </button>
                                )}
                                <input
                                  type="text"
                                  value={timer.laps[ls.key] ?? ''}
                                  placeholder={placeholder}
                                  onChange={(e) => timer.editLap(ls.key, e.target.value)}
                                  className="w-14 rounded border border-stone-300 px-1 py-0.5 text-center font-mono text-xs tabular-nums outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/30"
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {instrument === 'filter' && (
                  <div className="mt-4 space-y-2 text-sm text-stone-600">
                    <p>🌀 Main pour: spiral from center, swirl, lid on.</p>
                    {filterMethod === 'with-milk' && (
                      <p>🥛 Heat &amp; serve <span className="font-semibold text-stone-800">{result.milk} g</span> milk alongside the decoction.</p>
                    )}
                    {filterMethod === 'with-water' && (
                      <p>💧 Dilute the decoction with <span className="font-semibold text-stone-800">{result.dilutionWater} g</span> hot water to taste.</p>
                    )}
                    <p>🌡️ Water 80–85 °C · expected drawdown 7–10 min.</p>
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">⚠️ Remove the tamper / metal disk before brewing.</p>
                  </div>
                )}

                {/* Save to logbook — requires sign-in (Phase 2 multi-user) */}
                <div className="mt-4 border-t border-stone-100 pt-4">
                  {user ? (
                    <>
                      <div className="flex items-end gap-3">
                        <label className="block">
                          <span className="block text-xs font-medium text-stone-600">Rating /10 <span className="text-stone-400">(optional)</span></span>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={rating}
                            onChange={(e) => setRating(e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="—"
                            className="mt-1 w-20 rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/30"
                          />
                        </label>
                      </div>
                      <label className="mt-2 block">
                        <span className="block text-xs font-medium text-stone-600">Tasting notes <span className="text-stone-400">(optional)</span></span>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          placeholder="e.g. bright, juicy, slightly sweet"
                          className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/30"
                        />
                      </label>
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={handleSave}
                          disabled={saveStatus === 'saving'}
                          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                        >
                          {saveStatus === 'saving' ? 'Saving…' : 'Save to Logbook'}
                        </button>
                        {saveStatus === 'saved' && <span className="text-sm font-medium text-green-700">✓ Saved</span>}
                        {saveStatus === 'warn' && <span className="text-sm font-medium text-amber-700">{saveError}</span>}
                        {saveStatus === 'error' && <span className="text-sm text-red-600">{saveError}</span>}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-stone-600">
                      <button onClick={() => setAuthOpen(true)} className="font-medium text-amber-700 hover:underline">Sign in</button> to save this brew to your logbook.
                    </p>
                  )}
                </div>
              </>
            )}

            <p className="mt-4 text-xs text-stone-400">Values rounded to whole grams.</p>
          </section>
        </div>
          </>
        )}

        <footer className="mt-8 text-center text-xs text-stone-400">
          Coffee Brewing Calculator · v2
        </footer>
      </div>
      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} />}
    </div>
  )
}
