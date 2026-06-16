import { describe, expect, it } from 'vitest'
import {
  dollarsToCents,
  normalizeInvoiceDate,
  parseInvoiceResult,
  stripCodeFence,
} from './normalize'

describe('dollarsToCents', () => {
  it('parses plain and formatted amounts into integer cents', () => {
    expect(dollarsToCents('1234.56')).toBe(123456)
    expect(dollarsToCents('$1,234.56')).toBe(123456)
    expect(dollarsToCents(' 89 ')).toBe(8900)
    expect(dollarsToCents(42)).toBe(4200)
  })

  it('rejects missing, non-numeric, and negative values', () => {
    expect(dollarsToCents(null)).toBeNull()
    expect(dollarsToCents('')).toBeNull()
    expect(dollarsToCents('n/a')).toBeNull()
    expect(dollarsToCents('-5')).toBeNull()
  })
})

describe('normalizeInvoiceDate', () => {
  it('accepts a strict YYYY-MM-DD date', () => {
    expect(normalizeInvoiceDate('2026-06-16')).toBe('2026-06-16')
  })

  it('rejects other formats and impossible months/days', () => {
    expect(normalizeInvoiceDate('06/16/2026')).toBeNull()
    expect(normalizeInvoiceDate('2026-13-01')).toBeNull()
    expect(normalizeInvoiceDate('2026-06-40')).toBeNull()
    expect(normalizeInvoiceDate(null)).toBeNull()
  })
})

describe('stripCodeFence', () => {
  it('removes a ```json fence around the body', () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}')
  })
})

describe('parseInvoiceResult', () => {
  it('maps a well-formed result', () => {
    const r = parseInvoiceResult({
      found: true,
      vendor_name: '  Acme Consulting LLC ',
      total_amount: '$2,500.00',
      invoice_date: '2026-06-01',
      description: 'Consulting services for May',
      likely_1099: true,
    })
    expect(r).toEqual({
      found: true,
      vendor_name: 'Acme Consulting LLC',
      amount_cents: 250000,
      expense_date: '2026-06-01',
      description: 'Consulting services for May',
      likely_1099: true,
    })
  })

  it('defaults safely on garbage input', () => {
    const r = parseInvoiceResult(null)
    expect(r.found).toBe(false)
    expect(r.vendor_name).toBeNull()
    expect(r.amount_cents).toBeNull()
    expect(r.expense_date).toBeNull()
    expect(r.likely_1099).toBe(false)
  })

  it('coerces non-boolean found/likely_1099 to false', () => {
    const r = parseInvoiceResult({ found: 'yes', likely_1099: 1, total_amount: '10' })
    expect(r.found).toBe(false)
    expect(r.likely_1099).toBe(false)
    expect(r.amount_cents).toBe(1000)
  })
})
