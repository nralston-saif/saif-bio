/** Format a YYYY-MM-DD date string for display: "Jun 12, 2026" */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Format a YYYY-MM-DD date in full letter style: "June 12, 2026" */
export function formatDateLong(date: string | null | undefined): string {
  if (!date) return ''
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Today as YYYY-MM-DD in local time */
export function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Today as YYYY-MM-DD in the America/Los_Angeles timezone — i.e. the local
 * Pacific calendar day regardless of where the server runs. en-CA gives us
 * the ISO-style format directly.
 */
export function todayPacificISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Days from today until a YYYY-MM-DD date (negative if past) */
export function daysUntil(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86_400_000)
}
