import { useCallback, useEffect, useMemo, useState } from 'react'
import { List } from 'react-window'
import { listBrews, updateBrew, deleteBrew } from '../lib/logbook.js'

// Phase 2 Recipe Book (Task 7): Supabase-backed combined cross-instrument view,
// tablet table + right split detail, mobile cards → full-page detail, page-size
// selector + load-more (Supabase range pagination), virtualized list. Chip
// filters / date+time naming / column show-hide are Task 8.

const INSTRUMENT_LABEL = { v60: 'V60', filter: 'Filter Coffee', mokka: 'Mokka-Pot' }
const METHOD_LABEL = {
  '1-pour': '1-Pour', '3-pour': '3-Pour', '10-pour': '10-Pour', advanced: 'Advanced',
  'with-milk': 'With Milk', 'with-water': 'With Water',
}
const INSTRUMENT_COLOR = {
  v60: 'bg-blue-100 text-blue-800',
  filter: 'bg-orange-100 text-orange-800',
  mokka: 'bg-stone-100 text-stone-700',
}

const PAGE_SIZE_KEY = 'cbc-logbook-pagesize'
const PRESET_SIZES = [25, 30, 50]
const loadPageSize = () => {
  const n = parseInt(localStorage.getItem(PAGE_SIZE_KEY) || '25', 10)
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : 25
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
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${INSTRUMENT_COLOR[brew.instrument] || 'bg-stone-100 text-stone-700'}`}>
      {methodTitle(brew)}{brew.withIce ? ' · Ice' : ''}
    </span>
  )
}

// Grid templates shared by the table header + virtualized rows.
const COLS_FULL = 'minmax(112px,1.2fr) 52px 48px 48px 52px 44px 44px 44px 52px'
const COLS_COMPACT = 'minmax(140px,1fr) 64px 64px'

function TableHeader({ compact }) {
  const cells = compact ? ['Recipe', 'Coffee', 'Rating'] : ['Recipe', 'Coffee', 'Ratio', 'Ice', 'Bloom', 'P1', 'P2', 'P3', 'Rating']
  return (
    <div
      className="grid gap-2 border-b border-stone-200 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500"
      style={{ gridTemplateColumns: compact ? COLS_COMPACT : COLS_FULL }}
    >
      {cells.map((c, i) => (
        <div key={c} className={i === 0 ? '' : 'text-right'}>{c}</div>
      ))}
    </div>
  )
}

// react-window row: a table row (desktop) or a card (mobile).
function Row({ index, style, brews, selectedId, onSelect, compact, isDesktop }) {
  const b = brews[index]
  const selected = b.id === selectedId
  if (isDesktop) {
    const pour = (i) => (b.pours && b.pours[i] && b.pours[i].water != null ? b.pours[i].water : '—')
    return (
      <div style={style}>
        <div
          onClick={() => onSelect(b.id)}
          className={`grid h-11 cursor-pointer items-center gap-2 border-b border-stone-100 px-3 text-sm hover:bg-amber-50/60 ${selected ? 'bg-amber-50' : ''}`}
          style={{ gridTemplateColumns: compact ? COLS_COMPACT : COLS_FULL }}
        >
          <div className="min-w-0 truncate"><InstrumentBadge brew={b} /></div>
          <div className="text-right tabular-nums">{b.coffee != null ? `${b.coffee} g` : '—'}</div>
          {!compact && <div className="text-right tabular-nums">{b.ratio != null ? `1:${b.ratio}` : '—'}</div>}
          {!compact && <div className="text-right tabular-nums">{b.withIce && b.ice != null ? `${b.ice} g` : '—'}</div>}
          {!compact && <div className="text-right tabular-nums">{b.bloomWater != null ? `${b.bloomWater} g` : '—'}</div>}
          {!compact && <div className="text-right tabular-nums">{pour(0)}</div>}
          {!compact && <div className="text-right tabular-nums">{pour(1)}</div>}
          {!compact && <div className="text-right tabular-nums">{pour(2)}</div>}
          <div className="text-right tabular-nums">{b.rating != null ? `${b.rating}/10` : '—'}</div>
        </div>
      </div>
    )
  }
  // Mobile card
  return (
    <div style={style} className="px-0.5 pb-3">
      <button
        onClick={() => onSelect(b.id)}
        className={`block h-full w-full rounded-xl border bg-white p-4 text-left shadow-sm hover:border-amber-400 ${selected ? 'border-amber-400' : 'border-stone-200'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <InstrumentBadge brew={b} />
          {b.rating != null && <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-0.5 text-sm font-semibold text-amber-800">{b.rating}/10</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-500">
          <span>{b.coffee != null ? `${b.coffee} g` : '—'} dose</span>
          {b.ratio != null && <span>· 1:{b.ratio}</span>}
          {b.withIce && b.ice != null && <span>· {b.ice} g ice</span>}
          {b.totalWater != null && <span>· {b.totalWater} g total</span>}
        </div>
      </button>
    </div>
  )
}

// Convert a brew (rowToBrew shape) back to the update payload shape, so the full
// row is preserved on update (brewToRow sets every column).
function brewToPayload(b) {
  return {
    id: b.id,
    instrument: b.instrument,
    method: b.methodId,
    withIce: b.withIce,
    brewName: b.name,
    coffee: b.coffee,
    ratio: b.ratio,
    totalWater: b.totalWater,
    bloomWater: b.bloomWater,
    brewWater: b.brewWater,
    ice: b.ice,
    iceFactor: b.iceFactor,
    milk: b.milk,
    milkRatio: b.milkRatio,
    dilutionRatio: b.dilutionRatio,
    dilutionWater: b.dilutionWater,
    bloomTimeStr: b.bloomTime,
    drawdownTime: b.drawdownTime,
    grindSize: b.grindSize,
    waterTemp: b.waterTemp,
    rating: b.rating,
    notes: b.notes,
    pours: b.pours,
  }
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className="text-sm font-semibold text-stone-900">{value}</div>
    </div>
  )
}

