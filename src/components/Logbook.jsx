import { useCallback, useEffect, useRef, useState } from 'react'
import { List } from 'react-window'
import { listBrews, updateBrew, deleteBrew } from '../lib/logbook.js'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

// Phase 2 Recipe Book — Task 7 (combined view, split/full detail, list scaling,
// virtualized) + Task 8 (chip filters persisted per-account, date+time naming,
// column show/hide).

const INSTRUMENT_LABEL = { v60: 'V60', filter: 'Filter Coffee', mokka: 'Mokka-Pot' }
const METHOD_LABEL = {
  '1-pour': '1-Pour', '3-pour': '3-Pour', '10-pour': '10-Pour', advanced: 'Advanced',
  'with-milk': 'With Milk', 'with-water': 'With Water',
}
const INSTRUMENT_COLOR = {
  v60: 'bg-tint text-espresso-700',
  filter: 'bg-warnbg text-warn',
  mokka: 'bg-cream text-muted',
}

const PAGE_SIZE_KEY = 'cbc-logbook-pagesize'
const COLUMNS_KEY = 'cbc-logbook-columns'
const PRESET_SIZES = [25, 30, 50]
const loadPageSize = () => {
  const n = parseInt(localStorage.getItem(PAGE_SIZE_KEY) || '25', 10)
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : 25
}

// ---- columns -------------------------------------------------------------
const ALL_COLUMNS = [
  { key: 'name', label: 'Recipe', width: 'minmax(112px,1.4fr)', always: true },
  { key: 'coffee', label: 'Coffee', width: '64px', align: 'right' },
  { key: 'ratio', label: 'Ratio', width: '52px', align: 'right' },
  { key: 'ice', label: 'Ice', width: '52px', align: 'right' },
  { key: 'bloom', label: 'Bloom', width: '56px', align: 'right' },
  { key: 'total', label: 'Total', width: '58px', align: 'right' },
  ...Array.from({ length: 10 }, (_, i) => ({ key: `p${i + 1}w`, label: `P${i + 1}`, width: '46px', align: 'right' })),
  ...Array.from({ length: 10 }, (_, i) => ({ key: `p${i + 1}t`, label: `P${i + 1}t`, width: '58px', align: 'right' })),
  { key: 'grind', label: 'Grind', width: '96px' },
  { key: 'temp', label: 'Temp', width: '64px', align: 'right' },
  { key: 'drawdown', label: 'Draw', width: '60px', align: 'right' },
  { key: 'milk', label: 'Milk', width: '56px', align: 'right' },
  { key: 'dilution', label: 'Dilution', width: '64px', align: 'right' },
  { key: 'rating', label: 'Rating', width: '60px', align: 'right' },
]
const DEFAULT_VISIBLE = ['name', 'coffee', 'ratio', 'ice', 'bloom', 'p1w', 'p2w', 'p3w', 'rating']
const COMPACT_VISIBLE = ['name', 'coffee', 'rating']
const loadColumns = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY))
    if (Array.isArray(saved) && saved.length) return saved
  } catch { /* ignore */ }
  return DEFAULT_VISIBLE
}

