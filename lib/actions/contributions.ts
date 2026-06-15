'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, requiredString, optionalString, ActionError } from './helpers'
import { parseDollarsToCents } from '@/lib/utils/money'
import { getOrFetchDailySecurityPrice, normalizeSecuritySymbol } from '@/lib/market/security-prices'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ContributionMethod,
  Database,
  Restriction,
  StockValuationSource,
} from '@/lib/supabase/types/database'

type StockDetailFields = {
  security_name: string
  ticker_symbol: string | null
  cusip: string | null
  shares: number
  valuation_date: string
  fmv_per_share_cents: number | null
  fmv_total_cents: number
  valuation_source: StockValuationSource
  market_price_source: string | null
  brokerage_account: string | null
  transfer_received_date: string | null
  sale_date: string | null
  sale_gross_cents: number | null
  sale_fees_cents: number | null
  sale_net_cents: number | null
  notes: string | null
}

function optionalCents(formData: FormData, key: string): number | null {
  const input = optionalString(formData, key)
  if (input === null) return null
  const cents = parseDollarsToCents(input)
  if (cents === null) throw new ActionError(`Invalid amount: ${key}`)
  return cents
}

function optionalPositiveNumber(formData: FormData, key: string): number | null {
  const input = optionalString(formData, key)
  if (input === null) return null
  const value = Number(input.replace(/,/g, ''))
  if (!Number.isFinite(value) || value <= 0) {
    throw new ActionError(`Invalid number: ${key}`)
  }
  return value
}

function normalizeOptionalSymbol(value: string | null): string | null {
  if (!value) return null
  const symbol = normalizeSecuritySymbol(value)
  return symbol === '' ? null : symbol
}

async function stockDetailFields(
  formData: FormData,
  receivedDate: string,
  totalFmvInputCents: number | null,
  supabase: SupabaseClient<Database>
): Promise<StockDetailFields> {
  const securityName = requiredString(formData, 'stock_security_name')
  const tickerSymbol = normalizeOptionalSymbol(optionalString(formData, 'stock_ticker_symbol'))
  const shares = optionalPositiveNumber(formData, 'stock_shares')
  if (shares === null) throw new ActionError('Stock gifts require the number of shares')

  const valuationDate = optionalString(formData, 'stock_valuation_date') ?? receivedDate
  const apiPrice = await getOrFetchDailySecurityPrice(supabase, tickerSymbol, valuationDate)

  let fmvPerShareCents = optionalCents(formData, 'stock_fmv_per_share')
  let fmvTotalCents = totalFmvInputCents
  let valuationSource = (optionalString(formData, 'stock_valuation_source') ??
    'manual') as StockValuationSource
  let marketPriceSource: string | null = null

  if (fmvPerShareCents === null && apiPrice) {
    fmvPerShareCents = apiPrice.close_cents
    marketPriceSource = apiPrice.source
    if (fmvTotalCents === null) valuationSource = 'api_estimate'
  }

  if (fmvTotalCents === null && fmvPerShareCents !== null) {
    fmvTotalCents = Math.round(fmvPerShareCents * shares)
  }

  if (fmvPerShareCents === null && fmvTotalCents !== null) {
    fmvPerShareCents = Math.round(fmvTotalCents / shares)
  }

  if (fmvTotalCents === null) {
    throw new ActionError(
      'Stock gifts require a total FMV, FMV per share, or API price for the valuation date'
    )
  }

  const saleGrossCents = optionalCents(formData, 'stock_sale_gross')
  const saleFeesCents = optionalCents(formData, 'stock_sale_fees')
  const saleNetInputCents = optionalCents(formData, 'stock_sale_net')
  const saleNetCents =
    saleNetInputCents ?? (saleGrossCents !== null ? saleGrossCents - (saleFeesCents ?? 0) : null)
  if (saleNetCents !== null && saleNetCents < 0) {
    throw new ActionError('Sale net proceeds cannot be negative')
  }

  return {
    security_name: securityName,
    ticker_symbol: tickerSymbol,
    cusip: optionalString(formData, 'stock_cusip'),
    shares,
    valuation_date: valuationDate,
    fmv_per_share_cents: fmvPerShareCents,
    fmv_total_cents: fmvTotalCents,
    valuation_source: valuationSource,
    market_price_source: marketPriceSource,
    brokerage_account: optionalString(formData, 'stock_brokerage_account'),
    transfer_received_date: optionalString(formData, 'stock_transfer_received_date') ?? receivedDate,
    sale_date: optionalString(formData, 'stock_sale_date'),
    sale_gross_cents: saleGrossCents,
    sale_fees_cents: saleFeesCents,
    sale_net_cents: saleNetCents,
    notes: optionalString(formData, 'stock_notes'),
  }
}

