import { useEffect, useMemo, useRef, useState } from 'react'
import { calculate, defaultBloom, DEFAULTS, V60_POURS } from './lib/calculations.js'
import Field, { TimeField, Toggle, Stepper } from './components/Field.jsx'
import { useBrewTimer, fmt } from './lib/useBrewTimer.js'
import { saveBrew } from './lib/logbook.js'
import Logbook from './components/Logbook.jsx'
import Equipment from './components/Equipment.jsx'
import Beans from './components/Beans.jsx'
import Profile from './components/Profile.jsx'
import { GrindInput } from './components/Grind.jsx'
import { defaultGrinder, DEFAULT_GRINDER_ID, grindSummary, micronsFromSummary } from './lib/grinders.js'
import { listBeans, deductForBrew, getLowStockBeans } from './lib/beans.js'
import { supabase } from './lib/supabase.js'
import { useAuth } from './context/AuthContext.jsx'
import AuthPanel from './components/AuthPanel.jsx'

// V60-only (Phase 3 Feature #2, Decision #65) — Filter Coffee and Moka-Pot
// were retired from the instrument/brewing-method model; instrument is fixed.
const instrument = 'v60'
const V60_METHODS = [
  { id: '1-pour', label: '1-Pour' },
  { id: '3-pour', label: '3-Pour' },
  { id: '10-pour', label: '10-Pour' },
  { id: 'advanced', label: 'Advanced' },
]
const METHOD_LABEL = {
  '1-pour': '1-Pour',
  '3-pour': '3-Pour',
  '10-pour': '10-Pour',
  advanced: 'Advanced',
}

// Lap-able timer steps for the current brew. The terminal step is not lapped
// manually — stopping the timer records its time (PRD §6.6).
function lapStepsFor(pourCount) {
  const steps = [{ key: 'bloom', label: 'Bloom' }]
  for (let i = 1; i <= pourCount; i++) steps.push({ key: `pour${i}`, label: `Pour ${i}` })
  return steps
}

// App sections — side nav (desktop) / bottom nav (mobile).
const NAV_ITEMS = [
  { id: 'calculator', label: 'Brew', icon: '☕' },
  { id: 'logbook', label: 'Logbook', icon: '📖' },
  { id: 'beans', label: 'Beans', icon: '🫘' },
  { id: 'equipment', label: 'Equipment', icon: '⚙️' },
  { id: 'profile', label: 'Profile', icon: '👤' },
]

const num = (s) => (s == null || String(s).trim() === '' ? undefined : parseFloat(s))

