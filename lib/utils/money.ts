const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** Format integer cents as US dollars: 150000 -> "$1,500.00" */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  return usd.format(cents / 100)
}

/** Parse a user-entered dollar string into integer cents. Returns null if invalid. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '')
  if (cleaned === '') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

/** Format cents as a plain dollar amount for form inputs: 150000 -> "1500.00" */
export function centsToDollarString(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}
