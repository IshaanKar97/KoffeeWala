import { useCallback, useEffect, useState } from 'react'
import { listBrews, updateBrew, deleteBrew } from '../lib/logbook.js'

const METHOD_COLOR = {
  'V60 - No Ice': 'bg-blue-100 text-blue-800',
  'V60 - With Ice': 'bg-purple-100 text-purple-800',
  'Filter Coffee': 'bg-orange-100 text-orange-800',
}

// Drives both the read-only detail view and the edit form.
const FIELDS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'method', label: 'Method', type: 'select', options: ['V60 - No Ice', 'V60 - With Ice', 'Filter Coffee'] },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'coffee', label: 'Coffee (g)', type: 'number' },
  { key: 'ratio', label: 'Ratio', type: 'number' },
  { key: 'totalWater', label: 'Total water (g)', type: 'number', locked: true },
  { key: 'bloomWater', label: 'Bloom water (g)', type: 'number', locked: true },
  { key: 'brewWater', label: 'Brew water (g)', type: 'number', locked: true },
  { key: 'ice', label: 'Ice (g)', type: 'number', locked: true },
  { key: 'milk', label: 'Milk (g)', type: 'number', locked: true },
  { key: 'pour1Water', label: 'Pour 1 (g)', type: 'number', locked: true },
  { key: 'pour2Water', label: 'Pour 2 (g)', type: 'number', locked: true },
  { key: 'pour3Water', label: 'Pour 3 (g)', type: 'number', locked: true },
  { key: 'bloomTime', label: 'Bloom time', type: 'text' },
  { key: 'pour1Time', label: 'Pour 1 time', type: 'text' },
  { key: 'pour2Time', label: 'Pour 2 time', type: 'text' },
  { key: 'pour3Time', label: 'Pour 3 time', type: 'text' },
  { key: 'drawdownTime', label: 'Drawdown time', type: 'text' },
  { key: 'grindSize', label: 'Grind size', type: 'text' },
  { key: 'waterTemp', label: 'Water temp', type: 'text' },
  { key: 'rating', label: 'Rating /10', type: 'number' },
  { key: 'notes', label: 'Tasting notes', type: 'textarea' },
]

// Map the edit form (brew shape) → the save/update payload keys.
function formToPayload(id, f) {
  return {
    id,
    brewName: f.name,
    brewMethod: f.method,
    date: f.date,
    coffee: f.coffee,
    ratio: f.ratio,
    totalWater: f.totalWater,
    bloomWater: f.bloomWater,
    brewWater: f.brewWater,
    ice: f.ice,
    milk: f.milk,
    pour1Water: f.pour1Water,
    pour2Water: f.pour2Water,
    pour3Water: f.pour3Water,
    bloomTimeStr: f.bloomTime,
    pour1Time: f.pour1Time,
    pour2Time: f.pour2Time,
    pour3Time: f.pour3Time,
    drawdownTime: f.drawdownTime,
    grindSize: f.grindSize,
    waterTemp: f.waterTemp,
    rating: f.rating,
    notes: f.notes,
  }
}

