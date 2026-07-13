import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// Light/dark theming. Preference is 'system' | 'light' | 'dark' (per browser,
// localStorage). The resolved effective theme is written to
// document.documentElement[data-theme], which flips the CSS token overrides in
// index.css. 'system' follows the OS and updates live when the OS setting changes.
const ThemeContext = createContext(null)
const KEY = 'cbc-theme'
const systemTheme = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const v = localStorage.getItem(KEY)
      return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
    } catch {
      return 'system'
    }
  })

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? systemTheme() : theme
    }
    apply()
    if (theme === 'system' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])

  const setTheme = useCallback((t) => {
    setThemeState(t)
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* ignore storage failures */
    }
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
