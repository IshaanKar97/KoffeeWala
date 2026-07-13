import { useEffect, useState } from 'react'
import { browseCatalog, addBeanFromCatalog } from '../lib/beans.js'

const ROAST_LEVELS = ['Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// Quick-add: only Roast Date (defaults to today, editable) + Amount are asked —
// every other field carries over from the catalog entry as-is (§13.3).
function QuickAddForm({ entry, onAdded, onClose }) {
  const [roastDate, setRoastDate] = useState(todayISO())
  const [amount, setAmount] = useState(entry.lastAmount ? String(entry.lastAmount) : '')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setStatus('saving'); setError('')
    try {
      await addBeanFromCatalog(entry, { roastDate, amount: Number(amount) })
      onAdded()
    } catch (err) {
      setError(err.message); setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-roast/30 p-4 md:items-center" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-lg">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Add {entry.brand} — {entry.coffeeName}</h3>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Roast date</span>
          <input required type="date" value={roastDate} onChange={(e) => setRoastDate(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Amount (g)</span>
          <input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} onWheel={(e) => e.currentTarget.blur()} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30" />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-roast hover:border-muted">Cancel</button>
          <button type="submit" disabled={status === 'saving'} className="rounded-lg bg-espresso px-3 py-1.5 text-sm font-medium text-white hover:bg-espresso-700 disabled:opacity-50">
            {status === 'saving' ? 'Adding…' : 'Add to my beans'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Browse Catalog (Phase 3 Feature #3 — PRD §13.3 / Decision #67): every
 *  coffee in the shared repository (scraped + user-submitted), filterable by
 *  search text (brand/name/tasting notes), roast level, and altitude. Adding
 *  from here only asks for Roast Date + Amount — everything else carries over. */
export default function CatalogBrowser({ onClose, onAdded }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roastLevel, setRoastLevel] = useState('')
  const [altitude, setAltitude] = useState('')
  const [addTarget, setAddTarget] = useState(null)

  useEffect(() => {
    setLoading(true)
    const handle = setTimeout(() => {
      browseCatalog({ search, roastLevel, altitude }).then((r) => { setEntries(r); setLoading(false) })
    }, 200) // debounce free-text filters
    return () => clearTimeout(handle)
  }, [search, roastLevel, altitude])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-roast/30 p-4 md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-surface p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Browse Coffee Repository</h3>
          <button onClick={onClose} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-roast hover:border-muted">Close</button>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand, coffee, or notes…"
            className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30 sm:col-span-1"
          />
          <select value={roastLevel} onChange={(e) => setRoastLevel(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30">
            <option value="">All roast levels</option>
            {ROAST_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input
            value={altitude}
            onChange={(e) => setAltitude(e.target.value)}
            placeholder="Altitude contains…"
            className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {loading && <p className="text-sm text-muted">Loading…</p>}
          {!loading && entries.length === 0 && <p className="text-sm text-muted">No coffees match those filters.</p>}
          {!loading && entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-line bg-surface2 px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-roast">{entry.brand} — {entry.coffeeName}</span>
                    {entry.source === 'scraped' && (
                      <span className="rounded bg-espresso px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
                        {entry.roastery || 'Sourced'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {[entry.roastLevel && `${entry.roastLevel} roast`, entry.variety, entry.process].filter(Boolean).join(' · ')}
                  </div>
                  <div className="text-xs text-muted">
                    {[entry.originEstate, entry.originRegion, entry.originCountry, entry.altitude].filter(Boolean).join(' · ')}
                  </div>
                  {entry.tastingNotes && <div className="mt-0.5 text-xs italic text-muted">"{entry.tastingNotes}"</div>}
                </div>
                <button onClick={() => setAddTarget(entry)} className="shrink-0 rounded-lg bg-espresso px-2.5 py-1 text-xs font-medium text-white hover:bg-espresso-700">Add</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {addTarget && (
        <QuickAddForm
          entry={addTarget}
          onAdded={() => { setAddTarget(null); onAdded() }}
          onClose={() => setAddTarget(null)}
        />
      )}
    </div>
  )
}
