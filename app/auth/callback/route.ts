import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// This app is served under the /bio zone (see next.config basePath). Emit
// redirects as relative paths so the browser resolves them against the public
// host (internal.saif.vc/bio…) when proxied, and against the app's own domain
// when accessed directly — never reliant on forwarded-host handling.
const BASE_PATH = '/bio'

function withBase(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  if (clean === '/') return BASE_PATH
  return clean === BASE_PATH || clean.startsWith(`${BASE_PATH}/`) ? clean : `${BASE_PATH}${clean}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  const supabase = await createClient()

  const redirect = (path: string) =>
    new NextResponse(null, { status: 307, headers: { Location: withBase(path) } })

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return redirect(next)
    console.error('Auth callback code exchange error:', error)
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return redirect(next)
    console.error('Auth callback OTP verification error:', error)
  }

  return redirect('/login?error=auth_failed')
}
