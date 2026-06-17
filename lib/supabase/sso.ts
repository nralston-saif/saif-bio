import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

// SAIF Bio shares the internal.saif.vc origin with the saif-monorepo CRM, so
// the CRM's Supabase session cookie is readable here. We use the CRM's public
// project URL + anon key to read and validate that session, then mint a
// matching SAIF Bio session (see app/auth/sso/route.ts). Both values are
// public (same class as NEXT_PUBLIC_*); override via env if the CRM rotates.
const CRM_SUPABASE_URL =
  process.env.CRM_SUPABASE_URL ?? 'https://dxllkeajdtbtvsjjoaxr.supabase.co'
const CRM_SUPABASE_ANON_KEY =
  process.env.CRM_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bGxrZWFqZHRidHZzampvYXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNDU4NzgsImV4cCI6MjA4MjYyMTg3OH0.oB240-qQoBVDpLbpaHOeO4RcBxIHher04UWeU8VKi24'

const CRM_REF = CRM_SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0]
const CRM_COOKIE_PREFIX = `sb-${CRM_REF}-auth-token`

/** True if the request carries a saif-monorepo CRM auth cookie (no network). */
export function hasCrmSession(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith(CRM_COOKIE_PREFIX))
}

/**
 * Email of the signed-in CRM user, validated against the CRM project, or null.
 * Makes a network call to the CRM auth server — use in a route handler, not in
 * middleware.
 */
export async function getCrmEmail(request: NextRequest): Promise<string | null> {
  if (!hasCrmSession(request)) return null

  const supabase = createServerClient(CRM_SUPABASE_URL, CRM_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () =>
        request.cookies.getAll().filter((c) => c.name.startsWith(`sb-${CRM_REF}-`)),
      setAll: () => {
        // Read-only: we never refresh or persist the CRM session here.
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.email ?? null
}
