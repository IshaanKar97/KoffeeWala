import { useEffect, useMemo, useState } from 'react'
import { calculate, defaultBloom } from './lib/calculations.js'
import Field from './components/Field.jsx'

const MODES = [
  { id: 'v60-no-ice', label: 'V60 — No Ice' },
  { id: 'v60-ice', label: 'V60 — With Ice' },
  { id: 'filter', label: 'Filter Coffee' },
]

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
  const [mode, setMode] = useState(saved.mode)
  const [dose, setDose] = useState(saved.dose)
  const [ratio, setRatio] = useState(saved.ratio)
  const [iceFactor, setIceFactor] = useState(saved.iceFactor)
  const [waterRatio, setWaterRatio] = useState(saved.waterRatio)
  const [milkRatio, setMilkRatio] = useState(saved.milkRatio)
  const [bloom, setBloom] = useState(saved.bloom)
  const [bloomTime, setBloomTime] = useState(saved.bloomTime)
  const [copied, setCopied] = useState(false)

  const inputs = useMemo(() => {
    const base = { dose: num(dose), bloom: num(bloom) }
    if (mode === 'filter') return { ...base, waterRatio: num(waterRatio), milkRatio: num(milkRatio) }
    if (mode === 'v60-ice') return { ...base, ratio: num(ratio), iceFactor: num(iceFactor) }
    return { ...base, ratio: num(ratio) }
  }, [mode, dose, bloom, ratio, iceFactor, waterRatio, milkRatio])

  const result = useMemo(() => calculate(mode, inputs), [mode, inputs])

  // Persist inputs across sessions.
  useEffect(() => {
    const state = { mode, dose, ratio, iceFactor, waterRatio, milkRatio, bloom, bloomTime }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore storage failures (private mode, quota) */
    }
  }, [mode, dose, ratio, iceFactor, waterRatio, milkRatio, bloom, bloomTime])

  const resetDefaults = () => {
    setDose(DEFAULT_STATE.dose)
    setRatio(DEFAULT_STATE.ratio)
    setIceFactor(DEFAULT_STATE.iceFactor)
    setWaterRatio(DEFAULT_STATE.waterRatio)
    setMilkRatio(DEFAULT_STATE.milkRatio)
    setBloom(DEFAULT_STATE.bloom)
    setBloomTime(DEFAULT_STATE.bloomTime)
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
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  const bloomPlaceholder = num(dose) > 0 ? `${defaultBloom(num(dose))} (default)` : '2 × dose'
  const noteFor = (label) => {
    if (label === 'Bloom') return `wait ${bloomTime || '00:30'}`
    if (label === 'Main pour') return 'spiral · swirl · lid on'
    if (label === 'Pour 3') return 'done'
    return ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 to-stone-200 text-stone-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">☕ Coffee Brewing Calculator</h1>
          <p className="mt-1 text-stone-600">
            Scale-based pour targets. Tare the scale to zero after adding coffee — readings are cumulative.
          </p>
        </header>

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
                      <th className="py-2 text-right font-medium">Scale reads (g)</th>
                      <th className="py-2 pl-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.steps.map((s, i) => (
                      <tr key={i} className="border-b border-stone-100 last:border-0">
                        <td className="py-2 font-medium text-stone-800">{s.label}</td>
                        <td className="py-2 text-right tabular-nums">+{s.add}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">{s.cumulative}</td>
                        <td className="py-2 pl-3 text-stone-500">{noteFor(s.label)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {mode === 'filter' && (
                  <div className="mt-4 space-y-2 text-sm text-stone-600">
                    <p>🥛 Heat &amp; serve <span className="font-semibold text-stone-800">{result.milk} g</span> milk alongside the decoction.</p>
                    <p>🌡️ Water 80–85 °C · expected drawdown 7–10 min.</p>
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">⚠️ Remove the tamper / metal disk before brewing.</p>
                  </div>
                )}
              </>
            )}

            <p className="mt-4 text-xs text-stone-400">Values rounded to whole grams.</p>
          </section>
        </div>

        <footer className="mt-8 text-center text-xs text-stone-400">
          Coffee Brewing Calculator · v1
        </footer>
      </div>
    </div>
  )
}
