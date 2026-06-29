import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

/** Sign-in / sign-up modal (email+password + Google). */
export default function AuthPanel({ onClose }) {
  const { signInWithPassword, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'signin') {
        const { error } = await signInWithPassword(email, password)
        if (error) throw error
        onClose?.()
      } else {
        const { data, error } = await signUp(email, password)
        if (error) throw error
        if (data.session) onClose?.()
        else setInfo('Account created — check your email to confirm, then sign in.')
      }
    } catch (err) {
      setError(err?.message || 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error.message) // e.g. provider not enabled yet
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-roast">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
          <button onClick={onClose} className="text-muted hover:text-roast" aria-label="Close">✕</button>
        </div>

        <button
          onClick={google}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-roast hover:bg-surface"
        >
          Continue with Google
        </button>

        <div className="mb-4 flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-line" /> or <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-roast">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-roast">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-espresso focus:ring-2 focus:ring-espresso/30"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-green-700">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-espresso px-4 py-2 text-sm font-medium text-white hover:bg-espresso-700 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {mode === 'signin' ? "No account?" : 'Have an account?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError('')
              setInfo('')
            }}
            className="font-medium text-espresso hover:underline"
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
