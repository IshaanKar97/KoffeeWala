export default function Field({ label, value, onChange, placeholder, hint, suffix, step = '1', min = '0', inputMode = 'decimal', disabled = false, error, warning }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-700">{label}</span>
      <div
        className={`mt-1 flex items-center rounded-lg border ${
          error
            ? 'border-red-400 bg-white focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/30'
            : warning
              ? 'border-amber-400 bg-white focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-600/30'
              : disabled
                ? 'border-stone-200 bg-stone-100'
                : 'border-stone-300 bg-white focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-600/30'
        }`}
      >
        <input
          type="number"
          inputMode={inputMode}
          step={step}
          min={min}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          className={`w-full rounded-lg bg-transparent px-3 py-2 outline-none placeholder:text-stone-400 ${disabled ? 'text-stone-400' : 'text-stone-900'}`}
        />
        {suffix && <span className={`px-3 text-sm ${disabled ? 'text-stone-400' : 'text-stone-500'}`}>{suffix}</span>}
      </div>
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : warning ? (
        <span className="mt-1 block text-xs text-amber-700">{warning}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-stone-500">{hint}</span>
      ) : null}
    </label>
  )
}

/** Small accessible on/off switch — used for mode-altering toggles (e.g. Ice)
 *  so they read differently from a plain capture checkbox. */
export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm font-medium text-stone-700"
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? 'bg-amber-700' : 'bg-stone-300'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      {label}
    </button>
  )
}

// --- mm:ss time helpers + a mobile-friendly numeric time input -------------
export function parseTime(str) {
  const m = String(str ?? '').match(/^(\d{1,2}):(\d{1,2})$/)
  if (m) return { m: Number(m[1]), s: Number(m[2]) }
  const secs = parseInt(str, 10)
  if (Number.isFinite(secs)) return { m: Math.floor(secs / 60), s: secs % 60 }
  return { m: 0, s: 0 }
}
export function fmtTime(m, s) {
  const mm = Math.max(0, Math.min(59, Number.isFinite(m) ? m : 0))
  const ss = Math.max(0, Math.min(59, Number.isFinite(s) ? s : 0))
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/** Numeric min : sec time input (stores/returns an "mm:ss" string). Mobile-friendly:
 *  numeric keypad, no colon typing, no ambiguous "1:5". */
export function TimeField({ label, value, onChange, hint }) {
  const { m, s } = parseTime(value)
  const box = 'flex items-center rounded-lg border border-stone-300 bg-white focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-600/30'
  const inp = 'w-12 rounded-lg bg-transparent px-2 py-2 text-center text-stone-900 outline-none'
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-700">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <div className={box}>
          <input
            type="number" inputMode="numeric" min="0" max="59" value={m}
            onChange={(e) => onChange(fmtTime(parseInt(e.target.value, 10), s))}
            onWheel={(e) => e.currentTarget.blur()}
            className={inp} aria-label={`${label} minutes`}
          />
          <span className="pr-2 text-xs text-stone-500">min</span>
        </div>
        <span className="text-stone-400">:</span>
        <div className={box}>
          <input
            type="number" inputMode="numeric" min="0" max="59" value={s}
            onChange={(e) => onChange(fmtTime(m, parseInt(e.target.value, 10)))}
            onWheel={(e) => e.currentTarget.blur()}
            className={inp} aria-label={`${label} seconds`}
          />
          <span className="pr-2 text-xs text-stone-500">sec</span>
        </div>
      </div>
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}