function Detail({ brew, onClose, onRebrew, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [state, setState] = useState('idle') // idle | saving | deleting | error
  const [error, setError] = useState('')

  // editable metadata only — water amounts + pours are locked (Re-brew recomputes).
  const startEdit = () => {
    setForm({
      name: brew.name || '',
      rating: brew.rating == null ? '' : String(brew.rating),
      notes: brew.notes || '',
      grindSize: brew.grindSize || '',
      waterTemp: brew.waterTemp || '',
      bloomTime: brew.bloomTime || '',
    })
    setError('')
    setState('idle')
    setEditing(true)
  }

  const save = async () => {
    setState('saving')
    setError('')
    try {
      const payload = {
        ...brewToPayload(brew),
        brewName: form.name,
        rating: form.rating === '' ? null : Number(form.rating),
        notes: form.notes,
        grindSize: brew.instrument === 'v60' ? form.grindSize : brew.grindSize,
        waterTemp: form.waterTemp,
        bloomTimeStr: brew.instrument === 'v60' ? form.bloomTime : brew.bloomTime,
      }
      await updateBrew(payload)
      setEditing(false)
      setState('idle')
      onSaved()
    } catch (e) {
      setError(e.message)
      setState('error')
    }
  }

  const remove = async () => {
    if (!window.confirm('Delete this brew permanently? This cannot be undone.')) return
    setState('deleting')
    setError('')
    try {
      await deleteBrew(brew.id)
      onClose()
      onSaved()
    } catch (e) {
      setError(e.message)
      setState('error')
    }
  }

  const isV60 = brew.instrument === 'v60'
  const pours = Array.isArray(brew.pours) ? brew.pours : []

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={onClose} className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:border-stone-400">
          <span className="md:hidden">← Back</span>
          <span className="hidden md:inline">✕ Close</span>
        </button>
        <div className="ml-auto flex gap-2">
          {!editing ? (
            <>
              <button onClick={startEdit} className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-amber-600 hover:text-amber-800">Edit</button>
              <button onClick={remove} disabled={state === 'deleting'} className="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:border-red-500 hover:bg-red-50 disabled:opacity-50">
                {state === 'deleting' ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => onRebrew(brew)} className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800">Re-brew</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-stone-400">Cancel</button>
              <button onClick={save} disabled={state === 'saving'} className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50">
                {state === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Heading = date & time + instrument (PRD §4.3) */}
      <div className="mb-3">
        <h3 className="text-base font-semibold text-stone-900">{fmtDateTime(brew)}</h3>
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

          {/* Pour schedule (calculator-like) */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-1.5 font-medium">Step</th>
                <th className="py-1.5 text-right font-medium">Reads (g)</th>
                <th className="py-1.5 pl-2 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {isV60 && (
                <tr className="border-b border-stone-100">
                  <td className="py-1.5 font-medium text-stone-800">Bloom</td>
                  <td className="py-1.5 text-right tabular-nums">{brew.bloomWater ?? '—'}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{brew.bloomTime || '—'}</td>
                </tr>
              )}
              {pours.map((p, i) => (
                <tr key={i} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5 font-medium text-stone-800">{brew.instrument === 'filter' ? 'Pour' : `Pour ${i + 1}`}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.water ?? '—'}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{p.time || '—'}</td>
                </tr>
              ))}
              {brew.drawdownTime && (
                <tr className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5 font-medium text-stone-800">Drawdown end</td>
                  <td className="py-1.5 text-right tabular-nums">—</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{brew.drawdownTime}</td>
                </tr>
              )}
            </tbody>
          </table>

          {brew.rating != null && <p className="mt-3 text-sm font-medium text-amber-800">Rating {brew.rating}/10</p>}
          {brew.notes && <p className="mt-2 text-sm italic text-stone-600">“{brew.notes}”</p>}
        </>
      ) : (
        <div className="space-y-3">
          <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
            Water amounts &amp; pours are locked — use <span className="font-medium">Re-brew</span> to recompute them.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">Name</span>
            <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-600" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">Rating /10</span>
            <input type="number" min="0" max="10" value={form.rating} onChange={(e) => setForm((s) => ({ ...s, rating: e.target.value }))} onWheel={(e) => e.currentTarget.blur()} className="mt-1 w-24 rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-600" />
          </label>
          {isV60 && (
            <>
              <label className="block">
                <span className="block text-xs font-medium text-stone-600">Grind size</span>
                <input value={form.grindSize} onChange={(e) => setForm((s) => ({ ...s, grindSize: e.target.value }))} className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-600" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-stone-600">Bloom time</span>
                <input value={form.bloomTime} onChange={(e) => setForm((s) => ({ ...s, bloomTime: e.target.value }))} className="mt-1 w-28 rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-600" />
              </label>
            </>
          )}
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">Water temp</span>
            <input value={form.waterTemp} onChange={(e) => setForm((s) => ({ ...s, waterTemp: e.target.value }))} className="mt-1 w-28 rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-600" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-stone-600">Tasting notes</span>
            <textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-600" />
          </label>
        </div>
      )}
    </div>
  )
}