function MethodBadge({ method }) {
  if (!method) return null
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${METHOD_COLOR[method] || 'bg-stone-100 text-stone-700'}`}>{method}</span>
}

function BrewCard({ brew, onOpen }) {
  return (
    <button onClick={onOpen} className="block w-full rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm hover:border-amber-400">
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium text-stone-900">{brew.name || 'Untitled brew'}</span>
        {brew.rating != null && <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-800">{brew.rating}/10</span>}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
        <MethodBadge method={brew.method} />
        {brew.date && <span>{brew.date}</span>}
        {brew.coffee != null && <span>· {brew.coffee} g · 1:{brew.ratio}</span>}
      </div>
    </button>
  )
}

function Detail({ brew, onClose, onRebrew, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [initial, setInitial] = useState('')
  const [saveState, setSaveState] = useState('idle') // idle | saving | error
  const [saveError, setSaveError] = useState('')
  const [deleteState, setDeleteState] = useState('idle') // idle | deleting | error

  const startEdit = () => {
    const f = {}
    FIELDS.forEach(({ key }) => {
      f[key] = brew[key] == null ? '' : String(brew[key])
    })
    setForm(f)
    setInitial(JSON.stringify(f))
    setSaveState('idle')
    setSaveError('')
    setEditing(true)
  }

  const dirty = editing && JSON.stringify(form) !== initial

  const cancelEdit = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    setEditing(false)
  }
  const guardedClose = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    onClose()
  }

  // Editing the recipe inputs can leave them out of step with the (locked) water
  // amounts, which don't recalculate here — warn rather than block.
  const coffeeN = parseFloat(form.coffee)
  const ratioN = parseFloat(form.ratio)
  const totalN = parseFloat(form.totalWater)
  const inconsistent =
    editing && !Number.isNaN(coffeeN) && !Number.isNaN(ratioN) && !Number.isNaN(totalN) && Math.round(coffeeN * ratioN) !== totalN

  const save = async () => {
    setSaveState('saving')
    setSaveError('')
    try {
      await updateBrew(formToPayload(brew.id, form))
      setEditing(false)
      setSaveState('idle')
      onSaved()
    } catch (e) {
      setSaveError(e.message)
      setSaveState('error')
    }
  }

  // Delete is permanent (PRD: hard delete + confirmation; soft-delete deferred).
  const remove = async () => {
    if (!window.confirm('Delete this brew permanently? This cannot be undone.')) return
    setDeleteState('deleting')
    setSaveError('')
    try {
      await deleteBrew(brew.id)
      onClose()
      onSaved()
    } catch (e) {
      setSaveError(e.message)
      setDeleteState('error')
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={guardedClose} className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:border-stone-400">
          <span className="md:hidden">← Back</span>
          <span className="hidden md:inline">✕ Close</span>
        </button>
        <div className="ml-auto flex gap-2">
          {!editing ? (
            <>
              <button onClick={startEdit} className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-amber-600 hover:text-amber-800">
                Edit
              </button>
              <button onClick={remove} disabled={deleteState === 'deleting'} className="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:border-red-500 hover:bg-red-50 disabled:opacity-50">
                {deleteState === 'deleting' ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => onRebrew(brew)} className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800">
                Re-brew
              </button>
            </>
          ) : (
            <>
              <button onClick={cancelEdit} className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-stone-400">
                Cancel
              </button>
              <button onClick={save} disabled={saveState === 'saving'} className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50">
                {saveState === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {deleteState === 'error' && <p className="mb-3 text-sm text-red-600">{saveError}</p>}

      {!editing ? (
        <>
          <h3 className="text-lg font-semibold text-stone-900">{brew.name || 'Untitled brew'}</h3>
          <div className="mt-1 mb-3">
            <MethodBadge method={brew.method} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {FIELDS.filter((f) => f.key !== 'name' && f.key !== 'method' && f.key !== 'notes').map((f) => {
              const v = brew[f.key]
              if (v == null || v === '') return null
              return (
                <div key={f.key} className="flex justify-between gap-2 border-b border-stone-100 pb-1">
                  <dt className="text-stone-500">{f.label}</dt>
                  <dd className="font-medium text-stone-800">{v}</dd>
                </div>
              )
            })}
          </dl>
          {brew.notes && <p className="mt-3 text-sm italic text-stone-600">“{brew.notes}”</p>}
          {brew.url && (
            <a href={brew.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-medium text-amber-700 hover:underline">
              Open in Notion ↗
            </a>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {inconsistent && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Coffee × ratio = {Math.round(coffeeN * ratioN)} g, but the recorded total water is {totalN} g. Water amounts are locked and won’t recalculate here — use <span className="font-medium">Re-brew</span> to recompute them.
            </p>
          )}
          {FIELDS.map((f) =>
            f.locked ? (
              <div key={f.key} className="flex items-center justify-between border-b border-stone-100 pb-1">
                <span className="text-xs font-medium text-stone-600">{f.label}</span>
                <span className="text-sm text-stone-500">
                  {form[f.key] || '—'} <span className="ml-1 text-[10px] uppercase tracking-wide text-stone-400">locked</span>
                </span>
              </div>
            ) : (
              <label key={f.key} className="block">
                <span className="block text-xs font-medium text-stone-600">{f.label}</span>
                {f.type === 'select' ? (
                  <select value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-amber-600">
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-600" />
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    value={form[f.key] ?? ''}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    onWheel={f.type === 'number' ? (e) => e.currentTarget.blur() : undefined}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-600"
                  />
                )}
              </label>
            )
          )}
          {saveState === 'error' && <p className="text-sm text-red-600">{saveError}</p>}
        </div>
      )}
    </div>
  )
}

function Table({ brews, selectedId, onSelect }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-stone-200 text-left text-stone-500">
          <th className="py-2 font-medium">Method</th>
          <th className="py-2 text-right font-medium">Dose</th>
          <th className="py-2 text-right font-medium">Ratio</th>
          <th className="py-2 text-right font-medium">Total</th>
          <th className="py-2 text-right font-medium">Rating</th>
        </tr>
      </thead>
      <tbody>
        {brews.map((b) => (
          <tr
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={`cursor-pointer border-b border-stone-100 hover:bg-amber-50/60 ${selectedId === b.id ? 'bg-amber-50' : ''}`}
          >
            <td className="py-2"><MethodBadge method={b.method} /></td>
            <td className="py-2 text-right tabular-nums">{b.coffee != null ? `${b.coffee} g` : '—'}</td>
            <td className="py-2 text-right tabular-nums">{b.ratio != null ? `1:${b.ratio}` : '—'}</td>
            <td className="py-2 text-right tabular-nums">{b.totalWater != null ? `${b.totalWater} g` : '—'}</td>
            <td className="py-2 text-right tabular-nums">{b.rating != null ? `${b.rating}/10` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Logbook({ onRebrew }) {
  const [status, setStatus] = useState('loading') // loading | loaded | error
  const [brews, setBrews] = useState([])
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const data = await listBrews()
      setBrews(data)
      setStatus('loaded')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selected = brews.find((b) => b.id === selectedId) || null
  const close = () => setSelectedId(null)

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Logbook</h2>
        <button onClick={load} disabled={status === 'loading'} className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-amber-600 hover:text-amber-800 disabled:opacity-50">
          {status === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
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
        <div className="md:flex md:items-start md:gap-4">
          {/* List — cards (mobile) / table (desktop). Hidden on mobile when a brew is open. */}
          <div className={`${selected ? 'hidden md:block' : ''} md:min-w-0 md:flex-1`}>
            <div className="space-y-3 md:hidden">
              {brews.map((b) => (
                <BrewCard key={b.id} brew={b} onOpen={() => setSelectedId(b.id)} />
              ))}
            </div>
            <div className="hidden md:block">
              <Table brews={brews} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </div>

          {/* Detail — full width (mobile) / right split panel (desktop). */}
          {selected && (
            <div className="mt-4 md:mt-0 md:w-80 md:shrink-0 md:border-l md:border-stone-200 md:pl-4">
              <Detail brew={selected} onClose={close} onRebrew={onRebrew} onSaved={load} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
