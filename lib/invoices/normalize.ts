// Pure, import-free normalization of the raw invoice-extraction JSON returned by
// Claude into the shape the expense form consumes. Kept dependency-free so it is
// unit-testable without the SDK or the Next runtime.

export interface ExtractedInvoice {
  found: boolean
  vendor_name: string | null
  amount_cents: number | null
  expense_date: string | null // YYYY-MM-DD
  description: string | null
  likely_1099: boolean
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** "$1,234.56" / "1234.56" -> 123456 cents. Null for missing/invalid/negative. */
export function dollarsToCents(value: unknown): number | null {
  const str = typeof value === 'number' ? String(value) : asString(value)
  if (str === null) return null
  const cleaned = str.replace(/[$,\s]/g, '')
  if (cleaned === '') return null
  const num = Number(cleaned)
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round(num * 100)
}

/** Accept only a strict YYYY-MM-DD calendar date; otherwise null. */
export function normalizeInvoiceDate(value: unknown): string | null {
  const str = asString(value)
  if (str === null) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (!match) return null
  const [, y, m, d] = match
  const month = Number(m)
  const day = Number(d)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${y}-${m}-${d}`
}

/** Strip an accidental ```json ... ``` fence so JSON.parse can read the body. */
export function stripCodeFence(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

/** Map Claude's raw object into a clean ExtractedInvoice (never throws). */
export function parseInvoiceResult(raw: unknown): ExtractedInvoice {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const description = asString(obj.description)
  return {
    found: obj.found === true,
    vendor_name: asString(obj.vendor_name),
    amount_cents: dollarsToCents(obj.total_amount),
    expense_date: normalizeInvoiceDate(obj.invoice_date),
    description: description ? description.slice(0, 200) : null,
    likely_1099: obj.likely_1099 === true,
  }
}
