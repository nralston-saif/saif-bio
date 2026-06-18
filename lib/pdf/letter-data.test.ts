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
  org_legal_name: 'SAIFbio Inc.',
  ein: '12-3456789',
  address_line1: '123 Mission St',
  address_line2: null,
  city: 'San Francisco',
  state: 'CA',
  postal_code: '94105',
  fiscal_year_start_month: 1,
  letter_signatory_name: 'Geoffrey Ralston',
  letter_signatory_title: 'President',
  letter_from_email: 'letters@saifbio.org',
  letter_closing_text: 'Thank you again for your support.',
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

const orgContact: Contact = {
  ...contact,
  contact_type: 'organization',
  // Display name is an app nickname; the letter should use the official org name.
  display_name: 'DALHAP',
  org_name: 'DALHAP Investments Ltd.',
  first_name: 'Diane',
  last_name: 'Stirling',
  email: 'diane@dalhap.example',
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
  it('cash gift: short name, USD amount, deductibility, no-goods statement', () => {
    const data = buildLetterData(makeContribution({}), contact, settings, '2026-06-12')

    expect(data.orgLegalName).toBe('SAIFbio Inc.')
    expect(data.orgShortName).toBe('SAIFbio')
    expect(data.ein).toBe('12-3456789')
    expect(data.salutation).toBe('Dear Jane:')
    expect(data.giftParagraph).toContain('$500.00 USD')
    expect(data.giftParagraph).toContain('May 1, 2026')
    expect(data.deductibilityParagraph).toContain('501(c)(3)')
    expect(data.deductibilityParagraph).toContain('509(a)(1)')
    expect(data.goodsServicesParagraph).toContain(
      'no goods or services were provided in consideration for your gift'
    )
    expect(data.inKindNote).toBeNull()
    expect(data.signatoryTitle).toBe('President, SAIFbio Inc.')
    // Recipient block: name + email, no Attention line, no postal address.
    expect(data.recipientLines).toEqual(['Jane Donor', 'Email: jane@example.com'])
  })

  it('organization donor: official name, attention + email block, third-person thanks', () => {
    const data = buildLetterData(makeContribution({}), orgContact, settings, '2026-06-12')
    expect(data.salutation).toBe('Dear Diane:')
    expect(data.giftParagraph).toContain('thank DALHAP Investments Ltd. for its donation')
    expect(data.recipientLines).toEqual([
      'DALHAP Investments Ltd.',
      'Attention: Diane Stirling',
      'Email: diane@dalhap.example',
    ])
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

    expect(data.goodsServicesParagraph).toContain('two gala dinner tickets')
    expect(data.goodsServicesParagraph).toContain('$100.00')
    expect(data.goodsServicesParagraph).toContain('good-faith estimate')
    expect(data.goodsServicesParagraph).toContain(
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

    expect(data.giftParagraph).toContain('one used laboratory centrifuge')
    expect(data.giftParagraph).not.toContain('$')
    expect(data.inKindNote).toContain('does not assign it a value')
    expect(data.goodsServicesParagraph).toContain('no goods or services were provided')
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

    expect(data.giftParagraph).toContain('10 shares of Apple Inc. common stock')
    expect(data.giftParagraph).toContain('AAPL')
    expect(data.inKindNote).toContain('does not assign it a value')
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
