import { updateSession, NextResponse, type NextRequest } from '@/lib/supabase/middleware'

// Generate a cryptographically secure nonce
function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString('base64')
}

// Build Content Security Policy header with nonce
function buildCSP(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseHost = supabaseUrl.replace(/^https?:\/\//, '')
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: ${supabaseUrl}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${supabaseUrl} wss://${supabaseHost}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  return directives.join('; ')
}

export async function proxy(request: NextRequest) {
  const nonce = generateNonce()

  // API routes handle their own auth but still get CSP
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    response.headers.set('x-nonce', nonce)
    response.headers.set('Content-Security-Policy-Report-Only', buildCSP(nonce))
    return response
  }

  // Demo mode (no Supabase project configured): open access, no auth
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    if (request.nextUrl.pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    const response = NextResponse.next()
    response.headers.set('x-nonce', nonce)
    response.headers.set('Content-Security-Policy-Report-Only', buildCSP(nonce))
    return response
  }

  const response = await updateSession(request, {
    publicPaths: ['/login', '/auth', '/_next', '/access-denied'],
    loginPath: '/login',
    defaultRedirect: '/',
  })

  response.headers.set('x-nonce', nonce)
  response.headers.set('Content-Security-Policy-Report-Only', buildCSP(nonce))

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
