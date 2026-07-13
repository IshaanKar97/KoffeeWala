import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'
import { deleteAccountData } from '../lib/account.js'
import { Toggle } from './Field.jsx'

const THEME_OPTIONS = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

function Section({ title, desc, children }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {desc && <p className="mt-1 text-xs text-muted">{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function DeleteAccountModal({ onConfirm, onClose, busy, error }) {
  const [typed, setTyped] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-roast/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-warn">Delete account</h3>
        <p className="mt-2 text-sm text-roast">
          This permanently deletes <span className="font-semibold">all your beans and brews</span> and signs you out. It cannot be undone.
        </p>
        <p className="mt-2 text-xs text-muted">
          Your login record itself can’t be removed from the browser — after this, contact us if you also want the sign-in deleted.
        </p>
        <label className="mt-3 block">
          <span className="block text-xs font-medium text-muted">Type <span className="font-mono font-semibold text-roast">DELETE</span> to confirm</span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface2 px-2 py-1.5 text-sm text-roast outline-none focus:border-warn"
          />
        </label>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-roast hover:border-muted">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={typed !== 'DELETE' || busy}
            className="rounded-lg bg-warn px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Deleting…' : 'Delete everything'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const meta = user?.user_metadata || {}

  const [name, setName] = useState(meta.name || '')
  const [reminderEnabled, setReminderEnabled] = useState(meta.reminderEnabled !== false)
  const [reminderDays, setReminderDays] = useState(String(meta.reminderDays ?? 7))
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [saveErr, setSaveErr] = useState('')
  const [delOpen, setDelOpen] = useState(false)
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState('')

  const provider = user?.app_metadata?.provider || 'email'
  const created = user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

  const save = async () => {
    setSaveState('saving'); setSaveErr('')
    const days = Math.max(1, Math.min(60, Math.round(Number(reminderDays) || 7)))
    setReminderDays(String(days))
    const { error } = await supabase.auth.updateUser({ data: { name: name.trim(), reminderEnabled, reminderDays: days } })
    if (error) { setSaveErr(error.message); setSaveState('error') }
    else { setSaveState('saved'); setTimeout(() => setSaveState('idle'), 3000) }
  }

  const doDelete = async () => {
    setDelBusy(true); setDelErr('')
    try {
      await deleteAccountData(user.id)
      await signOut()
    } catch (e) {
      setDelErr(e.message); setDelBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Account info */}
      <Section title="Account">
        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-muted">Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-1 w-full max-w-sm rounded-lg border border-line bg-surface2 px-2 py-1.5 text-sm text-roast outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Email</div>
              <div className="truncate text-roast" title={user?.email}>{user?.email || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Sign-in</div>
              <div className="capitalize text-roast">{provider}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Member since</div>
              <div className="text-roast">{created}</div>
            </div>
          </div>
        </div>
      </Section>

      {/* Low-stock reminder */}
      <Section title="Low-stock reminder" desc="Warn me before a bean runs out, based on my recent usage.">
        <div className="space-y-3">
          <Toggle checked={reminderEnabled} onChange={setReminderEnabled} label="Show low-stock reminders" />
          <label className={`block ${reminderEnabled ? '' : 'opacity-50'}`}>
            <span className="block text-xs font-medium text-muted">Remind me when fewer than this many days remain</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="60"
                value={reminderDays}
                disabled={!reminderEnabled}
                onChange={(e) => setReminderDays(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-20 rounded-lg border border-line bg-surface2 px-2 py-1.5 text-sm text-roast outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-muted">days</span>
            </div>
          </label>
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance" desc="Choose a theme, or follow your device setting.">
        <div className="inline-flex rounded-lg border border-line bg-surface2 p-0.5">
          {THEME_OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => setTheme(o.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${theme === o.id ? 'bg-espresso text-white' : 'text-muted hover:text-roast'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Save bar for account + reminder */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saveState === 'saving'}
          className="rounded-lg bg-espresso px-4 py-2 text-sm font-medium text-white hover:bg-espresso-700 disabled:opacity-50"
        >
          {saveState === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {saveState === 'saved' && <span className="text-sm font-medium text-green-700">✓ Saved</span>}
        {saveState === 'error' && <span className="text-sm text-red-600">{saveErr}</span>}
      </div>

      {/* Session */}
      <Section title="Session">
        <button onClick={signOut} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-roast hover:border-espresso hover:text-espresso">
          Log out
        </button>
      </Section>

      {/* Danger zone */}
      <Section title="Danger zone" desc="Permanently erase your data. This cannot be undone.">
        <button onClick={() => { setDelErr(''); setDelOpen(true) }} className="rounded-lg border border-warn px-4 py-2 text-sm font-medium text-warn hover:bg-warnbg">
          Delete account
        </button>
      </Section>

      {delOpen && <DeleteAccountModal onConfirm={doDelete} onClose={() => !delBusy && setDelOpen(false)} busy={delBusy} error={delErr} />}
    </div>
  )
}
