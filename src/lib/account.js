// Account actions. Deleting the Supabase auth user itself requires the admin
// service-role key (server-side only), so the browser can't remove the login
// record. This does the client-side part the user CAN do under RLS: permanently
// erase all of their own data (beans + brews), after which the caller signs them
// out. Client decision 2026-07-13.
import { supabase, isSupabaseConfigured } from './supabase.js'

/** Permanently delete all of the signed-in user's beans and brews. RLS scopes
 *  each delete to the owner; the explicit user_id filter is belt-and-suspenders. */
export async function deleteAccountData(userId) {
  if (!isSupabaseConfigured) throw new Error("Supabase isn't configured.")
  if (!userId) throw new Error('Not signed in.')

  const brews = await supabase.from('brews').delete().eq('user_id', userId)
  if (brews.error) throw new Error(brews.error.message)

  const beans = await supabase.from('beans').delete().eq('user_id', userId)
  if (beans.error) throw new Error(beans.error.message)
}