const methodTitle = (b) => {
  const inst = INSTRUMENT_LABEL[b.instrument] || b.instrument || '—'
  const m = METHOD_LABEL[b.methodId] || b.methodId || ''
  return m ? `${inst} · ${m}` : inst
}
const fmtDateTime = (b) => {
  if (!b.createdAt) return b.date || ''
  const d = new Date(b.createdAt)
  if (Number.isNaN(d.getTime())) return b.date || ''
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const g = (v) => (v == null || v === '' ? '—' : `${v} g`)

function cellValue(key, b) {
  const mw = key.match(/^p(\d+)w$/)
  if (mw) { const p = b.pours && b.pours[+mw[1] - 1]; return p && p.water != null ? p.water : '—' }
  const mt = key.match(/^p(\d+)t$/)
  if (mt) { const p = b.pours && b.pours[+mt[1] - 1]; return p && p.time ? p.time : '—' }
  switch (key) {
    case 'coffee': return b.coffee != null ? `${b.coffee} g` : '—'
    case 'ratio': return b.ratio != null ? `1:${b.ratio}` : '—'
    case 'ice': return b.withIce && b.ice != null ? `${b.ice} g` : '—'
    case 'bloom': return b.bloomWater != null ? `${b.bloomWater} g` : '—'
    case 'total': return b.totalWater != null ? `${b.totalWater} g` : '—'
    case 'grind': return b.grindSize || '—'
    case 'temp': return b.waterTemp || '—'
    case 'drawdown': return b.drawdownTime || '—'
    case 'milk': return b.milk != null ? `${b.milk} g` : '—'
    case 'dilution': return b.dilutionWater != null ? `${b.dilutionWater} g` : '—'
    case 'rating': return b.rating != null ? `${b.rating}/10` : '—'
    default: return '—'
  }
}

function useIsDesktop() {
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setD(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return d
}

function InstrumentBadge({ brew }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${INSTRUMENT_COLOR[brew.instrument] || 'bg-cream text-roast'}`}>
      {methodTitle(brew)}{brew.withIce ? ' · Ice' : ''}
    </span>
  )
}

// ---- chip filters --------------------------------------------------------
const DEFAULT_FILTERS = { instrument: 'all', ice: 'all', ratingMin: 0, date: { mode: 'all', from: '', to: '' } }
const RATING_STEPS = [0, 3, 6, 7, 8, 9]

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${active ? 'border-espresso bg-espresso text-white' : 'border-line bg-surface text-muted hover:border-espresso'}`}
    >
      {children}
    </button>
  )
}

