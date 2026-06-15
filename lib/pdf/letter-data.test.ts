import { describe, it, expect } from 'vitest'
import { buildLetterData } from './letter-data'
import type {
  Contact,
  Contribution,
  Settings,
  StockContributionDetail,
} from '@/lib/supabase/types/database'

const settings: Settings = {
  id: 1,
  org_legal_name: 'SAIF Bio Inc.',
  ein: '12-3456789',
  address_line1: '123 Mission St',
  address_line2: null,
  city: 'San Francisco',
  state: 'CA',
  postal_code: '94105',
  fiscal_year_start_month: 1,
  letter_signatory_name: 'Nick Ralston',
  letter_signatory_title: 'President',
  letter_from_email: 'letters@saifbio.org',
  letter_closing_text: 'Thank you for your generous support of our mission.',
  created_at: '',
  updated_at: '',
}

const contact: Contact = {
  id: 'c1',
  contact_type: 'individual',
  display_name: 'Jane Donor',
  org_name: null,
  first_name: 'Jane',
  last_name: 'Donor',
  email: 'jane@example.com',
  phone: null,
  address_line1: '1 Main St',
  address_line2: null,
  city: 'Oakland',
  state: 'CA',
  postal_code: '94601',
  country: 'US',
  tax_id: null,
  is_donor: true,
  is_grantee: false,
  is_funder: false,
  is_vendor: false,
  w9_on_file: false,
  notes: null,
  created_at: '',
  updated_at: '',
}

function makeContribution(overrides: Partial<Contribution>): Contribution {
  return {
    id: 'k1',
    contact_id: 'c1',
    amount_cents: 50_000,
    received_date: '2026-05-01',
    method: 'check',
    in_kind_description: null,
    restriction: 'unrestricted',
    restriction_purpose: null,
    quid_pro_quo: false,
    goods_services_description: null,
    goods_services_value_cents: null,
    check_number: null,
    notes: null,
    entered_by: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('buildLetterData (IRS Pub 1771 branches)', () => {
  it('cash gift with no goods/services includes the exact required statement', () => {
    const data = buildLetterData(makeContribution({}), contact, settings, '2026-06-12')

    expect(data.amountFormatted).toBe('$500.00')
    expect(data.goodsServicesStatement).toBe(
      'No goods or services were provided in exchange for this contribution.'
    )
    expect(data.receivedDate).toBe('May 1, 2026')
    expect(data.ein).toBe('12-3456789')
    expect(data.deductibilityStatement).toContain('501(c)(3)')
    expect(data.deductibilityStatement).toContain('12-3456789')
  })

  it('quid pro quo gift includes description, good-faith estimate, and excess-deductibility language', () => {
    const data = buildLetterData(
      makeContribution({
        amount_cents: 25_000,
        quid_pro_quo: true,
        goods_services_description: 'two gala dinner tickets',
        goods_services_value_cents: 10_000,
      }),
      contact,
      settings,
      '2026-06-12'
    )

    expect(data.goodsServicesStatement).toContain('two gala dinner tickets')
    expect(data.goodsServicesStatement).toContain('$100.00')
    expect(data.goodsServicesStatement).toContain('good-faith estimate')
    expect(data.goodsServicesStatement).toContain(
      'Only the amount of your contribution that exceeds the value of the goods or services provided is deductible'
    )
  })

  it('in-kind gift describes the property and never states a value', () => {
    const data = buildLetterData(
      makeContribution({
        method: 'in_kind',
        amount_cents: null,
        in_kind_description: 'one used laboratory centrifuge',
      }),
      contact,
      settings,
      '2026-06-12'
    )

    expect(data.amountFormatted).toBeNull()
    expect(data.nonCashDescription).toContain('one used laboratory centrifuge')
    expect(data.nonCashDescription).toContain('does not assign it a value')
    expect(data.goodsServicesStatement).toBe(
      'No goods or services were provided in exchange for this contribution.'
    )
  })

  it('stock gift describes the securities and never states internal FMV', () => {
    const stockDetail: StockContributionDetail = {
      contribution_id: 'k1',
      security_name: 'Apple Inc. common stock',
      ticker_symbol: 'AAPL',
      cusip: '037833100',
      shares: 10,
      valuation_date: '2026-06-03',
      fmv_per_share_cents: 19_785,
      fmv_total_cents: 197_850,
      valuation_source: 'broker_statement',
      market_price_source: 'fmp',
      brokerage_account: null,
      transfer_received_date: '2026-06-03',
      sale_date: null,
      sale_gross_cents: null,
      sale_fees_cents: null,
      sale_net_cents: null,
      notes: null,
      created_at: '',
      updated_at: '',
    }

    const data = buildLetterData(
      makeContribution({
        method: 'stock',
        amount_cents: 197_850,
      }),
      contact,
      settings,
      '2026-06-12',
      stockDetail
    )

    expect(data.amountFormatted).toBeNull()
    expect(data.nonCashDescription).toContain('10 shares of Apple Inc. common stock')
    expect(data.nonCashDescription).toContain('AAPL')
    expect(data.nonCashDescription).toContain('does not assign it a value')
    expect(JSON.stringify(data)).not.toContain('$1,978.50')
    expect(JSON.stringify(data)).not.toContain('$197.85')
  })

  it('throws when EIN is missing', () => {
    expect(() =>
      buildLetterData(makeContribution({}), contact, { ...settings, ein: null }, '2026-06-12')
    ).toThrow(/EIN/)
  })

  it('throws when signatory is missing', () => {
    expect(() =>
      buildLetterData(
        makeContribution({}),
        contact,
        { ...settings, letter_signatory_name: null },
        '2026-06-12'
      )
    ).toThrow(/signatory/)
  })
})
