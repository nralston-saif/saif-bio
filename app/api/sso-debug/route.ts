import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasCrmSession, getCrmEmail } from '@/lib/supabase/sso'

// TEMPORARY diagnostic for the CRM→Bio SSO bridge. Returns cookie NAMES only
// (no values) plus whether the CRM session is visible here. Remove after use.
export async function GET(request: NextRequest) {
  const cookieNames = request.cookies.getAll().map((c) => c.name)
  let crmEmail: string | null = null
  let error: string | null = null
  try {
    crmEmail = await getCrmEmail(request)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  return NextResponse.json({
    cookieNames,
    hasCrmSession: hasCrmSession(request),
    crmEmail,
    error,
    forwardedHost: request.headers.get('x-forwarded-host'),
    host: request.headers.get('host'),
  })
}