// A labelled category dropdown (native select, themed).
function FilterDropdown({ label, value, onChange, options }) {
  const active = value !== String(options[0][0])
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${active ? 'border-espresso bg-tint' : 'border-line bg-surface'}`}>
      <span className="text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-medium text-roast outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </span>
  )
}

function Filters({ filters, setFilters }) {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const setDate = (patch) => setFilters((f) => ({ ...f, date: { ...f.date, ...patch } }))
  // Quick chips toggle their filter on/off (ice pair is mutually exclusive).
  const toggleIce = (v) => set({ ice: filters.ice === v ? 'all' : v })
  const toggle7d = () => setDate({ mode: filters.date.mode === '7d' ? 'all' : '7d' })
  const toggleFilterInst = () => set({ instrument: filters.instrument === 'filter' ? 'all' : 'filter' })
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {/* Quick filters (chips) */}
      <Chip active={filters.ice === 'with'} onClick={() => toggleIce('with')}>With ice</Chip>
      <Chip active={filters.ice === 'without'} onClick={() => toggleIce('without')}>Without ice</Chip>
      <Chip active={filters.date.mode === '7d'} onClick={toggle7d}>Last 7 days</Chip>
      <Chip active={filters.instrument === 'filter'} onClick={toggleFilterInst}>Filter coffee</Chip>

      <span className="mx-1 h-4 w-px bg-line" />

      {/* Category dropdowns (full control) */}
      <FilterDropdown label="Instrument" value={filters.instrument} onChange={(v) => set({ instrument: v })} options={[['all', 'All'], ['v60', 'V60'], ['filter', 'Filter Coffee']]} />
      <FilterDropdown label="Rating" value={String(filters.ratingMin)} onChange={(v) => set({ ratingMin: Number(v) })} options={[['0', 'Any'], ...RATING_STEPS.filter((r) => r > 0).map((r) => [String(r), `${r}+`])]} />
      <FilterDropdown label="Date" value={filters.date.mode} onChange={(v) => setDate({ mode: v })} options={[['all', 'All'], ['today', 'Today'], ['7d', 'Last 7d'], ['30d', 'Last 30d'], ['custom', 'Custom']]} />
      {filters.date.mode === 'custom' && (
        <span className="flex items-center gap-1 text-xs text-muted">
          <input type="date" value={filters.date.from} onChange={(e) => setDate({ from: e.target.value })} className="rounded border border-line bg-surface px-1.5 py-0.5 outline-none focus:border-espresso" />
          <span>→</span>
          <input type="date" value={filters.date.to} onChange={(e) => setDate({ to: e.target.value })} className="rounded border border-line bg-surface px-1.5 py-0.5 outline-none focus:border-espresso" />
        </span>
      )}
    </div>
  )
}

function ColumnsMenu({ visible, setVisible }) {
  const [open, setOpen] = useState(false)
  const toggle = (key) => {
    setVisible((cur) => {
      const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
      // keep canonical order
      return ALL_COLUMNS.filter((c) => next.includes(c.key)).map((c) => c.key)
    })
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg border border-line px-3 py-1 text-xs font-medium text-roast hover:border-espresso hover:text-espresso-700">
        Columns ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-72 w-44 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-lg">
            {ALL_COLUMNS.map((c) => (
              <label key={c.key} className={`flex items-center gap-2 px-1 py-0.5 text-xs ${c.always ? 'text-muted' : 'text-roast'}`}>
                <input
                  type="checkbox"
                  checked={visible.includes(c.key)}
                  disabled={c.always}
                  onChange={() => toggle(c.key)}
                  className="h-3.5 w-3.5 rounded border-line text-espresso focus:ring-espresso"
                />
                {c.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---- rows ----------------------------------------------------------------
function Row({ index, style, brews, selectedId, onSelect, columns, gridTemplate, isDesktop }) {
  const b = brews[index]
  const selected = b.id === selectedId
  if (isDesktop) {
    return (
      <div style={style}>
        <div
          onClick={() => onSelect(b.id)}
          className={`grid h-11 cursor-pointer items-center gap-2 border-b border-cream px-3 text-sm hover:bg-tint/60 ${selected ? 'bg-tint' : ''}`}
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {columns.map((c) =>
            c.key === 'name' ? (
              <div key="name" className="min-w-0">
                <div className="truncate font-medium text-roast">{fmtDateTime(b)}</div>
                <div className="truncate"><InstrumentBadge brew={b} /></div>
              </div>
            ) : (
              <div key={c.key} className={`tabular-nums ${c.align === 'right' ? 'text-right' : ''} truncate`}>{cellValue(c.key, b)}</div>
            )
          )}
        </div>
      </div>
    )
  }
  return (
    <div style={style} className="px-0.5 pb-3">
      <button
        onClick={() => onSelect(b.id)}
        className={`block h-full w-full rounded-xl border bg-surface p-4 text-left shadow-sm hover:border-espresso ${selected ? 'border-espresso' : 'border-line'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="font-medium text-roast">{fmtDateTime(b)}</span>
          {b.rating != null && <span className="shrink-0 rounded-lg bg-tint px-2 py-0.5 text-sm font-semibold text-espresso-700">{b.rating}/10</span>}
        </div>
        <div className="mt-1"><InstrumentBadge brew={b} /></div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          <span>{b.coffee != null ? `${b.coffee} g` : '—'} dose</span>
          {b.ratio != null && <span>· 1:{b.ratio}</span>}
          {b.withIce && b.ice != null && <span>· {b.ice} g ice</span>}
          {b.totalWater != null && <span>· {b.totalWater} g total</span>}
        </div>
      </button>
    </div>
  )
}

function brewToPayload(b) {
  return {
    id: b.id, instrument: b.instrument, method: b.methodId, withIce: b.withIce,
    brewName: b.name, coffee: b.coffee, ratio: b.ratio, totalWater: b.totalWater,
    bloomWater: b.bloomWater, brewWater: b.brewWater, ice: b.ice, iceFactor: b.iceFactor,
    milk: b.milk, milkRatio: b.milkRatio, dilutionRatio: b.dilutionRatio, dilutionWater: b.dilutionWater,
    bloomTimeStr: b.bloomTime, drawdownTime: b.drawdownTime, grindSize: b.grindSize,
    waterTemp: b.waterTemp, rating: b.rating, notes: b.notes, pours: b.pours,
  }
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm font-semibold text-roast">{value}</div>
    </div>
  )
}

