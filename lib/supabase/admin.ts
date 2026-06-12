import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types/database'

/**
 * Service-role client for server-only operations that bypass RLS
 * (letter PDF uploads, signed URL generation). Never import in client code.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
