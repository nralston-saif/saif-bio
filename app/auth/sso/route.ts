import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCrmEmail } from '@/lib/supabase/sso'
import { isDemoMode } from '@/lib/supabase/demo/mock-client'
import type { Database } from '@/lib/supabase/types/database'

// SSO bridge: a partner already signed into the saif-monorepo CRM (same
// internal.saif.vc origin) is auto-signed into SAIF Bio without a second login.
// Reached from middleware when there's no SAIF Bio session but a CRM cookie is
// present. Keeps the two Supabase projects fully separate — we only read the
// CRM identity and mint a native SAIF Bio session for it.
const BASE_PATH = '/bio'

function withBase(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  if (clean === '/') return BASE_PATH
  return clean === BASE_PATH || clean.startsWith(`${BASE_PATH}/`) ? clean : `${BASE_PATH}${clean}`
}

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') ?? '/'

  // Relative redirect (stays on the public host) + a 60s one-shot guard cookie
  // so a failed bridge can't bounce the middleware into a redirect loop.
  const redirect = (path: string) => {
    const res = new NextResponse(null, { status: 307, headers: { Location: withBase(path) } })
    res.cookies.set('bio_sso_tried', '1', {
      maxAge: 60,
      httpOnly: true,
      sameSite: 'lax',
      path: BASE_PATH,
    })
    return res
  }

  if (isDemoMode()) return redirect(next)

  // 1. Who is signed into the CRM? (validated against the CRM project)
  const email = await getCrmEmail(request)
  if (!email) return redirect('/login')

  // 2. Are they an active SAIF Bio partner?
  const admin = createAdminClient()
  const { data: member } = await admin
    .from('bio_team_members')
    .select('id')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle()
  if (!member) return redirect('/login')

  // 3. Mint a native SAIF Bio session for that partner — no password prompt.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) return redirect('/login')

  const response = redirect(next)
  const supabase = createServerClient<Database>(
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

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })
  if (verifyError) return redirect('/login')

  return response
}
