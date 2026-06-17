/**
 * Application basePath. MUST stay in sync with `basePath` in next.config.ts.
 *
 * next/link and the Next router prepend the basePath automatically, but plain
 * <a href> and fetch() calls to route handlers (/api/*) do NOT. When the app is
 * served under /bio, an unprefixed `/api/letters/...` resolves to the parent
 * zone (the CRM) and 404s — so prefix those links/fetches with this.
 */
export const BASE_PATH = '/bio'

/** Prefix an app-absolute path with the basePath (for <a>/fetch to /api/*). */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`
}
