export default function Field({ label, value, onChange, placeholder, hint, suffix, step = '1', min = '0', inputMode = 'decimal' }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-stone-700">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-stone-300 bg-white focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-600/30">
        <input
          type="number"
          inputMode={inputMode}
          step={step}
          min={min}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          className="w-full rounded-lg bg-transparent px-3 py-2 text-stone-900 outline-none placeholder:text-stone-400"
        />
        {suffix && <span className="px-3 text-sm text-stone-500">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}
