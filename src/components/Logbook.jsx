import { useCallback, useEffect, useState } from 'react'
import { listBrews } from '../lib/logbook.js'

const METHOD_COLOR = {
  'V60 - No Ice': 'bg-blue-100 text-blue-800',
  'V60 - With Ice': 'bg-purple-100 text-purple-800',
  'Filter Coffee': 'bg-orange-100 text-orange-800',
}

function Times({ brew }) {
  const parts = [
    ['Bloom', brew.bloomTime],
    ['P1', brew.pour1Time],
    ['P2', brew.pour2Time],
    ['P3', brew.pour3Time],
    ['Drawdown', brew.drawdownTime],
  ].filter(([, v]) => v)
  if (!parts.length) return null
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs text-stone-500">
      {parts.map(([k, v]) => (
        <span key={k}>
          {k} {v}
        </span>
      ))}
    </div>
  )
}

function BrewCard({ brew }) {
  const stats = [
    brew.coffee != null && `${brew.coffee} g dose`,
    brew.ratio != null && `1:${brew.ratio}`,
    brew.totalWater != null && `${brew.totalWater} g water`,
    brew.ice != null && `${brew.ice} g ice`,
    brew.milk != null && `${brew.milk} g milk`,
    brew.waterTemp && brew.waterTemp,
    brew.grindSize && `grind ${brew.grindSize}`,
  ].filter(Boolean)
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <a href={brew.url} target="_blank" rel="noreferrer" className="font-medium text-stone-900 hover:text-amber-800 hover:underline">
            {brew.name || 'Untitled brew'}
          </a>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {brew.method && <span className={`rounded px-1.5 py-0.5 font-medium ${METHOD_COLOR[brew.method] || 'bg-stone-100 text-stone-700'}`}>{brew.method}</span>}
            {brew.date && <span className="text-stone-500">{brew.date}</span>}
          </div>
        </div>
        {brew.rating != null && <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-800">{brew.rating}/10</span>}
      </div>
      {stats.length > 0 && <div className="mt-2 text-sm text-stone-600">{stats.join(' · ')}</div>}
      <Times brew={brew} />
      {brew.notes && <p className="mt-2 text-sm italic text-stone-500">“{brew.notes}”</p>}
    </div>
  )
}

export default function Logbook() {
  const [status, setStatus] = useState('loading') // loading | loaded | error
  const [brews, setBrews] = useState([])
  const [error, setError] = useState('')

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

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Logbook</h2>
        <button onClick={load} disabled={status === 'loading'} className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 hover:border-amber-600 hover:text-amber-800 disabled:opacity-50">
          {status === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {status === 'loading' && <p className="text-sm text-stone-500">Loading brews from Notion…</p>}

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
        <div className="space-y-3">
          {brews.map((b) => (
            <BrewCard key={b.id} brew={b} />
          ))}
        </div>
      )}
    </section>
  )
}
