// Supabase client (Phase 2). The anon key is publishable — per-user access is
// enforced by Row-Level Security, so the client runs safely in the browser.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    'Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (and Netlify env for production).',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '')
export const isSupabaseConfigured = Boolean(url && anonKey)
