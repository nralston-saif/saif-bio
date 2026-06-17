import type { NextConfig } from 'next'

// Security headers - CSP is set dynamically in middleware with per-request nonce
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  // Served as a Next.js "zone" under internal.saif.vc/bio. basePath prefixes
  // every route, route handler, and /_next asset with /bio so it never
  // collides with the saif-monorepo app that owns the rest of the domain.
  // saif-monorepo's next.config rewrites /bio and /bio/:path* to this app.
  basePath: '/bio',
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
