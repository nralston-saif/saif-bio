import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SecurityPrice } from '@/lib/supabase/types/database'

export const FMP_SOURCE = 'fmp'

interface FmpLightRow {
  symbol?: unknown
  date?: unknown
  price?: unknown
  volume?: unknown
}

export interface DailySecurityPriceInput {
  symbol: string
  price_date: string
  close_cents: number
  volume: number | null
  source: string
  fetched_at: string
}

export function normalizeSecuritySymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

function centsFromPrice(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function volumeFromValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function rowsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (isRecord(payload) && Array.isArray(payload.historical)) return payload.historical
  return []
}

/** Parse FMP's historical-price-eod/light response into cacheable price rows. */
export function parseFmpLightPrices(
  payload: unknown,
  fallbackSymbol: string,
  fetchedAt: string
): DailySecurityPriceInput[] {
  const symbol = normalizeSecuritySymbol(fallbackSymbol)
  return rowsFromPayload(payload)
    .map((row): DailySecurityPriceInput | null => {
      const item = row as FmpLightRow
      if (typeof item.date !== 'string') return null
      const closeCents = centsFromPrice(item.price)
      if (closeCents === null) return null
      return {
        symbol: normalizeSecuritySymbol(
          typeof item.symbol === 'string' && item.symbol.trim() ? item.symbol : symbol
        ),
        price_date: item.date,
        close_cents: closeCents,
        volume: volumeFromValue(item.volume),
        source: FMP_SOURCE,
        fetched_at: fetchedAt,
      }
    })
    .filter((row): row is DailySecurityPriceInput => row !== null)
}

function isoDaysBefore(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

async function latestCachedPrice(
  supabase: SupabaseClient<Database>,
  symbol: string,
  date: string
): Promise<SecurityPrice | null> {
  const { data } = await supabase
    .from('bio_security_prices')
    .select('*')
    .eq('symbol', symbol)
    .eq('source', FMP_SOURCE)
    .gte('price_date', isoDaysBefore(date, 7))
    .lte('price_date', date)
    .order('price_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as unknown as SecurityPrice | null) ?? null
}

async function fetchFmpPrices(symbol: string, date: string): Promise<DailySecurityPriceInput[]> {
  const apiKey = process.env.FMP_API_KEY
  if (!apiKey) return []

  const fetchedAt = new Date().toISOString()
  const url = new URL('https://financialmodelingprep.com/stable/historical-price-eod/light')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('from', isoDaysBefore(date, 7))
  url.searchParams.set('to', date)
  url.searchParams.set('apikey', apiKey)

  const response = await fetch(url, { next: { revalidate: 60 * 60 * 12 } })
  if (!response.ok) return []

  const payload = (await response.json()) as unknown
  return parseFmpLightPrices(payload, symbol, fetchedAt)
}

export async function getOrFetchDailySecurityPrice(
  supabase: SupabaseClient<Database>,
  rawSymbol: string | null,
  date: string | null
): Promise<SecurityPrice | null> {
  if (!rawSymbol || !date) return null
  const symbol = normalizeSecuritySymbol(rawSymbol)
  if (!symbol) return null

  const cached = await latestCachedPrice(supabase, symbol, date)
  if (cached) return cached

  const fetched = await fetchFmpPrices(symbol, date)
  if (fetched.length === 0) return null

  await supabase.from('bio_security_prices').upsert(fetched, {
    onConflict: 'symbol,price_date,source',
  })

  return latestCachedPrice(supabase, symbol, date)
}