function PageSizeSelector({ pageSize, onChange }) {
  // `custom` is its own mode so selecting "Custom" reveals the input even when the
  // current size happens to equal a preset (avoids a chicken-and-egg).
  const [custom, setCustom] = useState(!PRESET_SIZES.includes(pageSize))
  return (
    <div className="flex items-center gap-1 text-xs text-stone-500">
      <span>Page size</span>
      <select
        value={custom ? 'custom' : String(pageSize)}
        onChange={(e) => {
          if (e.target.value === 'custom') {
            setCustom(true)
          } else {
            setCustom(false)
            onChange(Number(e.target.value))
          }
        }}
        className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-stone-700 outline-none focus:border-amber-600"
      >
        {PRESET_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        <option value="custom">Custom</option>
      </select>
      {custom && (
        <input
          type="number"
          min="1"
          max="100"
          value={pageSize}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10)
            if (Number.isFinite(n) && n >= 1 && n <= 100) onChange(n)
          }}
          onWheel={(e) => e.currentTarget.blur()}
          className="w-16 rounded-lg border border-stone-300 px-2 py-1 text-stone-700 outline-none focus:border-amber-600"
        />
      )}
    </div>
  )
}

export default function Logbook({ onRebrew }) {
  const isDesktop = useIsDesktop()
  const [status, setStatus] = useState('loading') // loading | loaded | error
  const [brews, setBrews] = useState([])
  const [total, setTotal] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [pageSize, setPageSize] = useState(loadPageSize)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (size) => {
    setStatus('loading')
    setError('')
    setSelectedId(null)
    try {
      const { brews: page, total: count } = await listBrews({ limit: size, offset: 0 })
      setBrews(page)
      setTotal(count)
      setStatus('loaded')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load(pageSize)
  }, [load, pageSize])

  const changePageSize = (n) => {
    localStorage.setItem(PAGE_SIZE_KEY, String(n))
    setPageSize(n)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const { brews: page, total: count } = await listBrews({ limit: pageSize, offset: brews.length })
      setBrews((prev) => [...prev, ...page])
      setTotal(count)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const selected = brews.find((b) => b.id === selectedId) || null
  const hasMore = total != null && brews.length < total
  const refresh = () => load(pageSize)

  const listHeight = isDesktop ? 460 : Math.round((typeof window !== 'undefined' ? window.innerHeight : 700) * 0.6)
  const rowHeight = isDesktop ? 44 : 96
  const rowProps = { brews, selectedId, onSelect: setSelectedId, compact: isDesktop && !!selected, isDesktop }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Logbook</h2>
        <div className="flex items-center gap-3">
          <PageSizeSelector pageSize={pageSize} onChange={changePageSize} />
          <button onClick={refresh} disabled={status === 'loading'} className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-amber-600 hover:text-amber-800 disabled:opacity-50">
            {status === 'loading' ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {status === 'loading' && <p className="text-sm text-stone-500">Loading your brews…</p>}

      {status === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Couldn’t load the logbook.</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {status === 'loaded' && brews.length === 0 && (
        <p className="text-sm text-stone-500">No brews logged yet. Calculate a recipe and tap “Save to Logbook”.</p>
      )}

      {status === 'loaded' && brews.length > 0 && (
        <>
          {/* Mobile: full-page detail replaces the list when a brew is selected. */}
          {!isDesktop && selected ? (
            <Detail brew={selected} onClose={() => setSelectedId(null)} onRebrew={onRebrew} onSaved={refresh} />
          ) : (
            <div className="md:flex md:items-start md:gap-4">
              <div className="md:min-w-0 md:flex-1">
                {isDesktop && (
                  <div className="overflow-hidden rounded-lg border border-stone-200">
                    <TableHeader compact={!!selected} />
                    <List rowComponent={Row} rowCount={brews.length} rowHeight={rowHeight} rowProps={rowProps} style={{ height: listHeight }} />
                  </div>
                )}
                {!isDesktop && (
                  <List rowComponent={Row} rowCount={brews.length} rowHeight={rowHeight} rowProps={rowProps} style={{ height: listHeight }} />
                )}

                <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                  <span>Showing {brews.length}{total != null ? ` of ${total}` : ''}</span>
                  {hasMore && (
                    <button onClick={loadMore} disabled={loadingMore} className="rounded-lg border border-stone-300 px-3 py-1 font-medium text-stone-700 hover:border-amber-600 hover:text-amber-800 disabled:opacity-50">
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop: right split detail panel. */}
              {isDesktop && selected && (
                <div className="mt-4 md:mt-0 md:w-96 md:shrink-0 md:border-l md:border-stone-200 md:pl-4">
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
