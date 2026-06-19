import { useEffect, useMemo, useState } from 'react'
import { calculate, defaultBloom } from './lib/calculations.js'
import Field from './components/Field.jsx'
import { useBrewTimer, fmt } from './lib/useBrewTimer.js'
import { saveBrew } from './lib/logbook.js'
import Logbook from './components/Logbook.jsx'

const MODES = [
  { id: 'v60-no-ice', label: 'V60 — No Ice' },
  { id: 'v60-ice', label: 'V60 — With Ice' },
  { id: 'filter', label: 'Filter Coffee' },
]

// Lap-able steps per mode (PRD §6.6) + the Recipe Logbook column each fills.
function lapStepsFor(mode) {
  if (mode === 'filter') {
    return [
      { key: 'bloom', label: 'Bloom', logCol: 'Bloom Time' },
      { key: 'pour1', label: 'Main pour', logCol: 'Pour 1 Time' },
      { key: 'drawdown', label: 'Drawdown end', logCol: 'Drawdown Time' },
    ]
  }
  return [
    { key: 'bloom', label: 'Bloom', logCol: 'Bloom Time' },
    { key: 'pour1', label: 'Pour 1', logCol: 'Pour 1 Time' },
    { key: 'pour2', label: 'Pour 2', logCol: 'Pour 2 Time' },
    { key: 'pour3', label: 'Pour 3', logCol: 'Pour 3 Time' },
  ]
}

const num = (s) => (s == null || String(s).trim() === '' ? undefined : parseFloat(s))

