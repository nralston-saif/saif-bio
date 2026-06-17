import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types/database'

export interface MiddlewareConfig {
  /** Paths that don't require authentication */
  publicPaths?: string[]
  /** Path to redirect unauthenticated users to */
  loginPath?: string
  /** Path to redirect authenticated users to when accessing login page */
  defaultRedirect?: string
  /**
   * Optional: for an unauthenticated request, return a path (relative, no
   * basePath) to send the user to instead of loginPath — e.g. an SSO bridge
   * that can establish a session. Return null to fall through to loginPath.
   */
  ssoRedirect?: (request: NextRequest) => string | null
}

export async function updateSession(
  request: NextRequest,
  config: MiddlewareConfig = {}
) {
  const {
    publicPaths = ['/auth', '/_next', '/api'],
    loginPath = '/login',
    defaultRedirect = '/',
    ssoRedirect,
  } = config

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Relative redirect so the browser resolves against whatever host is in the
  // address bar. When this app is proxied as the /bio zone under
  // internal.saif.vc, an absolute-host redirect could escape to the raw bio
  // deployment domain; a relative Location stays on the public host. basePath
  // is read at runtime so this helper works with or without a basePath.
  const redirectTo = (pathname: string) =>
    new NextResponse(null, {
      status: 307,
      headers: {
        Location: `${request.nextUrl.basePath}${pathname}`,
        // Never let a navigation serve a cached auth redirect (e.g. a stale
        // /bio -> /login from before the user had a session).
        'Cache-Control': 'no-store',
      },
    })

  if (!user && !isPublicPath) {
    // Give an SSO bridge first crack at establishing a session before we send
    // the user to the login page.
    return redirectTo(ssoRedirect?.(request) ?? loginPath)
  }

  if (user && request.nextUrl.pathname === loginPath) {
    return redirectTo(defaultRedirect)
  }

  return supabaseResponse
}

export { NextResponse, type NextRequest }
