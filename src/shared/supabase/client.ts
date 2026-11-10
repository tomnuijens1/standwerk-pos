import { createClient } from '@supabase/supabase-js'
import type { Database } from './types.generated'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

/**
 * Elk kassa-apparaat krijgt een anonieme sessie bij opstarten, zodat RLS-policies
 * onderscheid kunnen maken tussen authenticated kassa's en willekeurige anonieme
 * internetclients (zie supabase/migrations/00001_init.sql).
 */
export async function ensureDeviceSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session

  const { data: signInData, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return signInData.session
}
