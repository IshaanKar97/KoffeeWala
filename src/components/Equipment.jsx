import { useState } from 'react'
import { grinderLabel } from '../lib/grinders.js'
import { GrinderPicker } from './Grind.jsx'

export default function Equipment({ grinders, activeGrinderId, setActiveGrinderId, onAddGrinder, onRemoveGrinder }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Grinders</h2>
        <button onClick={() => setPickerOpen(true)} className="rounded-lg bg-espresso px-3 py-1.5 text-sm font-medium text-white hover:bg-espresso-700">Add grinder</button>
      </div>

      <div className="space-y-2">
        {grinders.map((g) => (
          <div key={g.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${g.id === activeGrinderId ? 'border-espresso bg-tint' : 'border-line bg-surface2'}`}>
            <div>
              <div className="font-medium text-roast">
                {grinderLabel(g)}
                {g.id === activeGrinderId && <span className="ml-2 rounded bg-espresso px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">Active</span>}
              </div>
              <div className="text-xs text-muted">{g.clicks} clicks · ~{Math.round(g.clicks * g.umPerClick)}µm max · {g.umPerClick} µm/click</div>
            </div>
            <div className="flex gap-2">
              {g.id !== activeGrinderId && (
                <button onClick={() => setActiveGrinderId(g.id)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:border-espresso hover:text-espresso">Set active</button>
              )}
              {grinders.length > 1 && (
                <button onClick={() => onRemoveGrinder(g.id)} className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50">Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted">Clicks ↔ micron conversions are approximate (per-grinder µm/click). The active grinder is used by the calculator’s grind-size input.</p>

      {pickerOpen && <GrinderPicker onPick={(g) => { onAddGrinder(g); setPickerOpen(false) }} onClose={() => setPickerOpen(false)} />}
    </section>
  )
}