function Detail({ brew, onClose, onRebrew, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const isV60 = brew.instrument === 'v60'
  const pours = Array.isArray(brew.pours) ? brew.pours : []

  const startEdit = () => {
    setForm({
      name: brew.name || '', rating: brew.rating == null ? '' : String(brew.rating), notes: brew.notes || '',
      grindSize: brew.grindSize || '', waterTemp: brew.waterTemp || '', bloomTime: brew.bloomTime || '',
    })
    setError(''); setState('idle'); setEditing(true)
  }

  const save = async () => {
    setState('saving'); setError('')
    try {
      await updateBrew({
        ...brewToPayload(brew),
        brewName: form.name,
        rating: form.rating === '' ? null : Number(form.rating),
        notes: form.notes,
        grindSize: isV60 ? form.grindSize : brew.grindSize,
        waterTemp: form.waterTemp,
        bloomTimeStr: isV60 ? form.bloomTime : brew.bloomTime,
      })
      setEditing(false); setState('idle'); onSaved()
    } catch (e) { setError(e.message); setState('error') }
  }

  const remove = async () => {
    if (!window.confirm('Delete this brew permanently? This cannot be undone.')) return
    setState('deleting'); setError('')
    try { await deleteBrew(brew.id); onClose(); onSaved() } catch (e) { setError(e.message); setState('error') }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={onClose} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-roast hover:border-muted">
          <span className="md:hidden">← Back</span>
          <span className="hidden md:inline">✕ Close</span>
        </button>
        <div className="ml-auto flex gap-2">
          {!editing ? (
            <>
              <button onClick={startEdit} className="rounded-lg border border-line px-3 py-1 text-xs font-medium text-roast hover:border-espresso hover:text-espresso-700">Edit</button>
              <button onClick={remove} disabled={state === 'deleting'} className="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:border-red-500 hover:bg-red-50 disabled:opacity-50">
                {state === 'deleting' ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => onRebrew(brew)} className="rounded-lg bg-espresso px-3 py-1 text-xs font-medium text-white hover:bg-espresso-700">Re-brew</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="rounded-lg border border-line px-3 py-1 text-xs font-medium text-roast hover:border-muted">Cancel</button>
              <button onClick={save} disabled={state === 'saving'} className="rounded-lg bg-espresso px-3 py-1 text-xs font-medium text-white hover:bg-espresso-700 disabled:opacity-50">
                {state === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-3">
        <h3 className="text-base font-semibold text-roast">{fmtDateTime(brew)}</h3>
        <div className="mt-1"><InstrumentBadge brew={brew} /></div>
      </div>

      {state === 'error' && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {!editing ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Stat label="Coffee" value={g(brew.coffee)} />
            <Stat label={isV60 ? 'Ratio' : 'Water ratio'} value={brew.ratio != null ? `1:${brew.ratio}` : '—'} />
            <Stat label="Total water" value={g(brew.totalWater)} />
            {brew.withIce && <Stat label="Ice (in vessel)" value={g(brew.ice)} />}
            {brew.withIce && <Stat label="Brew water" value={g(brew.brewWater)} />}
            {isV60 && <Stat label="Bloom" value={g(brew.bloomWater)} />}
            {brew.milk != null && <Stat label="Milk to serve" value={g(brew.milk)} />}
            {brew.dilutionWater != null && <Stat label="Dilution water" value={g(brew.dilutionWater)} />}
            {brew.grindSize && <Stat label="Grind" value={brew.grindSize} />}
            {brew.waterTemp && <Stat label="Water temp" value={brew.waterTemp} />}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1.5 font-medium">Step</th>
                <th className="py-1.5 text-right font-medium">Reads (g)</th>
                <th className="py-1.5 pl-2 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {isV60 && (
                <tr className="border-b border-cream">
                  <td className="py-1.5 font-medium text-roast">Bloom</td>
                  <td className="py-1.5 text-right tabular-nums">{brew.bloomWater ?? '—'}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{brew.bloomTime || '—'}</td>
                </tr>
              )}
              {pours.map((p, i) => (
                <tr key={i} className="border-b border-cream last:border-0">
                  <td className="py-1.5 font-medium text-roast">{brew.instrument === 'filter' ? 'Pour' : `Pour ${i + 1}`}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.water ?? '—'}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{p.time || '—'}</td>
                </tr>
              ))}
              {brew.drawdownTime && (
                <tr className="border-b border-cream last:border-0">
                  <td className="py-1.5 font-medium text-roast">Drawdown end</td>
                  <td className="py-1.5 text-right tabular-nums">—</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{brew.drawdownTime}</td>
                </tr>
              )}
            </tbody>
          </table>

          {brew.rating != null && <p className="mt-3 text-sm font-medium text-espresso-700">Rating {brew.rating}/10</p>}
          {brew.notes && <p className="mt-2 text-sm italic text-muted">“{brew.notes}”</p>}
        </>
      ) : (
        <div className="space-y-3">
          <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
            Water amounts &amp; pours are locked — use <span className="font-medium">Re-brew</span> to recompute them.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-muted">Name</span>
            <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted">Rating /10</span>
            <input type="number" min="0" max="10" value={form.rating} onChange={(e) => setForm((s) => ({ ...s, rating: e.target.value }))} onWheel={(e) => e.currentTarget.blur()} className="mt-1 w-24 rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso" />
          </label>
          {isV60 && (
            <>
              <label className="block">
                <span className="block text-xs font-medium text-muted">Grind size</span>
                <input value={form.grindSize} onChange={(e) => setForm((s) => ({ ...s, grindSize: e.target.value }))} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted">Bloom time</span>
                <input value={form.bloomTime} onChange={(e) => setForm((s) => ({ ...s, bloomTime: e.target.value }))} className="mt-1 w-28 rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso" />
              </label>
            </>
          )}
          <label className="block">
            <span className="block text-xs font-medium text-muted">Water temp</span>
            <input value={form.waterTemp} onChange={(e) => setForm((s) => ({ ...s, waterTemp: e.target.value }))} className="mt-1 w-28 rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted">Tasting notes</span>
            <textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso" />
          </label>
        </div>
      )}
    </div>
  )
}

function PageSizeSelector({ pageSize, onChange }) {
  const [custom, setCustom] = useState(!PRESET_SIZES.includes(pageSize))
  return (
    <div className="flex items-center gap-1 text-xs text-muted">
      <span>Page size</span>
      <select
        value={custom ? 'custom' : String(pageSize)}
        onChange={(e) => { if (e.target.value === 'custom') setCustom(true); else { setCustom(false); onChange(Number(e.target.value)) } }}
        className="rounded-lg border border-line bg-surface px-2 py-1 text-roast outline-none focus:border-espresso"
      >
        {PRESET_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        <option value="custom">Custom</option>
      </select>
      {custom && (
        <input
          type="number" min="1" max="100" value={pageSize}
          onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n) && n >= 1 && n <= 100) onChange(n) }}
          onWheel={(e) => e.currentTarget.blur()}
          className="w-16 rounded-lg border border-line px-2 py-1 text-roast outline-none focus:border-espresso"
        />
      )}
    </div>
  )
}