const STORAGE_KEY = 'cbc-state-v1'
const DEFAULT_STATE = {
  mode: 'v60-no-ice',
  dose: '20',
  ratio: '16',
  iceFactor: '0.4',
  waterRatio: '5',
  milkRatio: '3',
  bloom: '',
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
  const [mode, setMode] = useState(saved.mode)
  const [dose, setDose] = useState(saved.dose)
  const [ratio, setRatio] = useState(saved.ratio)
  const [iceFactor, setIceFactor] = useState(saved.iceFactor)
  const [waterRatio, setWaterRatio] = useState(saved.waterRatio)
  const [milkRatio, setMilkRatio] = useState(saved.milkRatio)
  const [bloom, setBloom] = useState(saved.bloom)
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

  const lapSteps = useMemo(() => lapStepsFor(mode), [mode])
  // The final step is not lapped manually — stopping the timer records its time.
  const terminalKey = lapSteps[lapSteps.length - 1].key
  const timer = useBrewTimer()

  // Reset the timer + captured laps when the brew method changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => timer.clear(), [mode])

  const inputs = useMemo(() => {
    const base = { dose: num(dose), bloom: num(bloom) }
    if (mode === 'filter') return { ...base, waterRatio: num(waterRatio), milkRatio: num(milkRatio) }
    if (mode === 'v60-ice') return { ...base, ratio: num(ratio), iceFactor: num(iceFactor) }
    return { ...base, ratio: num(ratio) }
  }, [mode, dose, bloom, ratio, iceFactor, waterRatio, milkRatio])

  const result = useMemo(() => calculate(mode, inputs), [mode, inputs])

  // Persist inputs across sessions.
  useEffect(() => {
    const state = { mode, dose, ratio, iceFactor, waterRatio, milkRatio, bloom, bloomTime, grind, tempOn, waterTempC }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore storage failures (private mode, quota) */
    }
  }, [mode, dose, ratio, iceFactor, waterRatio, milkRatio, bloom, bloomTime, grind, tempOn, waterTempC])

  const resetDefaults = () => {
    setDose(DEFAULT_STATE.dose)
    setRatio(DEFAULT_STATE.ratio)
    setIceFactor(DEFAULT_STATE.iceFactor)
    setWaterRatio(DEFAULT_STATE.waterRatio)
    setMilkRatio(DEFAULT_STATE.milkRatio)
    setBloom(DEFAULT_STATE.bloom)
    setBloomTime(DEFAULT_STATE.bloomTime)
    setGrind(DEFAULT_STATE.grind)
    setTempOn(DEFAULT_STATE.tempOn)
    setWaterTempC(DEFAULT_STATE.waterTempC)
  }

  const copyRecipe = async () => {
    if (!result.valid) return
    const modeLabel = MODES.find((m) => m.id === mode).label
    const lines = [`☕ ${modeLabel}`]
    if (mode === 'filter') {
      lines.push(`Dose ${num(dose)} g · water ratio ${num(waterRatio) ?? 5} · milk ratio ${num(milkRatio) ?? 3}`)
      lines.push(`Total water ${result.total} g · Milk to serve ${result.milk} g`)
    } else {
      lines.push(`Dose ${num(dose)} g · ratio ${num(ratio) ?? 16}`)
      if (mode === 'v60-ice') lines.push(`Total ${result.total} g · Ice ${result.ice} g · Brew ${result.brewWater} g`)
      else lines.push(`Total water ${result.total} g`)
    }
    lines.push(`Bloom ${result.bloomWater} g (${bloomTime || '00:30'})`)
    lines.push('Pours (add → scale reads):')
    result.steps.forEach((s) => lines.push(`  ${s.label}: +${s.add} → ${s.cumulative} g`))
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
    const methodMap = { 'v60-no-ice': 'V60 - No Ice', 'v60-ice': 'V60 - With Ice', filter: 'Filter Coffee' }
    const nowDate = new Date()
    const today = nowDate.toISOString().slice(0, 10)
    const hhmm = nowDate.toTimeString().slice(0, 5)
    const modeLabel = MODES.find((m) => m.id === mode).label
    const payload = {
      brewName: `${modeLabel} · ${num(dose)}g · ${today} ${hhmm}`,
      brewMethod: methodMap[mode],
      coffee: num(dose),
      totalWater: result.total,
      bloomWater: result.bloomWater,
      brewWater: result.target,
      bloomTimeStr: timer.laps.bloom || bloomTime || '00:30',
      date: today,
      rating: rating === '' ? undefined : Number(rating),
      notes: notes || undefined,
      pour1Time: timer.laps.pour1 || undefined,
      drawdownTime: timer.laps.drawdown || undefined,
    }
    if (mode === 'filter') {
      payload.ratio = num(waterRatio) ?? 5
      payload.milk = result.milk
      payload.pour1Water = result.steps[1]?.cumulative // main pour → Pour 1
    } else {
      payload.ratio = num(ratio) ?? 16
      if (mode === 'v60-ice') payload.ice = result.ice
      payload.pour1Water = result.steps[1]?.cumulative
      payload.pour2Water = result.steps[2]?.cumulative
      payload.pour3Water = result.steps[3]?.cumulative
      payload.pour2Time = timer.laps.pour2 || undefined
      payload.pour3Time = timer.laps.pour3 || undefined
      payload.grindSize = grind || undefined
    }
    // Water temp (optional toggle) applies to all modes, incl. Filter.
    if (tempOn && String(waterTempC).trim() !== '') payload.waterTemp = `${waterTempC}°C`
    return payload
  }

  const handleSave = async () => {
    if (!result.valid) return
    // Warn (don't save) if the timer is still running.
    if (timer.running) {
      setSaveError('The brew timer is still running — stop it before saving.')
      setSaveStatus('warn')
      return
    }
    // Confirm before re-saving an unchanged brew (avoids accidental duplicate rows).
    const sig = JSON.stringify({ mode, dose, ratio, iceFactor, waterRatio, milkRatio, bloom, bloomTime, laps: timer.laps, rating, notes })
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

  const bloomPlaceholder = num(dose) > 0 ? `${defaultBloom(num(dose))} (default)` : '2 × dose'

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 to-stone-200 text-stone-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">☕ Coffee Brewing Calculator</h1>
          <p className="mt-1 text-stone-600">
            Scale-based pour targets. Tare the scale to zero after adding coffee — readings are cumulative.
          </p>
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

        {view === 'logbook' && <Logbook />}

        {view === 'calculator' && (
          <>
            {/* Mode tabs */}
            <div className="mb-6 inline-flex rounded-xl border border-stone-300 bg-white p-1 shadow-sm">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                mode === m.id ? 'bg-amber-700 text-white shadow' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {m.label}
            </button>
          ))}
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

              {mode === 'filter' ? (
                <>
                  <Field label="Water ratio" value={waterRatio} onChange={setWaterRatio} suffix="×" hint="Total water = dose × ratio (default 5)" />
                  <Field label="Milk ratio" value={milkRatio} onChange={setMilkRatio} suffix="×" hint="Milk to serve = dose × ratio (default 3)" />
                </>
              ) : (
                <Field label="Ratio" value={ratio} onChange={setRatio} suffix="×" hint="Total water = dose × ratio (default 16)" />
              )}

              {mode === 'v60-ice' && (
                <Field label="Ice factor" value={iceFactor} onChange={setIceFactor} step="0.05" suffix="×" hint="Ice = total water × factor (default 0.4)" />
              )}

              <Field label="Bloom water" value={bloom} onChange={setBloom} suffix="g" placeholder={bloomPlaceholder} hint="Leave blank to use 2 × dose" />

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

              {mode !== 'filter' && (
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
                  {mode === 'v60-ice' && <Stat label="Ice (in vessel)" value={`${result.ice} g`} />}
                  {mode === 'v60-ice' && <Stat label="Brew water" value={`${result.brewWater} g`} />}
                  {mode === 'filter' && <Stat label="Milk to serve" value={`${result.milk} g`} />}
                  <Stat label="Bloom" value={`${result.bloomWater} g`} />
                </div>

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

                {mode === 'filter' && (
                  <div className="mt-4 space-y-2 text-sm text-stone-600">
                    <p>🌀 Main pour: spiral from center, swirl, lid on.</p>
                    <p>🥛 Heat &amp; serve <span className="font-semibold text-stone-800">{result.milk} g</span> milk alongside the decoction.</p>
                    <p>🌡️ Water 80–85 °C · expected drawdown 7–10 min.</p>
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">⚠️ Remove the tamper / metal disk before brewing.</p>
                  </div>
                )}

                {/* Save to Notion Logbook (Phase 1 — write) */}
                <div className="mt-4 border-t border-stone-100 pt-4">
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
                    {saveStatus === 'saved' && <span className="text-sm font-medium text-green-700">✓ Saved to Notion</span>}
                    {saveStatus === 'warn' && <span className="text-sm font-medium text-amber-700">{saveError}</span>}
                    {saveStatus === 'error' && <span className="text-sm text-red-600">{saveError}</span>}
                  </div>
                </div>
              </>
            )}

            <p className="mt-4 text-xs text-stone-400">Values rounded to whole grams.</p>
          </section>
        </div>
          </>
        )}

        <footer className="mt-8 text-center text-xs text-stone-400">
          Coffee Brewing Calculator · v1
        </footer>
      </div>
    </div>
  )
}
