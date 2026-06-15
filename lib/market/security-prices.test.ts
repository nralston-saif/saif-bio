import { describe, expect, it } from 'vitest'
import { normalizeSecuritySymbol, parseFmpLightPrices } from './security-prices'

describe('security price helpers', () => {
  it('normalizes tickers for storage and lookup', () => {
    expect(normalizeSecuritySymbol(' aapl ')).toBe('AAPL')
  })

  it('parses FMP light EOD rows into integer cents', () => {
    const rows = parseFmpLightPrices(
      [
        { symbol: 'aapl', date: '2026-06-03', price: 197.85, volume: 52000000 },
        { symbol: 'AAPL', date: '2026-06-02', price: '196.12', volume: '41000000' },
      ],
      'AAPL',
      '2026-06-03T21:00:00.000Z'
    )

    expect(rows).toEqual([
      {
        symbol: 'AAPL',
        price_date: '2026-06-03',
        close_cents: 19785,
        volume: 52000000,
        source: 'fmp',
        fetched_at: '2026-06-03T21:00:00.000Z',
      },
      {
        symbol: 'AAPL',
        price_date: '2026-06-02',
        close_cents: 19612,
        volume: 41000000,
        source: 'fmp',
        fetched_at: '2026-06-03T21:00:00.000Z',
      },
    ])
  })

  it('ignores malformed rows', () => {
    const rows = parseFmpLightPrices(
      [{ date: '2026-06-03' }, { price: 197.85 }, { date: '2026-06-03', price: -1 }],
      'AAPL',
      '2026-06-03T21:00:00.000Z'
    )

    expect(rows).toEqual([])
  })
})