export default function Logbook({ onRebrew }) {
  const isDesktop = useIsDesktop()
  const { user } = useAuth()
  const [status, setStatus] = useState('loading')
  const [brews, setBrews] = useState([])
  const [total, setTotal] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [pageSize, setPageSize] = useState(loadPageSize)
  const [loadingMore, setLoadingMore] = useState(false)
  const [visibleCols, setVisibleCols] = useState(loadColumns)
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, ...(user?.user_metadata?.logbook_filters || {}) }))
  const filtersKey = JSON.stringify(filters)

  // Persist columns (localStorage).
  useEffect(() => { localStorage.setItem(COLUMNS_KEY, JSON.stringify(visibleCols)) }, [visibleCols])

  // Persist filters server-side per account (Supabase auth user_metadata), debounced.
  const firstFilterRun = useRef(true)
  useEffect(() => {
    if (firstFilterRun.current) { firstFilterRun.current = false; return }
    const t = setTimeout(() => {
      supabase.auth.updateUser({ data: { logbook_filters: filters } }).catch(() => { /* non-fatal */ })
    }, 800)
    return () => clearTimeout(t)
  }, [filtersKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (size, f) => {
    setStatus('loading'); setError(''); setSelectedId(null)
    try {
      const { brews: page, total: count } = await listBrews({ limit: size, offset: 0, filters: f })
      setBrews(page); setTotal(count); setStatus('loaded')
    } catch (e) { setError(e.message); setStatus('error') }
  }, [])

  useEffect(() => { load(pageSize, filters) }, [load, pageSize, filtersKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const changePageSize = (n) => { localStorage.setItem(PAGE_SIZE_KEY, String(n)); setPageSize(n) }

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const { brews: page, total: count } = await listBrews({ limit: pageSize, offset: brews.length, filters })
      setBrews((prev) => [...prev, ...page]); setTotal(count)
    } catch (e) { setError(e.message) } finally { setLoadingMore(false) }
  }

  const selected = brews.find((b) => b.id === selectedId) || null
  const hasMore = total != null && brews.length < total
  const refresh = () => load(pageSize, filters)

  // Effective columns: compact set when a detail is open beside the table.
  const effectiveKeys = isDesktop && selected ? COMPACT_VISIBLE : visibleCols
  const columns = ALL_COLUMNS.filter((c) => effectiveKeys.includes(c.key))
  const gridTemplate = columns.map((c) => c.width).join(' ')

  const rowHeight = isDesktop ? 44 : 116
  // Adaptive height (D6): fit the rows, capped — no big empty area with few brews.
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800
  const listHeight = isDesktop
    ? Math.min(460, Math.max(rowHeight * 2, brews.length * rowHeight + 8))
    : Math.min(Math.round(viewportH * 0.62), brews.length * rowHeight + 12)
  const rowProps = { brews, selectedId, onSelect: setSelectedId, columns, gridTemplate, isDesktop }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Logbook</h2>
        <div className="flex items-center gap-3">
          <PageSizeSelector pageSize={pageSize} onChange={changePageSize} />
          {isDesktop && <ColumnsMenu visible={visibleCols} setVisible={setVisibleCols} />}
          <button onClick={refresh} disabled={status === 'loading'} className="rounded-lg border border-line px-3 py-1 text-xs font-medium text-roast hover:border-espresso hover:text-espresso-700 disabled:opacity-50">
            {status === 'loading' ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Mobile full-page detail replaces everything; otherwise show filters + list. */}
      {!isDesktop && selected ? (
        <Detail brew={selected} onClose={() => setSelectedId(null)} onRebrew={onRebrew} onSaved={refresh} />
      ) : (
        <>
          <Filters filters={filters} setFilters={setFilters} />

          {status === 'loading' && <p className="text-sm text-muted">Loading your brews…</p>}

          {status === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-medium">Couldn’t load the logbook.</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {status === 'loaded' && brews.length === 0 && (
            <p className="text-sm text-muted">No brews match these filters.</p>
          )}

          {status === 'loaded' && brews.length > 0 && (
            <div className="md:flex md:items-start md:gap-4">
              <div className="md:min-w-0 md:flex-1">
                {isDesktop ? (
                  <div className="overflow-hidden rounded-lg border border-line">
                    <div
                      className="grid gap-2 border-b border-line px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted"
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      {columns.map((c) => <div key={c.key} className={c.align === 'right' ? 'text-right' : ''}>{c.label}</div>)}
                    </div>
                    <List rowComponent={Row} rowCount={brews.length} rowHeight={rowHeight} rowProps={rowProps} style={{ height: listHeight }} />
                  </div>
                ) : (
                  <List rowComponent={Row} rowCount={brews.length} rowHeight={rowHeight} rowProps={rowProps} style={{ height: listHeight }} />
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>Showing {brews.length}{total != null ? ` of ${total}` : ''}</span>
                  {hasMore && (
                    <button onClick={loadMore} disabled={loadingMore} className="rounded-lg border border-line px-3 py-1 font-medium text-roast hover:border-espresso hover:text-espresso-700 disabled:opacity-50">
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  )}
                </div>
              </div>

              {isDesktop && selected && (
                <div className="md:w-96 md:shrink-0 md:border-l md:border-line md:pl-4">
                  <Detail brew={selected} onClose={() => setSelectedId(null)} onRebrew={onRebrew} onSaved={refresh} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
