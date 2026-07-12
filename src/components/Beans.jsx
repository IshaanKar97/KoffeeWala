import { useEffect, useState } from 'react'
import { addBean, replenishBean, searchCatalogBrands, searchCatalogNames, findCatalogMatch } from '../lib/beans.js'

// Phase 3 Feature #2 (Decision #65) — Bean Repository UI.
// Brand + Coffee Name are independent autocomplete fields (client-confirmed);
// when the pair exactly matches a Global Coffee Catalog entry, Amount is
// prefilled (editable) — Roast Date is never prefilled.
export function AddBeanForm({ onAdded, onClose }) {
  const [brand, setBrand] = useState('')
  const [coffeeName, setCoffeeName] = useState('')
  const [roastDate, setRoastDate] = useState('')
  const [amount, setAmount] = useState('')
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
      await addBean({ brand: brand.trim(), coffeeName: coffeeName.trim(), roastDate, amount: Number(amount) })
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

export default function Beans({ beans, onRefresh }) {
  const [addOpen, setAddOpen] = useState(false)
  const [replenishTarget, setReplenishTarget] = useState(null)

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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-roast">{b.brand} — {b.coffeeName}</div>
                    <div className="text-xs text-muted">Roasted {b.roastDate} · {b.remaining} g / {b.initialAmount} g remaining</div>
                  </div>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-cream">
                    <div className="h-full bg-espresso" style={{ width: `${pct}%` }} />
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
    </section>
  )
}