async function contributionFields(
  formData: FormData,
  supabase: SupabaseClient<Database>
) {
  const method = requiredString(formData, 'method') as ContributionMethod
  const quidProQuo = formData.get('quid_pro_quo') === 'on'
  const receivedDate = requiredString(formData, 'received_date')

  const amountInput = optionalString(formData, 'amount')
  let amountCents = amountInput !== null ? parseDollarsToCents(amountInput) : null
  if (amountInput !== null && amountCents === null) {
    throw new ActionError('Invalid amount')
  }
  if (method !== 'in_kind' && method !== 'stock' && amountCents === null) {
    throw new ActionError('Amount is required for cash contributions')
  }

  const inKindDescription = optionalString(formData, 'in_kind_description')
  if (method === 'in_kind' && !inKindDescription) {
    throw new ActionError('In-kind gifts require a description of the property')
  }

  let goodsServicesValueCents: number | null = null
  const goodsServicesDescription = optionalString(formData, 'goods_services_description')
  if (quidProQuo) {
    const gsInput = optionalString(formData, 'goods_services_value')
    goodsServicesValueCents = gsInput !== null ? parseDollarsToCents(gsInput) : null
    if (!goodsServicesDescription || goodsServicesValueCents === null) {
      throw new ActionError(
        'Quid pro quo contributions require a description and good-faith value of goods/services provided'
      )
    }
  }

  const stockDetail =
    method === 'stock'
      ? await stockDetailFields(formData, receivedDate, amountCents, supabase)
      : null
  if (stockDetail) amountCents = stockDetail.fmv_total_cents

  return {
    contribution: {
      contact_id: requiredString(formData, 'contact_id'),
      amount_cents: amountCents,
      received_date: receivedDate,
      method,
      in_kind_description: method === 'in_kind' ? inKindDescription : null,
      restriction: (optionalString(formData, 'restriction') ?? 'unrestricted') as Restriction,
      restriction_purpose: optionalString(formData, 'restriction_purpose'),
      quid_pro_quo: quidProQuo,
      goods_services_description: quidProQuo ? goodsServicesDescription : null,
      goods_services_value_cents: quidProQuo ? goodsServicesValueCents : null,
      check_number: optionalString(formData, 'check_number'),
      notes: optionalString(formData, 'notes'),
    },
    stockDetail,
  }
}

export async function createContribution(formData: FormData) {
  const memberId = await requireMemberId()
  const supabase = await createClient()
  const { contribution, stockDetail } = await contributionFields(formData, supabase)

  const { data, error } = await supabase
    .from('bio_contributions')
    .insert({ ...contribution, entered_by: memberId })
    .select('id')
    .single()

  if (error) throw new ActionError(error.message)

  if (stockDetail) {
    const { error: stockError } = await supabase.from('bio_stock_contribution_details').insert({
      ...stockDetail,
      contribution_id: data.id,
    })
    if (stockError) {
      await supabase.from('bio_contributions').delete().eq('id', data.id)
      throw new ActionError(stockError.message)
    }
  }

  revalidatePath('/contributions')
  redirect(`/contributions/${data.id}`)
}

export async function updateContribution(contributionId: string, formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  // Don't allow edits once a letter has been sent - the letter snapshot
  // must continue to match what the donor received
  const { data: letter } = await supabase
    .from('bio_acknowledgement_letters')
    .select('status')
    .eq('contribution_id', contributionId)
    .maybeSingle()

  if (letter?.status === 'sent') {
    throw new ActionError(
      'This contribution has a sent acknowledgement letter and can no longer be edited'
    )
  }

  const { contribution, stockDetail } = await contributionFields(formData, supabase)

  const { error } = await supabase
    .from('bio_contributions')
    .update(contribution)
    .eq('id', contributionId)

  if (error) throw new ActionError(error.message)

  if (stockDetail) {
    const { error: stockError } = await supabase
      .from('bio_stock_contribution_details')
      .upsert({ ...stockDetail, contribution_id: contributionId }, { onConflict: 'contribution_id' })
    if (stockError) throw new ActionError(stockError.message)
  } else {
    await supabase
      .from('bio_stock_contribution_details')
      .delete()
      .eq('contribution_id', contributionId)
  }

  revalidatePath('/contributions')
  revalidatePath(`/contributions/${contributionId}`)
}
