import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasCrmSession, getCrmEmail } from '@/lib/supabase/sso'
import type { EmailOtpType } from '@supabase/supabase-js'

// TEMPORARY diagnostic for the CRM→Bio SSO bridge. Exercises the full mint so
// we can see exactly which step fails. Returns no secrets. Remove after use.
async function tryMint(email: string, type: EmailOtpType) {
  const admin = createAdminClient()
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr) return { type, step: 'generateLink', error: linkErr.message }
  const tokenHash = link?.properties?.hashed_token
  if (!tokenHash) return { type, step: 'generateLink', error: 'no hashed_token' }

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type })
  return {
    type,
    step: 'verifyOtp',
    error: error?.message ?? null,
    gotSession: !!data?.session,
    gotUser: data?.user?.email ?? null,
  }
}

export async function GET(request: NextRequest) {
  const result: Record<string, unknown> = {
    cookieNames: request.cookies.getAll().map((c) => c.name),
    hasCrmSession: hasCrmSession(request),
  }
  try {
    const email = await getCrmEmail(request)
    result.crmEmail = email
    if (email) {
      const admin = createAdminClient()
      const { data: member } = await admin
        .from('bio_team_members')
        .select('id')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle()
      result.isPartner = !!member
      result.mintMagiclink = await tryMint(email, 'magiclink')
      result.mintEmail = await tryMint(email, 'email')
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e)
  }
  const res = NextResponse.json(result)
  // Test whether a server-set cookie survives the proxy back to the browser.
  res.cookies.set('bio_cookie_test', 'ok', { path: '/bio', sameSite: 'lax', secure: true })
  return res
}