const STORAGE_KEY = 'cbc-state-v3'
const DEFAULT_STATE = {
  v60Method: '3-pour',
  dose: '20',
  ratio: '16',
  iceOn: false,
  iceFactor: '0.4',
  advTotal: '',
  advBloom: '',
  advNPours: '3',
  bloomTime: '00:30',
  grind: { format: 'clicks', microns: null }, // structured grind (see lib/grinders.js)
  tempOn: false,
  waterTempC: '95',
  beanId: '',
}
const loadState = () => {
  try {
    const s = { ...DEFAULT_STATE, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }
    if (!s.grind || typeof s.grind !== 'object') s.grind = { ...DEFAULT_STATE.grind } // migrate old free-text grind
    return s
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
  const [view, setView] = useState('calculator') // calculator | logbook | beans | equipment
  const [v60Method, setV60Method] = useState(saved.v60Method)
  const [dose, setDose] = useState(saved.dose)
  const [ratio, setRatio] = useState(saved.ratio)
  const [iceOn, setIceOn] = useState(saved.iceOn)
  const [iceFactor, setIceFactor] = useState(saved.iceFactor)
  const [advTotal, setAdvTotal] = useState(saved.advTotal)
  const [advBloom, setAdvBloom] = useState(saved.advBloom)
  const [advNPours, setAdvNPours] = useState(saved.advNPours)
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

  // Beans (Phase 3 Feature #2 — per-user Supabase table).
  const [beans, setBeans] = useState([])
  const [selectedBeanId, setSelectedBeanId] = useState(saved.beanId || '')
  const [lowStock, setLowStock] = useState([])
  const refreshBeans = () => {
    if (!user) return
    listBeans().then(setBeans).catch(() => {})
  }
  useEffect(() => { refreshBeans() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps
  // Low-stock reminder settings (configurable in Profile; per-account metadata).
  const reminderEnabled = user?.user_metadata?.reminderEnabled !== false // default on
  const reminderDays = Number(user?.user_metadata?.reminderDays) > 0 ? Number(user.user_metadata.reminderDays) : 7
  const beansKey = beans.map((b) => `${b.id}:${b.remaining}`).join(',')
  useEffect(() => {
    if (!user || !beans.length || !reminderEnabled) { setLowStock([]); return }
    getLowStockBeans(beans, reminderDays).then(setLowStock).catch(() => {})
  }, [user, beansKey, reminderEnabled, reminderDays]) // eslint-disable-line react-hooks/exhaustive-deps
  const selectedBean = beans.find((b) => b.id === selectedBeanId) || null

  // Grinders (per-account via Supabase user_metadata; default = Timemore C3S).
  const [grinders, setGrinders] = useState([defaultGrinder()])
  const [activeGrinderId, setActiveGrinderId] = useState(DEFAULT_GRINDER_ID)
  // Load the signed-in user's grinders on sign-in.
  useEffect(() => {
    const meta = user?.user_metadata
    if (meta?.grinders && Array.isArray(meta.grinders) && meta.grinders.length) setGrinders(meta.grinders)
    if (meta?.activeGrinderId) setActiveGrinderId(meta.activeGrinderId)
  }, [user])
  // Persist grinders per account (debounced), when signed in.
  const grindersKey = JSON.stringify({ grinders, activeGrinderId })
  const firstGrinderRun = useRef(true)
  useEffect(() => {
    if (firstGrinderRun.current) { firstGrinderRun.current = false; return }
    if (!user) return
    const t = setTimeout(() => {
      supabase.auth.updateUser({ data: { grinders, activeGrinderId } }).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [grindersKey, user]) // eslint-disable-line react-hooks/exhaustive-deps
  const activeGrinder = grinders.find((g) => g.id === activeGrinderId) || grinders[0] || defaultGrinder()
  const addGrinder = (g) => {
    setGrinders((prev) => (prev.some((x) => x.id === g.id) ? prev : [...prev, g]))
    setActiveGrinderId(g.id)
  }
  const removeGrinder = (id) => {
    setGrinders((prev) => {
      const next = prev.filter((x) => x.id !== id)
      const list = next.length ? next : [defaultGrinder()]
      if (activeGrinderId === id) setActiveGrinderId(list[0].id)
      return list
    })
  }

  const method = v60Method
  const isAdvanced = v60Method === 'advanced'
  const isV60Preset = v60Method !== 'advanced'

  // Number of pours after bloom — drives the timer rows (independent of validity).
  const pourCount = useMemo(() => {
    if (v60Method === 'advanced') return Math.max(0, Math.trunc(num(advNPours) || 0))
    return V60_POURS[v60Method]
  }, [v60Method, advNPours])

  const lapSteps = useMemo(() => lapStepsFor(pourCount), [pourCount])
  const terminalKey = lapSteps[lapSteps.length - 1].key
  const timer = useBrewTimer()

  // Reset the timer + captured laps when the brew shape changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => timer.clear(), [v60Method, pourCount])

  const inputs = useMemo(() => {
    const base = { instrument: 'v60', method: v60Method, dose: num(dose), iceOn, iceFactor: num(iceFactor) }
    if (v60Method === 'advanced') {
      return { ...base, ratio: num(ratio), totalWater: num(advTotal), bloom: num(advBloom), nPours: num(advNPours) }
    }
    return { ...base, ratio: num(ratio) }
  }, [v60Method, dose, ratio, iceOn, iceFactor, advTotal, advBloom, advNPours])

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
    const keys = new Set(['dose', 'ratio'])
    if (iceOn) keys.add('iceFactor')
    if (isAdvanced) { keys.add('totalWater'); keys.add('nPours'); keys.add('bloom') }
    return keys
  }, [iceOn, isAdvanced])
  const unmappedErrors = result.valid ? [] : result.errors.filter((e) => !visibleFieldKeys.has(e.field))

  // Soft warnings (D2): flag atypical-but-valid values without blocking the recipe.
  const fieldWarnings = useMemo(() => {
    const w = {}
    const out = (v, lo, hi) => v != null && (v < lo || v > hi)
    const r = num(ratio)
    if (out(r, 13, 20)) w.ratio = 'Unusual ratio — most V60 recipes are 15–18×.'
    if (iceOn) {
      const f = num(iceFactor)
      if (out(f, 0.25, 0.55)) w.iceFactor = 'Unusual — ice factor is typically 0.3–0.5×.'
    }
    return w
  }, [ratio, iceOn, iceFactor])

  // Persist inputs across sessions.
  useEffect(() => {
    const state = {
      v60Method, dose, ratio, iceOn, iceFactor, advTotal, advBloom, advNPours,
      bloomTime, grind, tempOn, waterTempC, beanId: selectedBeanId,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignore storage failures (private mode, quota) */
    }
  }, [v60Method, dose, ratio, iceOn, iceFactor, advTotal, advBloom, advNPours, bloomTime, grind, tempOn, waterTempC, selectedBeanId])

  const resetDefaults = () => {
    setRatio(DEFAULT_STATE.ratio)
    setIceOn(DEFAULT_STATE.iceOn)
    setIceFactor(DEFAULT_STATE.iceFactor)
    setAdvTotal(DEFAULT_STATE.advTotal)
    setAdvBloom(DEFAULT_STATE.advBloom)
    setAdvNPours(DEFAULT_STATE.advNPours)
    setBloomTime(DEFAULT_STATE.bloomTime)
    setGrind(DEFAULT_STATE.grind)
    setTempOn(DEFAULT_STATE.tempOn)
    setWaterTempC(DEFAULT_STATE.waterTempC)
  }

  const copyRecipe = async () => {
    if (!result.valid) return
    const lines = [`☕ V60 — ${METHOD_LABEL[method]}${iceOn ? ' (Ice)' : ''}`]
    lines.push(`Dose ${num(dose)} g`)
    if (iceOn) lines.push(`Total ${result.total} g · Ice ${result.ice} g · Brew ${result.brewWater} g`)
    else lines.push(`Total water ${result.total} g`)
    lines.push(`Bloom ${result.bloomWater} g (${bloomTime || '00:30'})`)
    lines.push('Pours (add → scale reads):')
    const pourSteps = result.steps.slice(1)
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
    const pourSteps = result.steps.slice(1) // V60 pours follow the bloom
    const payload = {
      brewName,
      instrument,
      method,
      withIce: iceOn,
      coffee: num(dose),
      totalWater: result.total,
      bloomWater: result.bloomWater,
      bloomTimeStr: timer.laps.bloom || bloomTime || '00:30',
      date: today,
      rating: rating === '' ? undefined : Number(rating),
      notes: notes || undefined,
      // pours: cumulative scale reading + lap time, one per pour.
      pours: pourSteps.map((s, i) => ({ water: s.cumulative, time: timer.laps[`pour${i + 1}`] || undefined })),
      ratio: num(ratio) ?? DEFAULTS.v60.ratio,
      nPours: result.nPours,
      grindSize: grind?.microns != null ? grindSummary(grind.microns, activeGrinder) : undefined,
      beanId: selectedBeanId || undefined,
      beanLabel: selectedBean ? `${selectedBean.brand} — ${selectedBean.coffeeName}` : undefined,
    }
    if (iceOn) {
      payload.ice = result.ice
      payload.iceFactor = result.iceFactor
      payload.brewWater = result.brewWater
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
    const sig = JSON.stringify({ v60Method, dose, ratio, iceOn, iceFactor, advTotal, advBloom, advNPours, bloomTime, laps: timer.laps, rating, notes, selectedBeanId })
    if (sig === lastSavedSig && !window.confirm('You already saved this brew. Save it again as a new Logbook entry?')) return
    setSaveStatus('saving')
    setSaveError('')
    try {
      await saveBrew(buildPayload())
      if (selectedBeanId) {
        await deductForBrew(selectedBeanId, num(dose))
        refreshBeans()
      }
      setLastSavedSig(sig)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 4000)
    } catch (e) {
      setSaveError(e.message)
      setSaveStatus('error')
    }
  }

  // Re-brew: load a logged brew's inputs back into the calculator. Historical
  // Filter Coffee entries can still be viewed in the Logbook, but Re-brew only
  // supports V60 (Decision #65) — Filter brews load V60 defaults instead.
  const reBrew = (brew) => {
    if (brew.coffee != null) setDose(String(brew.coffee))
    if (brew.instrument === 'v60') {
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
      if (brew.grindSize) setGrind({ format: 'clicks', microns: micronsFromSummary(brew.grindSize) })
    }
    if (brew.bloomTime) setBloomTime(brew.bloomTime)
    if (brew.beanId) setSelectedBeanId(brew.beanId)
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
          <h1 className="text-2xl font-bold tracking-tight">{view === 'logbook' ? 'Logbook' : view === 'equipment' ? 'Equipment' : view === 'beans' ? 'Beans' : view === 'profile' ? 'Profile' : 'Brew Calculator'}</h1>
          <p className="mt-1 text-sm text-muted">
            {view === 'logbook'
              ? 'Your saved brews — filter, review, edit, or brew again.'
              : view === 'equipment'
                ? 'Your grinders — the active one drives the calculator’s grind-size input.'
                : view === 'beans'
                  ? 'Your coffee inventory — add bags, track remaining stock, get a heads-up before you run out.'
                  : view === 'profile'
                    ? 'Your account, reminder settings, appearance, and session.'
                    : 'Scale-based pour targets. Tare the scale to zero after adding coffee — readings are cumulative.'}
          </p>
        </header>

        {/* Low-stock reminder (Phase 3 Feature #2, Logic.md "Bean Inventory") */}
        {user && lowStock.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-espresso/40 bg-tint px-3 py-2 text-sm text-espresso-700">
            <span>⚠️</span>
            <span>
              Running low: {lowStock.map(({ bean, daysRemaining: d }) => `${bean.brand} — ${bean.coffeeName} (~${Math.max(0, Math.round(d))}d left)`).join(', ')}
            </span>
            <button onClick={() => setView('beans')} className="ml-auto rounded-lg border border-espresso/40 px-2.5 py-1 text-xs font-medium text-espresso-700 hover:bg-espresso/10">
              View Beans
            </button>
          </div>
        )}

        {view === 'equipment' && (
          <Equipment
            grinders={grinders}
            activeGrinderId={activeGrinderId}
            setActiveGrinderId={setActiveGrinderId}
            onAddGrinder={addGrinder}
            onRemoveGrinder={removeGrinder}
          />
        )}

        {view === 'profile' &&
          (user ? (
            <Profile />
          ) : (
            <section className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
              <p className="text-muted">Sign in to manage your profile and settings.</p>
              <button onClick={() => setAuthOpen(true)} className="mt-3 rounded-lg bg-espresso px-4 py-2 text-sm font-medium text-white hover:bg-espresso-700">
                Sign in
              </button>
            </section>
          ))}

        {view === 'beans' &&
          (user ? (
            <Beans beans={beans} onRefresh={refreshBeans} />
          ) : (
            <section className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
              <p className="text-muted">Sign in to manage your coffee inventory.</p>
              <button onClick={() => setAuthOpen(true)} className="mt-3 rounded-lg bg-espresso px-4 py-2 text-sm font-medium text-white hover:bg-espresso-700">
                Sign in
              </button>
            </section>
          ))}

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
            {/* Brewing method selector (V60-only, Decision #65) */}
            <div className="mb-5">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Brewing method</span>
              <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
                {V60_METHODS.map((m) => {
                  const active = method === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => setV60Method(m.id)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${active ? 'bg-espresso text-white shadow' : 'text-muted hover:text-roast'}`}
                    >
                      {m.label}
                    </button>
                  )
                })}
                {/* Ice — a mode-altering switch (recomputes the recipe) */}
                <span className="ml-1 flex items-center px-3 py-2">
                  <Toggle checked={iceOn} onChange={setIceOn} label="Iced" />
                </span>
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

              {user && (
                <label className="block">
                  <span className="block text-xs font-medium text-muted">Bean <span className="font-normal text-muted">(optional — tracks inventory)</span></span>
                  <select
                    value={selectedBeanId}
                    onChange={(e) => setSelectedBeanId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30"
                  >
                    <option value="">— none —</option>
                    {beans.map((b) => (
                      <option key={b.id} value={b.id}>{b.brand} — {b.coffeeName} ({b.remaining}g left)</option>
                    ))}
                  </select>
                  {beans.length === 0 && (
                    <button type="button" onClick={() => setView('beans')} className="mt-1 text-xs font-medium text-espresso hover:text-espresso-700">
                      + Add your first coffee
                    </button>
                  )}
                </label>
              )}

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

              <TimeField label="Bloom time" value={bloomTime} onChange={setBloomTime} hint="Rest after the bloom pour" />

              <GrindInput
                grind={grind}
                setGrind={setGrind}
                grinder={activeGrinder}
                grinders={grinders}
                setActiveGrinderId={setActiveGrinderId}
                onAddGrinder={addGrinder}
              />

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
                  {shown.withIce && <Stat label="Ice (in vessel)" value={`${shown.ice} g`} />}
                  {shown.withIce && <Stat label="Brew water" value={`${shown.brewWater} g`} />}
                  <Stat label="Bloom" value={`${shown.bloomWater} g`} />
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
