import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCrmEmail } from '@/lib/supabase/sso'
import { isDemoMode } from '@/lib/supabase/demo/mock-client'
import type { Database } from '@/lib/supabase/types/database'

// SSO bridge: a partner already signed into the saif-monorepo CRM (same
// internal.saif.vc origin) is auto-signed into SAIF Bio without a second login.
// The CRM "Bio" nav link points here, and middleware also routes unauthenticated
// /bio requests through here. Keeps the two Supabase projects fully separate —
// we only read the CRM identity and mint a native SAIF Bio session for it.
const BASE_PATH = '/bio'
const GUARD = 'bio_sso_tried'
const guardOpts = { httpOnly: true, sameSite: 'lax', path: BASE_PATH } as const

function withBase(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  if (clean === '/') return BASE_PATH
  return clean === BASE_PATH || clean.startsWith(`${BASE_PATH}/`) ? clean : `${BASE_PATH}${clean}`
}

function mkRedirect(path: string): NextResponse {
  return new NextResponse(null, {
    status: 307,
    // no-store so a navigation can't cache this redirect (the decision depends
    // on per-request cookies).
    headers: { Location: withBase(path), 'Cache-Control': 'no-store' },
  })
}

function bioClient(request: NextRequest, response: NextResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
      },
    }
  )
}

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') ?? '/'

  // Failure → login, and arm a 60s one-shot guard so the middleware can't bounce
  // straight back here into a redirect loop.
  const fail = () => {
    const res = mkRedirect('/login')
    res.cookies.set(GUARD, '1', { ...guardOpts, maxAge: 60 })
    return res
  }

  if (isDemoMode()) return mkRedirect(next)

  // Already signed into SAIF Bio? Nothing to do — don't re-mint on every visit.
  const probe = mkRedirect(next)
  const existing = await bioClient(request, probe).auth.getUser()
  if (existing.data.user) {
    probe.cookies.set(GUARD, '', { ...guardOpts, maxAge: 0 })
    return probe
  }

  // 1. Who is signed into the CRM? (validated against the CRM project)
  const email = await getCrmEmail(request)
  if (!email) return fail()

  // 2. Are they an active SAIF Bio partner?
  const admin = createAdminClient()
  const { data: member } = await admin
    .from('bio_team_members')
    .select('id')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle()
  if (!member) return fail()

  // 3. Mint a native SAIF Bio session for that partner — no password prompt.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) return fail()

  // Success: clear the guard and let verifyOtp write the session cookies onto
  // the redirect response.
  const response = mkRedirect(next)
  response.cookies.set(GUARD, '', { ...guardOpts, maxAge: 0 })

  const { error: verifyError } = await bioClient(request, response).auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })
  if (verifyError) return fail()

  return response
}
