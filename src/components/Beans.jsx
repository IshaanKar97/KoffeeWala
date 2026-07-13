import { useEffect, useState } from 'react'
import { addBean, replenishBean, updateBeanAmounts, searchCatalogBrands, searchCatalogNames, findCatalogMatch } from '../lib/beans.js'

// Roast levels (light → dark) for the optional bean-profile dropdown.
const ROAST_LEVELS = ['Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark']

// Phase 3 Feature #2 (Decision #65) — Bean Repository UI.
// Brand + Coffee Name are independent autocomplete fields (client-confirmed);
// when the pair exactly matches a Global Coffee Catalog entry, Amount is
// prefilled (editable) — Roast Date is never prefilled.
export function AddBeanForm({ onAdded, onClose }) {
  const [brand, setBrand] = useState('')
  const [coffeeName, setCoffeeName] = useState('')
  const [roastDate, setRoastDate] = useState('')
  const [amount, setAmount] = useState('')
  const [altitude, setAltitude] = useState('')
  const [roastLevel, setRoastLevel] = useState('')
  const [notes, setNotes] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [brands, setBrands] = useState([])
  const [names, setNames] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => { searchCatalogBrands().then(setBrands) }, [])
  useEffect(() => { searchCatalogNames().then(setNames) }, [])

  // Prefill Amount on an exact Brand+Name catalog match, unless the user has
  // already edited Amount themselves this session.
  useEffect(() => {
    if (!brand.trim() || !coffeeName.trim() || amountTouched) return
    let cancelled = false
    findCatalogMatch(brand, coffeeName).then((m) => {
      if (!cancelled && m?.amount != null) setAmount(String(m.amount))
    })
    return () => { cancelled = true }
  }, [brand, coffeeName, amountTouched])

  const submit = async (e) => {
    e.preventDefault()
    setStatus('saving'); setError('')
    try {
      await addBean({
        brand: brand.trim(),
        coffeeName: coffeeName.trim(),
        roastDate,
        amount: Number(amount),
        altitude: altitude.trim(),
        roastLevel,
        notes: notes.trim(),
      })
      onAdded()
    } catch (err) {
      setError(err.message); setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-roast/30 p-4 md:items-center" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-lg">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Add coffee</h3>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Brand</span>
          <input required list="bean-brands" value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30" />
          <datalist id="bean-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Coffee name</span>
          <input required list="bean-names" value={coffeeName} onChange={(e) => setCoffeeName(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30" />
          <datalist id="bean-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Roast date</span>
          <input required type="date" value={roastDate} onChange={(e) => setRoastDate(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Amount (g)</span>
          <input
            required
            type="number"
            min="1"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setAmountTouched(true) }}
            onWheel={(e) => e.currentTarget.blur()}
            className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Altitude <span className="font-normal text-muted">(optional)</span></span>
          <input value={altitude} onChange={(e) => setAltitude(e.target.value)} placeholder="e.g. 1,800–2,100 masl" className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Roast level <span className="font-normal text-muted">(optional)</span></span>
          <select value={roastLevel} onChange={(e) => setRoastLevel(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30">
            <option value="">— select —</option>
            {ROAST_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Notes <span className="font-normal text-muted">(optional)</span></span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. washed, floral, blueberry" className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30" />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-roast hover:border-muted">Cancel</button>
          <button type="submit" disabled={status === 'saving'} className="rounded-lg bg-espresso px-3 py-1.5 text-sm font-medium text-white hover:bg-espresso-700 disabled:opacity-50">
            {status === 'saving' ? 'Saving…' : 'Add coffee'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ReplenishForm({ bean, onDone, onClose }) {
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setStatus('saving'); setError('')
    try {
      await replenishBean(bean.id, Number(amount))
      onDone()
    } catch (err) {
      setError(err.message); setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-roast/30 p-4 md:items-center" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-lg">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Replenish {bean.brand} — {bean.coffeeName}</h3>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Grams added (new bag)</span>
          <input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} onWheel={(e) => e.currentTarget.blur()} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30" />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-roast hover:border-muted">Cancel</button>
          <button type="submit" disabled={status === 'saving'} className="rounded-lg bg-espresso px-3 py-1.5 text-sm font-medium text-white hover:bg-espresso-700 disabled:opacity-50">
            {status === 'saving' ? 'Saving…' : 'Replenish'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Edit only the total (initial) and remaining amounts — the sole user-editable
// bean fields (client decision 2026-07-13). Everything else on the bean profile
// is fixed once added.
function EditAmountsForm({ bean, onDone, onClose }) {
  const [initial, setInitial] = useState(String(bean.initialAmount ?? ''))
  const [remaining, setRemaining] = useState(String(bean.remaining ?? ''))
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const initN = Number(initial)
  const remN = Number(remaining)
  const invalid = !(initN > 0) || !(remN >= 0) || remN > initN

  const submit = async (e) => {
    e.preventDefault()
    if (invalid) return
    setStatus('saving'); setError('')
    try {
      await updateBeanAmounts(bean.id, { initialAmount: initN, remaining: remN })
      onDone()
    } catch (err) {
      setError(err.message); setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-roast/30 p-4 md:items-center" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-lg">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Edit {bean.brand} — {bean.coffeeName}</h3>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Total amount (g)</span>
          <input required type="number" min="1" value={initial} onChange={(e) => setInitial(e.target.value)} onWheel={(e) => e.currentTarget.blur()} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-muted">Remaining amount (g)</span>
          <input required type="number" min="0" value={remaining} onChange={(e) => setRemaining(e.target.value)} onWheel={(e) => e.currentTarget.blur()} className="mt-1 w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30" />
        </label>
        {remN > initN && <p className="text-xs text-red-600">Remaining can’t be more than the total amount.</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-roast hover:border-muted">Cancel</button>
          <button type="submit" disabled={status === 'saving' || invalid} className="rounded-lg bg-espresso px-3 py-1.5 text-sm font-medium text-white hover:bg-espresso-700 disabled:opacity-50">
            {status === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Beans({ beans, onRefresh }) {
  const [addOpen, setAddOpen] = useState(false)
  const [replenishTarget, setReplenishTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Beans</h2>
        <button onClick={() => setAddOpen(true)} className="rounded-lg bg-espresso px-3 py-1.5 text-sm font-medium text-white hover:bg-espresso-700">Add coffee</button>
      </div>

      {beans.length === 0 ? (
        <p className="text-sm text-muted">No coffee added yet — add your first bag to start tracking inventory.</p>
      ) : (
        <div className="space-y-2">
          {beans.map((b) => {
            const empty = b.remaining <= 0
            const pct = b.initialAmount > 0 ? Math.max(0, Math.min(100, Math.round((b.remaining / b.initialAmount) * 100))) : 0
            return (
              <div key={b.id} className={`rounded-lg border px-3 py-2 ${empty ? 'border-espresso/40 bg-tint' : 'border-line bg-surface2'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-roast">{b.brand} — {b.coffeeName}</div>
                    <div className="text-xs text-muted">Roasted {b.roastDate} · {b.remaining} g / {b.initialAmount} g remaining</div>
                    {(b.roastLevel || b.altitude) && (
                      <div className="mt-0.5 text-xs text-muted">
                        {[b.roastLevel && `${b.roastLevel} roast`, b.altitude].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {b.notes && <div className="mt-0.5 text-xs italic text-muted">“{b.notes}”</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-cream">
                      <div className="h-full bg-espresso" style={{ width: `${pct}%` }} />
                    </div>
                    <button onClick={() => setEditTarget(b)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:border-espresso hover:text-espresso">Edit</button>
                  </div>
                </div>
                {empty && (
                  <div className="mt-2 rounded-lg bg-cream px-2.5 py-2 text-xs text-roast">
                    <p className="mb-1.5">{b.coffeeName} has reached 0g remaining. Have you purchased a new bag of the same coffee?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setReplenishTarget(b)} className="rounded-lg border border-espresso px-2.5 py-1 text-xs font-medium text-espresso hover:bg-tint">Replenish stock</button>
                      <button onClick={() => setAddOpen(true)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-roast hover:border-espresso">Add a new coffee</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {addOpen && <AddBeanForm onAdded={() => { setAddOpen(false); onRefresh() }} onClose={() => setAddOpen(false)} />}
      {replenishTarget && (
        <ReplenishForm bean={replenishTarget} onDone={() => { setReplenishTarget(null); onRefresh() }} onClose={() => setReplenishTarget(null)} />
      )}
      {editTarget && (
        <EditAmountsForm bean={editTarget} onDone={() => { setEditTarget(null); onRefresh() }} onClose={() => setEditTarget(null)} />
      )}
    </section>
  )
}
